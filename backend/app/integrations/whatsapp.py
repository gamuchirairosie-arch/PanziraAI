"""WhatsApp Cloud API: signature check, payload parsing, and the citizen-initiated opt-in conversation.

We never join or read groups. A conversation exists only because the citizen messaged our number first,
and nothing is stored from it until they reply YES to the consent prompt.
"""
from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..i18n import STATUS_TEXT, t
from ..intake import (attach_image, create_report, get_consent, record_consent, revoke_consent)
from ..models import Report, utcnow
from ..security import Actor, hash_contact, limiter
from . import messenger as msg
from .africastalking import get_lang, set_lang

YES = {"yes", "y", "hongu", "ehe", "yebo", "start", "1"}
STOP = {"stop", "unsubscribe", "simudza", "phuma"}


def verify_signature(raw_body: bytes, header: str | None) -> None:
    s = get_settings()
    if not s.wa_app_secret:
        if s.env == "prod":
            raise HTTPException(503, "WhatsApp app secret not configured")
        return  # dev convenience only
    if not header or not header.startswith("sha256="):
        raise HTTPException(403, "Missing signature")
    expected = hmac.new(s.wa_app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, header.removeprefix("sha256=")):
        raise HTTPException(403, "Bad signature")


def extract_messages(payload: dict) -> list[dict]:
    out = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            v = change.get("value", {})
            for m in v.get("messages", []) or []:
                out.append({
                    "from": m.get("from"), "id": m.get("id"), "type": m.get("type"),
                    "text": (m.get("text") or {}).get("body", ""),
                    "caption": (m.get("image") or {}).get("caption", ""),
                    "media_id": (m.get("image") or {}).get("id"),
                    "location": m.get("location"),
                    "ts": datetime.fromtimestamp(int(m["timestamp"]), tz=timezone.utc) if m.get("timestamp") else None,
                })
    return out


def download_media(media_id: str) -> bytes | None:
    s = get_settings()
    if not s.wa_access_token:
        return None
    try:
        h = {"Authorization": f"Bearer {s.wa_access_token}"}
        meta = httpx.get(f"https://graph.facebook.com/{s.meta_graph_version}/{media_id}", headers=h, timeout=10)
        meta.raise_for_status()
        blob = httpx.get(meta.json()["url"], headers=h, timeout=20)
        blob.raise_for_status()
        return blob.content
    except Exception:
        return None


def handle_message(db: Session, m: dict, fetch_media=download_media) -> int | None:
    """Process one inbound message. Returns report id if a report was created."""
    sender = m["from"]
    if not sender or not m.get("id"):
        return None
    lang = get_lang(db, sender)
    body = (m.get("text") or m.get("caption") or "").strip()
    word = body.lower().split()[0] if body else ""

    if word in STOP:
        revoke_consent(db, sender, "whatsapp")
        msg.send(db, "whatsapp", sender, t("stopped", lang))
        return None
    if word in ("en", "sn", "nd") and len(body) == 2:
        set_lang(db, sender, word)
        lang = word

    consent = get_consent(db, sender, "whatsapp")
    if consent is None:
        if body.lower() in YES:
            record_consent(db, sender, "whatsapp", lang, allow_followup=True)
            msg.send(db, "whatsapp", sender, t("send_report", lang))
        else:
            msg.send(db, "whatsapp", sender, t("consent", lang))  # nothing stored from this message
        return None

    if word == "status" and len(body.split()) > 1:
        ref = body.split()[1].upper()
        try:
            rid = int(ref.rsplit("-", 1)[1])
        except Exception:
            rid = None
        r = db.get(Report, rid) if rid else None
        if not r or r.contributor_hash != hash_contact(sender):
            msg.send(db, "whatsapp", sender, t("not_found", lang))
        else:
            msg.send(db, "whatsapp", sender, f"{r.public_id}: {STATUS_TEXT[r.status][lang]}")
        return None

    if not limiter.check(f"wa:{hash_contact(sender)}", 10, 3600):
        msg.send(db, "whatsapp", sender, t("rate", lang))
        return None

    actor = Actor.system("system:whatsapp")
    # a shared location pin attaches to the contributor's latest report from the last 15 minutes
    if m["type"] == "location" and m.get("location"):
        loc = m["location"]
        h = hash_contact(sender)
        recent = db.execute(select(Report).where(Report.contributor_hash == h, Report.channel == "whatsapp",
                                                 Report.created_at >= utcnow() - timedelta(minutes=15))
                            .order_by(Report.id.desc())).scalars().first()
        if recent:
            recent.lat, recent.lng, recent.gps_reported = loc.get("latitude"), loc.get("longitude"), True
            return None
        r, _, created = create_report(db, channel="whatsapp", text="Location pin shared", actor=actor, language=lang,
                                      lat=loc.get("latitude"), lng=loc.get("longitude"), source_ref=f"wa:{m['id']}",
                                      contact=sender, allow_followup=consent.allow_followup)
        msg.send(db, "whatsapp", sender, t("received", lang, ref=r.public_id))
        return r.id if created else None

    text = body or ("Photo submitted without a description" if m["type"] == "image" else "")
    if not text:
        return None
    r, _, created = create_report(
        db, channel="whatsapp", text=text, actor=actor, language=None, source_ref=f"wa:{m['id']}",
        observed_at=m.get("ts"), contact=sender, allow_followup=consent.allow_followup,
    )
    if created and m["type"] == "image" and m.get("media_id"):
        data = fetch_media(m["media_id"])
        if data:
            try:
                attach_image(db, r, data, "whatsapp-photo", actor)
            except Exception:
                pass  # unreadable image: the text report still stands
    if created:
        msg.send(db, "whatsapp", sender, t("received", lang, ref=r.public_id))
    return r.id if created else None


