"""Single entry point that every channel (web, WhatsApp, SMS, USSD, social ingest) uses to create reports."""
from __future__ import annotations

import html
import re
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import audit
from .ai.images import ImageRejected, analyze_image, blur_preview
from .ai.language import NAME_TO_CODE
from .ai.lexicon import CATEGORY_LABELS
from .config import get_settings
from .models import Consent, Evidence, Report, Status, utcnow
from .security import Actor, encrypt_field, hash_contact, new_tracking_token
from .storage import save_bytes
from .workflow import add_timeline, fmt

OPT_IN_CHANNELS = {"web", "whatsapp", "sms", "ussd"}
_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def clean_text(s: str | None, limit: int = 1500) -> str:
    """Strip control characters and collapse whitespace. Output is stored as plain text and must be
    escaped by the client on render (React does this by default)."""
    s = _CTRL.sub("", s or "")
    s = re.sub(r"[ \t]+", " ", s).strip()
    return s[:limit]


def lang_code(value: str | None) -> tuple[str, str]:
    """Returns (code, source). source = reporter when the reporter chose a language."""
    if value and value.lower() in NAME_TO_CODE:
        return NAME_TO_CODE[value.lower()], "reporter"
    return "en", "detected"


def create_report(
    db: Session,
    *,
    channel: str,
    text: str,
    actor: Actor,
    language: str | None = None,
    category_key: str | None = None,
    road_area: str = "",
    landmark: str = "",
    lat: float | None = None,
    lng: float | None = None,
    observed_at: datetime | None = None,
    source_url: str | None = None,
    source_ref: str | None = None,
    source_account: str | None = None,
    source_posted_at: datetime | None = None,
    contact: str | None = None,
    allow_followup: bool = False,
    reporter_flagged_graphic: bool = False,
    want_tracking_token: bool = False,
) -> tuple[Report, str | None, bool]:
    """Returns (report, tracking_token_or_None, created). Idempotent on (channel, source_ref)."""
    if source_ref:
        existing = db.execute(select(Report).where(Report.channel == channel,
                                                   Report.source_ref == source_ref)).scalar_one_or_none()
        if existing:
            return existing, None, False

    code, src = lang_code(language)
    token_raw, token_hash = (new_tracking_token() if want_tracking_token else (None, None))
    r = Report(
        channel=channel,
        visibility="opt-in" if channel in OPT_IN_CHANNELS else "public",
        source_url=(source_url or None),
        source_ref=source_ref,
        source_account=source_account,
        source_posted_at=source_posted_at,
        observed_at=observed_at,
        text_original=clean_text(text),
        language=code, language_source=src,
        road_area=clean_text(road_area, 200), landmark=clean_text(landmark, 200),
        lat=lat, lng=lng, gps_reported=lat is not None and lng is not None,
        status=Status.RECEIVED,
        tracking_token_hash=token_hash,
        is_graphic=reporter_flagged_graphic,
        graphic_reason="Reporter marked the attachment as potentially distressing" if reporter_flagged_graphic else None,
    )
    if category_key in CATEGORY_LABELS:
        r.category_key, r.category_label, r.category_source = category_key, CATEGORY_LABELS[category_key], "reporter"
    if contact:
        r.contributor_hash = hash_contact(contact)
        if allow_followup:
            r.contact_enc = encrypt_field(contact)
    db.add(r)
    db.flush()
    add_timeline(db, r, "system", f"Report received via {channel.replace('_', ' ')} at {fmt(utcnow())}. "
                               "Held off the public map pending human verification.")
    audit.record(db, actor, "report_received", "report", r.id,
                 {"channel": channel, "has_source_url": bool(source_url)})
    return r, token_raw, True


def attach_image(db: Session, report: Report, data: bytes, filename: str | None, actor: Actor) -> Evidence:
    s = get_settings()
    analysis, img = analyze_image(data, s.max_upload_mb * 1024 * 1024)
    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[analysis.mime]
    path = save_bytes(data, ext)
    graphic = analysis.graphic_score >= s.graphic_threshold
    ev = Evidence(
        id=uuid.uuid4().hex, report_id=report.id, kind="image", path=path,
        preview_path=save_bytes(blur_preview(img), ".jpg"),  # always generated; used when restricted
        original_filename=clean_text(filename, 120) or None, mime=analysis.mime, size_bytes=analysis.size_bytes,
        sha256=analysis.sha256, phash=analysis.phash, exif=analysis.exif,
        is_graphic=graphic or report.is_graphic, graphic_score=analysis.graphic_score, analysis=analysis.as_dict(),
    )
    db.add(ev)
    if ev.is_graphic and not report.is_graphic:
        report.is_graphic = True
        report.graphic_reason = "; ".join(analysis.graphic_reasons) or "Automated screen flagged the image"
    audit.record(db, actor, "evidence_attached", "report", report.id,
                 {"evidence": ev.id, "sha256": ev.sha256, "graphic": ev.is_graphic})
    return ev


def record_consent(db: Session, contact: str, channel: str, language: str, allow_followup: bool) -> Consent:
    h = hash_contact(contact)
    c = db.execute(select(Consent).where(Consent.contributor_hash == h, Consent.channel == channel)
                   ).scalars().first()
    if c is None:
        c = Consent(contributor_hash=h, channel=channel)
        db.add(c)
    c.language, c.allow_followup, c.revoked_at, c.granted_at = language, allow_followup, None, utcnow()
    db.flush()
    return c


def get_consent(db: Session, contact: str, channel: str) -> Consent | None:
    h = hash_contact(contact)
    c = db.execute(select(Consent).where(Consent.contributor_hash == h, Consent.channel == channel)
                   ).scalars().first()
    return c if c and not c.revoked_at else None


def revoke_consent(db: Session, contact: str, channel: str) -> None:
    """STOP: revoke consent and delete stored contact details from every report of this contributor."""
    h = hash_contact(contact)
    for c in db.execute(select(Consent).where(Consent.contributor_hash == h)).scalars():
        c.revoked_at = utcnow()
    for r in db.execute(select(Report).where(Report.contributor_hash == h)).scalars():
        r.contact_enc = None
    audit.record(db, Actor.system("system:consent"), "consent_revoked", "contributor", h[:12], {"channel": channel})
