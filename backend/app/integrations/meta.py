"""Permitted Facebook / Instagram collection through Meta's official Graph API only. No scraping.

What is allowed here:
  * Facebook Pages we are authorised on (page admin token, or Meta's Page Public Content Access feature)
  * Instagram professional accounts we own: their own media, and media that tags us (citizen-initiated)
  * oEmbed lookup for a public post link a journalist/citizen pastes (needs an app token)
Every source must be pre-registered in `source_registrations` with the legal/permission basis.
Only road-related posts are kept; unrelated posts are counted and discarded, not stored.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai.classifier import lexicon_scores
from ..ai.locations import extract_locations
from ..config import get_settings
from ..intake import create_report
from ..models import SourceRegistration, utcnow
from ..security import Actor


@dataclass
class IngestItem:
    platform: str
    account_id: str
    account_name: str
    ref: str
    text: str
    url: str | None
    posted_at: datetime | None


def _parse_ts(v: str | None) -> datetime | None:
    if not v:
        return None
    try:
        return datetime.fromisoformat(v.replace("Z", "+00:00").replace("+0000", "+00:00"))
    except ValueError:
        return None


def is_road_related(text: str) -> bool:
    if not text or len(text) < 12:
        return False
    if sum(lexicon_scores(text).values()) == 0:
        return False
    loc = extract_locations(text)
    return bool(loc["candidates"] or loc["road_refs"] or loc["corridor_id"])


def _get(path: str, params: dict) -> dict:
    s = get_settings()
    r = httpx.get(f"https://graph.facebook.com/{s.meta_graph_version}/{path}",
                  params={**params, "access_token": s.meta_graph_token}, timeout=15)
    r.raise_for_status()
    return r.json()


def fetch_facebook_page(src: SourceRegistration, limit: int = 25) -> list[IngestItem]:
    data = _get(f"{src.account_id}/posts", {"fields": "id,message,created_time,permalink_url", "limit": limit})
    return [IngestItem("facebook_page", src.account_id, src.display_name, p["id"], p.get("message", ""),
                       p.get("permalink_url"), _parse_ts(p.get("created_time"))) for p in data.get("data", [])]


def fetch_instagram(src: SourceRegistration, limit: int = 25) -> list[IngestItem]:
    items: list[IngestItem] = []
    for edge in ("media", "tags"):  # own posts + posts that tag our account
        data = _get(f"{src.account_id}/{edge}", {"fields": "id,caption,permalink,timestamp", "limit": limit})
        items += [IngestItem("instagram", src.account_id, src.display_name, m["id"], m.get("caption", ""),
                             m.get("permalink"), _parse_ts(m.get("timestamp"))) for m in data.get("data", [])]
    return items


def fetch_oembed(url: str) -> dict | None:
    s = get_settings()
    if not s.meta_graph_token:
        return None
    kind = "instagram_oembed" if "instagram.com" in url else "oembed_post"
    try:
        return _get(kind, {"url": url, "omitscript": "true"})
    except Exception:
        return None


FETCHERS = {"facebook_page": fetch_facebook_page, "instagram": fetch_instagram}


def ingest_items(db: Session, items: list[IngestItem], actor: Actor) -> dict:
    kept = skipped = dup = 0
    ids: list[int] = []
    for it in items:
        if not is_road_related(it.text):
            skipped += 1
            continue
        r, _, created = create_report(
            db, channel=it.platform, text=it.text, actor=actor, source_url=it.url, source_ref=f"{it.platform}:{it.ref}",
            source_account=it.account_name, source_posted_at=it.posted_at, observed_at=it.posted_at,
        )
        if created:
            kept += 1
            ids.append(r.id)
        else:
            dup += 1
    return {"kept": kept, "skipped_unrelated": skipped, "duplicates": dup, "report_ids": ids}


def poll_registered_sources(db: Session, actor: Actor, fetchers=FETCHERS) -> dict:
    s = get_settings()
    if not s.meta_graph_token:
        return {"error": "META_GRAPH_TOKEN not configured", "sources": []}
    totals = {"sources": [], "report_ids": []}
    for src in db.execute(select(SourceRegistration).where(SourceRegistration.active == True)).scalars():  # noqa: E712
        try:
            res = ingest_items(db, fetchers[src.platform](src), actor)
            totals["sources"].append({"source": src.display_name, **{k: v for k, v in res.items() if k != "report_ids"}})
            totals["report_ids"] += res["report_ids"]
            src.last_polled_at = utcnow()
        except Exception as exc:
            totals["sources"].append({"source": src.display_name, "error": str(exc)[:160]})
    return totals
