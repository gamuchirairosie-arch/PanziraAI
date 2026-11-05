"""Telegram Bot API intake for opt-in citizen reports.

Only private chats are accepted. After explicit consent, the bot guides reporters
through the same core fields as the web form, accepts optional photo/location
evidence, and saves an unverified newsroom lead. It never publishes alerts.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import SessionLocal
from ..intake import (attach_image, clean_text, create_report, get_consent, revoke_consent,
                      record_consent)
from ..models import TelegramDraft, TelegramUpdate, utcnow
from ..security import Actor, hash_contact, limiter
from . import messenger as msg

log = logging.getLogger("panzira.telegram")
CAT = ZoneInfo("Africa/Harare")
CATEGORIES = {
    "1": ("potholes", "Road surface damage / pothole"),
    "2": ("flooding", "Flooding or standing water"),
    "3": ("collisions", "Collision, breakdown, or obstruction"),
    "4": ("visibility", "Visibility, lighting, or missing signs"),
    "5": ("other", "Other road hazard"),
}
CATEGORY_ALIASES = {
    "pothole": "1", "potholes": "1", "road damage": "1",
    "flood": "2", "flooding": "2", "water": "2",
    "crash": "3", "collision": "3", "breakdown": "3", "obstruction": "3",
    "visibility": "4", "lighting": "4", "signs": "4",
    "other": "5",
}


def _send(db: Session, chat_id: int, body: str) -> None:
    msg.send(db, "telegram", str(chat_id), body)


def _draft(db: Session, contact: str) -> TelegramDraft | None:
    return db.execute(select(TelegramDraft).where(
        TelegramDraft.contributor_hash == hash_contact(contact)
    )).scalar_one_or_none()


def _start_draft(db: Session, contact: str, chat_id: int) -> TelegramDraft:
    existing = _draft(db, contact)
    if existing:
        db.delete(existing)
        db.flush()
    draft = TelegramDraft(contributor_hash=hash_contact(contact), state="category")
    db.add(draft)
    db.flush()
    _send(db, chat_id,
          "Road incident report - step 1 of 6\n"
          "What type of hazard is it? Reply with a number:\n"
          "1 Pothole / road damage\n2 Flooding / standing water\n"
          "3 Collision / breakdown / obstruction\n4 Visibility / lighting / signs\n5 Other")
    return draft


def _parse_observed(value: str) -> datetime | None:
    word = value.strip().lower()
    now = utcnow()
    if word in {"now", "today", "just now"}:
        return now
    if word == "yesterday":
        return now - timedelta(days=1)
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=CAT)
    parsed = parsed.astimezone(timezone.utc)
    if parsed > now + timedelta(minutes=5) or parsed < now - timedelta(days=30):
        return None
    return parsed


def _finish_draft(db: Session, draft: TelegramDraft, contact: str, chat_id: int,
                  consent, fetch_photo) -> int | None:
    if not limiter.check(f"telegram-report:{contact}", 10, 3600):
        _send(db, chat_id, "Panzira: report limit reached. Please try again later.")
        return None
    report, _, created = create_report(
        db, channel="telegram", text=draft.description,
        actor=Actor.system("system:telegram"), language=None,
        category_key=draft.category_key, road_area=draft.road_area,
        landmark=draft.landmark, observed_at=draft.observed_at,
        lat=draft.lat, lng=draft.lng, source_ref=f"telegram:draft:{draft.id}",
        contact=contact, allow_followup=bool(consent.allow_followup),
    )
    if created and draft.photo_file_id:
        try:
            content = fetch_photo(draft.photo_file_id)
        except Exception:
            log.warning("Telegram image provider failed for report %s", report.public_id)
            content = None
        if content:
            try:
                attach_image(db, report, content, "telegram-photo", Actor.system("system:telegram"))
            except Exception:
                log.warning("Telegram image rejected for report %s", report.public_id)
    db.delete(draft)
    if created:
        _send(db, chat_id, f"Report {report.public_id} received. It is an unverified lead for newsroom review and is not a public alert.")
        editor_chat = get_settings().telegram_editor_chat_id
        if editor_chat:
            msg.send(db, "telegram", editor_chat,
                     f"New Telegram lead {report.public_id}: {report.text_original[:240]}")
    return report.id if created else None


def _handle_draft(db: Session, draft: TelegramDraft, message: dict, contact: str,
                  chat_id: int, consent, fetch_photo) -> int | None:
    body = (message.get("text") or message.get("caption") or "").strip()
    photo = message.get("photo") or []
    location = message.get("location") or {}

    if draft.state == "category":
        choice = CATEGORY_ALIASES.get(body.lower(), body)
        if choice not in CATEGORIES:
            _send(db, chat_id, "Please reply 1, 2, 3, 4, or 5 for the hazard type.")
            return None
        draft.category_key = CATEGORIES[choice][0]
        draft.state = "road"
        _send(db, chat_id, f"Step 2 of 6 - Road or area\nType the road, street, or area where the {CATEGORIES[choice][1].lower()} is located.")
        return None

    if draft.state == "road":
        value = clean_text(body, 200)
        if len(value) < 2:
            _send(db, chat_id, "Please type the road, street, or area name.")
            return None
        draft.road_area = value
        draft.state = "landmark"
        _send(db, chat_id, "Step 3 of 6 - Exact landmark\nType a nearby junction, turn-off, building, or kilometre peg.")
        return None

    if draft.state == "landmark":
        value = clean_text(body, 200)
        if len(value) < 2:
            _send(db, chat_id, "Please provide a specific landmark so editors can locate the hazard.")
            return None
        draft.landmark = value
        draft.state = "observed"
        _send(db, chat_id,
              "Step 4 of 6 - Observation time\nWhen did you see it? Reply NOW, YESTERDAY, or use YYYY-MM-DD HH:MM.")
        return None

    if draft.state == "observed":
        observed = _parse_observed(body)
        if observed is None:
            _send(db, chat_id, "Use NOW, YESTERDAY, or a date within the last 30 days as YYYY-MM-DD HH:MM.")
            return None
        draft.observed_at = observed
        draft.state = "description"
        _send(db, chat_id,
              "Step 5 of 6 - Description\nDescribe what happened, which lane is affected, and any immediate danger (at least 12 characters).")
        return None

    if draft.state == "description":
        value = clean_text(body, 1500)
        if len(value) < 12:
            _send(db, chat_id, "Please add a little more detail (at least 12 characters).")
            return None
        draft.description = value
        draft.state = "evidence"
        _send(db, chat_id,
              "Step 6 of 6 - Optional evidence\nSend a photo and/or Telegram location pin. When ready, reply SUBMIT. Reply SUBMIT now to continue without evidence.")
        return None

    if draft.state == "evidence":
        added = []
        if photo:
            draft.photo_file_id = photo[-1].get("file_id")
            if draft.photo_file_id:
                added.append("photo")
        if location.get("latitude") is not None and location.get("longitude") is not None:
            draft.lat, draft.lng = location["latitude"], location["longitude"]
            added.append("location")
        if added:
            _send(db, chat_id, f"Added {' and '.join(added)}. Send more evidence or reply SUBMIT.")
            return None
        if body.lower() in {"submit", "done", "skip"}:
            return _finish_draft(db, draft, contact, chat_id, consent, fetch_photo)
        _send(db, chat_id, "Send a photo/location pin, or reply SUBMIT to file the report.")
    return None


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
    draft = _draft(db, contact)

    if command in {"/stop", "stop", "/unsubscribe"}:
        if draft:
            db.delete(draft)
        revoke_consent(db, contact, "telegram")
        _send(db, chat_id, "Panzira: consent withdrawn. We will not store new reports from this chat.")
        return None
    if not consent:
        if body.lower() in {"yes", "y", "hongu", "ehe", "yebo"}:
            record_consent(db, contact, "telegram", "en", allow_followup=True)
            _send(db, chat_id, "Thank you. Your answers will be stored only for newsroom review. Reply STOP at any time to withdraw consent.")
            _start_draft(db, contact, chat_id)
        else:
            _send(db, chat_id, "Panzira can store your road-safety report for newsroom review and follow up about it. Reply YES to consent. Reply STOP at any time to withdraw.")
        return None

    if command in {"/cancel", "cancel"}:
        if draft:
            db.delete(draft)
        _send(db, chat_id, "Report cancelled. Send /report when you are ready to start again.")
        return None
    if command in {"/start", "/report", "report"}:
        _start_draft(db, contact, chat_id)
        return None
    if command in {"/help", "help"}:
        _send(db, chat_id,
              "Send /report to start the six-step road incident form. Send /cancel to discard a draft or STOP to withdraw consent.")
        return None
    if draft:
        return _handle_draft(db, draft, message, contact, chat_id, consent, fetch_photo)

    # Backward-compatible quick report for an already-consented user who sends a
    # hazard directly instead of opening /report.
    if not limiter.check(f"telegram-report:{contact}", 10, 3600):
        _send(db, chat_id, "Panzira: report limit reached. Please try again later.")
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
