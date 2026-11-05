"""Telegram Bot API intake for opt-in citizen reports.

Only private chats are accepted. The bot asks for an explicit YES before storing a
report, supports text, image captions and location pins, and never publishes alerts.
"""
from __future__ import annotations

import logging

import httpx
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import SessionLocal
from ..intake import attach_image, create_report, get_consent, revoke_consent, record_consent
from ..models import TelegramUpdate
from ..security import Actor, limiter
from . import messenger as msg

log = logging.getLogger("panzira.telegram")


def _claim_update(db: Session, update: dict) -> bool:
    """Claim a provider update once, storing no message content or chat identity."""
    update_id = update.get("update_id")
    if not isinstance(update_id, int):
        return True  # direct/internal callers; the HTTP webhook validates this field
    if db.get(TelegramUpdate, update_id) is not None:
        return False
    db.add(TelegramUpdate(update_id=update_id))
    try:
        db.flush()
    except IntegrityError:  # another webhook worker won the same delivery race
        db.rollback()
        return False
    return True


def _telegram_call(method: str, payload: dict | None = None) -> dict:
    token = get_settings().telegram_bot_token
    if not token:
        raise RuntimeError("Telegram bot token is not configured")
    response = httpx.post(
        f"https://api.telegram.org/bot{token}/{method}", json=payload or {}, timeout=12,
    )
    response.raise_for_status()
    data = response.json()
    if not data.get("ok"):
        raise RuntimeError("Telegram API rejected the request")
    return data.get("result", {})


def download_photo(file_id: str) -> bytes | None:
    """Download a Telegram photo with a strict size cap and no redirect following."""
    s = get_settings()
    try:
        file = _telegram_call("getFile", {"file_id": file_id})
        path = file.get("file_path")
        size = int(file.get("file_size") or 0)
        if not path or size > s.max_upload_mb * 1024 * 1024:
            return None
        response = httpx.get(
            f"https://api.telegram.org/file/bot{s.telegram_bot_token}/{path}", timeout=15,
            follow_redirects=False,
        )
        response.raise_for_status()
        if len(response.content) > s.max_upload_mb * 1024 * 1024:
            return None
        return response.content
    except Exception:
        log.warning("Telegram image download failed")
        return None


def handle_update(db: Session, update: dict, fetch_photo=download_photo) -> int | None:
    """Process a Bot API update. Returns a report id only when a new report is created."""
    if not _claim_update(db, update):
        return None
    message = update.get("message") or update.get("edited_message")
    if not message:
        return None
    chat = message.get("chat") or {}
    sender = message.get("from") or {}
    chat_id = chat.get("id")
    user_id = sender.get("id")
    if chat.get("type") != "private" or chat_id is None or user_id is None:
        return None

    contact = str(user_id)
    body = (message.get("text") or message.get("caption") or "").strip()
    command = body.split(maxsplit=1)[0].lower() if body else ""
    consent = get_consent(db, contact, "telegram")

    if command in {"/stop", "stop", "/unsubscribe"}:
        revoke_consent(db, contact, "telegram")
        msg.send(db, "telegram", str(chat_id), "Panzira: consent withdrawn. We will not store new reports from this chat.")
        return None
    if not consent:
        if body.lower() in {"yes", "y", "hongu", "ehe", "yebo"}:
            record_consent(db, contact, "telegram", "en", allow_followup=True)
            msg.send(db, "telegram", str(chat_id), "Thank you. Send a road hazard description, photo, or location pin. Reply STOP to withdraw consent.")
        else:
            msg.send(db, "telegram", str(chat_id), "Panzira can store your road-safety report for newsroom review and follow up about it. Reply YES to consent. Reply STOP at any time to withdraw.")
        return None

    if not limiter.check(f"telegram:{user_id}", 10, 3600):
        msg.send(db, "telegram", str(chat_id), "Panzira: report limit reached. Please try again later.")
        return None

    photo = (message.get("photo") or [])
    photo_id = photo[-1].get("file_id") if photo else None
    location = message.get("location") or {}
    text = body or ("Photo report submitted" if photo_id else "Location report submitted" if location else "")
    if not text:
        return None

    message_id = message.get("message_id")
    source_ref = f"telegram:{chat_id}:{message_id}" if message_id is not None else None
    report, _, created = create_report(
        db, channel="telegram", text=text, actor=Actor.system("system:telegram"),
        source_ref=source_ref, observed_at=None,
        lat=location.get("latitude"), lng=location.get("longitude"),
        contact=contact, allow_followup=bool(consent.allow_followup),
    )
    if created and photo_id:
        try:
            content = fetch_photo(photo_id)
        except Exception:
            log.warning("Telegram image provider failed for report %s", report.public_id)
            content = None
        if content:
            try:
                attach_image(db, report, content, "telegram-photo", Actor.system("system:telegram"))
            except Exception:
                log.warning("Telegram image rejected for report %s", report.public_id)
    if created:
        msg.send(db, "telegram", str(chat_id), f"Report {report.public_id} received. It is an unverified lead for newsroom review and is not a public alert.")
        editor_chat = get_settings().telegram_editor_chat_id
        if editor_chat:
            msg.send(db, "telegram", editor_chat, f"New Telegram lead {report.public_id}: {text[:240]}")
    return report.id if created else None


def process_update_background(update: dict) -> None:
    """Background task boundary keeps Telegram's webhook response quick."""
    db = SessionLocal()
    try:
        report_id = handle_update(db, update)
        db.commit()
        if report_id:
            from ..ai.pipeline import process_report
            process_report(db, report_id)
    except Exception:
        db.rollback()
        log.exception("Telegram update processing failed")
    finally:
        db.close()


def send_approved_alert(alert_id: int) -> None:
    """Broadcast only after the editor workflow has committed an approved alert."""
    settings = get_settings()
    if not (settings.telegram_bot_token and settings.telegram_alert_chat_id):
        return
    from ..models import PublicAlert
    db = SessionLocal()
    try:
        alert = db.get(PublicAlert, alert_id)
        if not alert or not alert.approved_by_id or alert.withdrawn_at:
            return
        body = (f"PANZIRA VERIFIED ROAD ALERT\n{alert.title}\nLocation: {alert.location}\n"
                f"{alert.description}\nSource: {alert.source_attribution}\n"
                f"Approved by newsroom editor. Check current conditions and follow local traffic guidance.")
        msg.send(db, "telegram", settings.telegram_alert_chat_id, body[:3900])
        db.commit()
    except Exception:
        db.rollback()
        log.exception("Telegram public-alert broadcast failed")
    finally:
        db.close()


def send_legacy_approved_alert(alert_id: str) -> None:
    """Broadcast an alert approved through the original /api newsroom workflow."""
    settings = get_settings()
    if not (settings.telegram_bot_token and settings.telegram_alert_chat_id):
        return
    from ..database.models import VerifiedPublicAlert
    from ..database.session import SessionLocal as LegacySessionLocal
    db = LegacySessionLocal()
    try:
        alert = db.get(VerifiedPublicAlert, alert_id)
        if not alert or not alert.approved_by_user_id:
            return
        body = (f"PANZIRA VERIFIED ROAD ALERT\n{alert.title}\nLocation: {alert.location}\n"
                f"{alert.description}\nSource: {alert.source_attribution}\n"
                f"Approved by newsroom editor. Check current conditions and follow local traffic guidance.")
        msg.send(db, "telegram", settings.telegram_alert_chat_id, body[:3900])
        db.commit()
    except Exception:
        db.rollback()
        log.exception("Telegram broadcast from legacy newsroom workflow failed")
    finally:
        db.close()