def pseudonymize_phone(phone: str) -> str:
    """Masks personal phone number for privacy protection (e.g., +263***4589)."""
    clean = phone.strip()
    if len(clean) >= 7:
        return f"{clean[:4]}***{clean[-4:]}"
    return "Source identifier hidden"


def ingest_whatsapp_message(entry, db: Session):
    """
    Ingests an opt-in WhatsApp message, validates consent, executes AI intake,
    and stores the signal in the database for the modular schema.
    """
    from app.schemas.signal import CitizenReportCreate
    from app.ml.pipeline import process_intake_pipeline
    from app.database.models import SignalReport, AuditLog

    if not entry.user_consented_opt_in:
        raise ValueError(
            "Opt-in consent missing. Panzira strictly requires user-initiated consent "
            "and refuses unauthorized scraping of private groups."
        )

    count = db.query(SignalReport).count()
    next_num = 43 + count
    signal_id = f"PZ-SIG-00{next_num}" if next_num < 100 else f"PZ-SIG-0{next_num}"
    inv_code = f"ROADS-04{next_num}"

    now = datetime.now(timezone.utc)
    readable_now = now.strftime("%d %b %Y, %H:%M")
    short_time = now.strftime("%H:%M")
    masked_source = pseudonymize_phone(entry.from_number)

    report_input = CitizenReportCreate(
        categoryKey="other",
        categoryLabel="Road hazard",
        roadArea="Transit Corridor",
        landmark=f"WhatsApp report ({masked_source})",
        description=entry.message_body,
        reportedDateTime=readable_now,
        observedIso=now.isoformat(),
        language="English",
        photoType="none",
        sourceChannelLabel="Opt-in WhatsApp",
        sourceChannelShort="WhatsApp opt-in",
        sourceProvenanceNote=f"{masked_source} · {readable_now} · citizen-submitted via WhatsApp tipline",
    )

    ai_meta = process_intake_pipeline(report_input, db)
    clf = ai_meta["classification"]
    loc = ai_meta["location"]
    trans = ai_meta["translation"]
    vis = ai_meta["vision"]
    dedup = ai_meta["deduplication"]

    new_signal = SignalReport(
        id=signal_id,
        investigation_code=inv_code,
        source_channel_label="Opt-in WhatsApp",
        source_channel_short="WhatsApp opt-in",
        source_badge_color="green",
        visibility="opt-in",
        workflow_status="lead",
        monitor_status_label="AI structured",
        monitor_status_color="green",
        inbox_status_line="Opt-in WhatsApp · AI structured",
        time_short=short_time,
        reported_date_time=readable_now,
        observed_iso=now.isoformat(),
        title=f"{clf['categoryLabel']} · {loc['canonicalRoad']}",
        inbox_title=f"{clf['categoryLabel']} · {loc['canonicalRoad']}",
        subtitle=f"User-initiated WhatsApp report · {trans['sourceLanguage']}",
        corridor=loc["corridor"],
        road_area=loc["canonicalRoad"],
        landmark=loc["landmark"],
        category_key=clf["categoryKey"],
        category_label=clf["categoryLabel"],
        severity_label=clf["severityLabel"],
        is_critical=clf["isCritical"],
        original_language=trans["sourceLanguage"],
        original_quote=f"\"{entry.message_body.strip()}\"",
        draft_english_translation=trans["translatedText"],
        source_provenance_note=f"{masked_source} · {readable_now} · citizen-submitted via WhatsApp tipline",
        ai_hazard_type=clf["categoryLabel"],
        ai_likely_corridor=loc["aiLikelyCorridor"],
        ai_language_note=trans["languageNote"],
        ai_location_precision=loc["aiLocationPrecision"],
        ai_confidence_percent=ai_meta["confidencePercent"],
        ai_confidence_note=ai_meta["confidenceNote"],
        ai_image_heading=vis["heading"],
        ai_image_summary=vis["summary"],
        ai_image_caveat=vis["caveat"],
        photo_type="none",
        is_graphic_image=vis["isGraphic"],
        graphic_safety_reason=vis["reason"],
        pipeline_stage=2,
        missing_items=ai_meta["missingItems"],
        checklist={
            "locationAndTime": False,
            "mediaAndDate": False,
            "independentSource": False,
            "hazardStillPresent": False,
        },
        editorial_notes="Citizen-initiated WhatsApp tip. Verified opt-in compliance.",
        unconfirmed_summary=f"WhatsApp report describing {clf['categoryLabel'].lower()} along {loc['canonicalRoad']}.",
        duplicate_cluster_title=dedup["duplicateClusterTitle"],
        duplicate_cluster_summary=dedup["duplicateClusterSummary"],
        duplicate_candidates=dedup["duplicateCandidates"],
        timeline=[
            {
                "time": readable_now,
                "description": f"Citizen-initiated WhatsApp tip ({signal_id}) ingested into Signal Monitor as an unverified lead.",
            },
            {
                "time": readable_now,
                "description": f"AI structured hazard type ({clf['categoryLabel']}) and corridor ({loc['canonicalRoad']}); held off public map pending human verification.",
            }
        ],
        is_user_submitted=True,
        map_coords=loc["mapCoords"],
    )

    db.add(new_signal)
    audit_entry = AuditLog(
        signal_id=signal_id,
        action="WHATSAPP_INTAKE_RECEIVED",
        details=f"Received user-initiated WhatsApp report from {masked_source}. Pipeline stage 2 (AI structured).",
        user_name="WhatsApp Webhook Service",
        user_role="integration"
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(new_signal)
    return new_signal
