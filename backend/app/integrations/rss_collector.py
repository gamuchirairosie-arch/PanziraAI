"""Conservative RSS collection from editor-registered Zimbabwean publishers.

This reads publisher-provided feeds only. It does not crawl article pages or bypass
robots, paywalls, authentication, or other access controls. Feed entries become leads.
"""
from __future__ import annotations

import html
import ipaddress
import logging
import socket
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from urllib.parse import urlparse
from xml.etree import ElementTree

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..ai.classifier import lexicon_scores
from ..ai.locations import extract_locations
from ..db import SessionLocal
from ..intake import create_report
from ..models import CollectionRun, RSSSource, utcnow
from ..security import Actor

log = logging.getLogger("panzira.rss")
MAX_FEED_BYTES = 1_000_000
MAX_ENTRIES = 50
PUBLISHER_DOMAINS = {
    "bulawayo24.com", "newsday.co.zw", "chronicle.co.zw", "herald.co.zw",
    "newzimbabwe.com", "zimeye.net", "theindependent.co.zw", "dailynews.co.zw",
}


class _Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.parts.append(data.strip())


def _plain(value: str, limit: int = 1800) -> str:
    parser = _Text()
    try:
        parser.feed(html.unescape(value or ""))
    except Exception:
        return " ".join((value or "").split())[:limit]
    return " ".join(parser.parts)[:limit]


def validate_feed_url(value: str) -> tuple[str, str]:
    parsed = urlparse(value.strip())
    host = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme != "https" or not host or parsed.username or parsed.password:
        raise ValueError("Feed URL must be HTTPS and must not contain embedded credentials")
    if parsed.port not in (None, 443):
        raise ValueError("Feed URL must use standard HTTPS port 443")
    if not any(host == domain or host.endswith("." + domain) for domain in PUBLISHER_DOMAINS):
        raise ValueError("Feed host is not on the approved Zimbabwe publisher domain list")
    try:
        addresses = {ipaddress.ip_address(info[4][0]) for info in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)}
    except OSError as exc:
        raise ValueError("Feed host could not be resolved") from exc
    if not addresses or any(not address.is_global for address in addresses):
        raise ValueError("Feed host resolves to a non-public network address")
    return value.strip(), host


def _download(url: str) -> bytes:
    with httpx.stream("GET", url, timeout=12, follow_redirects=False,
                      headers={"User-Agent": "PanziraAI-NewsroomCollector/1.0 (+RSS; contact newsroom)"}) as response:
        response.raise_for_status()
        if response.headers.get("content-type", "").lower().startswith(("text/html", "application/xhtml")):
            raise ValueError("Source returned a web page rather than an RSS/Atom feed")
        length = int(response.headers.get("content-length") or 0)
        if length > MAX_FEED_BYTES:
            raise ValueError("Feed exceeds the 1 MB size limit")
        chunks = bytearray()
        for chunk in response.iter_bytes():
            chunks.extend(chunk)
            if len(chunks) > MAX_FEED_BYTES:
                raise ValueError("Feed exceeds the 1 MB size limit")
        return bytes(chunks)


def _children(node: ElementTree.Element, name: str) -> list[ElementTree.Element]:
    return [child for child in node.iter() if child.tag.rsplit("}", 1)[-1].lower() == name.lower()]


def _first_text(node: ElementTree.Element, *names: str) -> str:
    wanted = {name.lower() for name in names}
    for child in node.iter():
        if child is node:
            continue
        if child.tag.rsplit("}", 1)[-1].lower() in wanted:
            if child.text:
                return child.text.strip()
            href = child.attrib.get("href")
            if href:
                return href.strip()
    return ""


def parse_feed(content: bytes) -> list[dict]:
    try:
        root = ElementTree.fromstring(content)
    except ElementTree.ParseError as exc:
        raise ValueError("Feed XML is invalid") from exc
    items = [n for n in root.iter() if n.tag.rsplit("}", 1)[-1].lower() in {"item", "entry"}]
    parsed: list[dict] = []
    for item in items[:MAX_ENTRIES]:
        title = _plain(_first_text(item, "title"), 300)
        url = _first_text(item, "link")
        description = _plain(_first_text(item, "description", "summary", "encoded", "content"), 1800)
        ref = _first_text(item, "guid", "id") or url or title
        posted = _first_text(item, "pubdate", "published", "updated", "date")
        if not title or not url or not ref:
            continue
        try:
            published_at = parsedate_to_datetime(posted) if posted else None
        except (TypeError, ValueError, OverflowError):
            try:
                published_at = datetime.fromisoformat(posted.replace("Z", "+00:00")) if posted else None
            except ValueError:
                published_at = None
        if published_at and published_at.tzinfo is None:
            published_at = published_at.replace(tzinfo=timezone.utc)
        article_host = (urlparse(url).hostname or "").lower().rstrip(".")
        if urlparse(url).scheme not in {"http", "https"} or not article_host:
            continue
        parsed.append({"title": title, "url": url, "description": description,
                       "ref": ref[:180], "published_at": published_at})
    return parsed


def _road_related(text: str) -> bool:
    scores = lexicon_scores(text)
    if sum(scores.values()) <= 0:
        return False
    location = extract_locations(text)
    return bool(location.get("candidates") or location.get("road_refs") or location.get("corridor_id"))


def collect_source(db: Session, source: RSSSource, actor: Actor) -> dict:
    run = CollectionRun(source_id=source.id, source_name=source.name, status="running")
    db.add(run)
    db.flush()
    try:
        url, host = validate_feed_url(source.feed_url)
        entries = parse_feed(_download(url))
        run.fetched_count = len(entries)
        for entry in entries:
            article_host = (urlparse(entry["url"]).hostname or "").lower().rstrip(".")
            if not (article_host == host or article_host.endswith("." + host)
                    or host.endswith("." + article_host)):
                run.skipped_count += 1
                continue
            story = " — ".join(part for part in (entry["title"], entry["description"]) if part)
            if not _road_related(story):
                run.skipped_count += 1
                continue
            # Only feed-provided excerpt and metadata are retained; article pages are not fetched.
            report, _, created = create_report(
                db, channel="rss", text=story, actor=actor, source_url=entry["url"],
                source_ref=f"rss:{source.id}:{entry['ref']}", source_account=source.name,
                source_posted_at=entry["published_at"], observed_at=entry["published_at"],
            )
            if created:
                run.created_count += 1
            else:
                run.duplicate_count += 1
        run.status = "completed"
        source.last_error = None
        source.last_polled_at = utcnow()
        audit.record(db, actor, "rss_collection_completed", "rss_source", source.id,
                     {"fetched": run.fetched_count, "created": run.created_count,
                      "duplicates": run.duplicate_count, "skipped": run.skipped_count,
                      "publisher_domain": source.publisher_domain})
    except Exception as exc:
        run.status = "failed"
        run.error = str(exc)[:400]
        source.last_error = run.error
        source.last_polled_at = utcnow()
        log.warning("RSS collection failed for source id %s", source.id)
    run.finished_at = utcnow()
    db.flush()
    return {"source": source.name, "status": run.status, "fetched": run.fetched_count,
            "created": run.created_count, "duplicates": run.duplicate_count,
            "skipped": run.skipped_count, "error": run.error}


def collect_active_sources() -> list[dict]:
    """Background task entry point with its own SQLAlchemy session."""
    db = SessionLocal()
    results = []
    try:
        actor = Actor.system("system:rss-collector")
        for source in db.execute(select(RSSSource).where(RSSSource.active.is_(True))).scalars():
            results.append(collect_source(db, source, actor))
            db.commit()
        return results
    finally:
        db.close()


def collect_due_sources() -> list[dict]:
    """Poll only sources whose editor-configured interval has elapsed."""
    db = SessionLocal()
    results = []
    try:
        now = utcnow()
        sources = db.execute(select(RSSSource).where(RSSSource.active.is_(True))).scalars().all()
        for source in sources:
            last = source.last_polled_at
            if last and last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if last and (now - last).total_seconds() < source.poll_interval_minutes * 60:
                continue
            results.append(collect_source(db, source, Actor.system("system:rss-collector")))
            db.commit()
        return results
    finally:
        db.close()


def collect_source_by_id(source_id: int) -> dict | None:
    db = SessionLocal()
    try:
        source = db.get(RSSSource, source_id)
        if not source or not source.active:
            return None
        result = collect_source(db, source, Actor.system("system:rss-collector"))
        db.commit()
        return result
    finally:
        db.close()
