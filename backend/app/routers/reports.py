import re
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .. import audit, workflow
from ..ai.images import ImageRejected
from ..ai.pipeline import process_report
from ..config import get_settings
from ..db import SessionLocal, get_db
from ..intake import attach_image, clean_text, create_report
from ..integrations.telegram import send_approved_alert
from ..models import DuplicateLink, PublicAlert, Report, Status, utcnow
from ..security import (Actor, check_tracking_token, client_ip, current_actor, editor_only, newsroom, rate_limit)
from ..serializers import to_signal
from ..i18n import STATUS_TEXT

router = APIRouter(prefix="/api/v1", tags=["reports"])
_REF = re.compile(r"^PZ-SIG-(\d{1,6})$")


def _bg_process(report_id: int) -> None:
    db = SessionLocal()
    try:
        process_report(db, report_id)
    finally:
        db.close()


def _get(db: Session, ref: str) -> Report:
    m = _REF.match(ref)
    r = db.get(Report, int(m.group(1))) if m else None
    if not r:
        raise HTTPException(404, "Report not found")
    return r


# ---------------- citizen intake ----------------
@router.post("/reports", status_code=201, dependencies=[Depends(rate_limit("submit", 8, 3600))])
async def submit_report(
    request: Request, background: BackgroundTasks,
    description: str = Form(..., min_length=5, max_length=1500),
    category_key: str | None = Form(None),
    road_area: str = Form("", max_length=200),
    landmark: str = Form("", max_length=200),
    language: str | None = Form(None),
    observed_at: str | None = Form(None),
    evidence_link: str | None = Form(None, max_length=1000),
    lat: float | None = Form(None, ge=-90, le=90),
    lng: float | None = Form(None, ge=-180, le=180),
    contains_graphic: bool = Form(False),
    contact_phone: str | None = Form(None, max_length=20),
    allow_followup: bool = Form(False),
    photo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    obs = None
    if observed_at:
        try:
            obs = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
            if obs.tzinfo is None:
                obs = obs.replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(422, "observed_at must be an ISO date-time")
        now = utcnow()
        if obs > now:
            raise HTTPException(422, "Observation time cannot be in the future")
        if (now - obs).days > 30:
            raise HTTPException(422, "Observation time is more than 30 days ago")
    if evidence_link and not re.match(r"^https?://", evidence_link):
        raise HTTPException(422, "evidence_link must be an http(s) URL")

    actor = Actor.system("system:web-intake")
    r, token, _ = create_report(
        db, channel="web", text=description, actor=actor, language=language, category_key=category_key,
        road_area=road_area, landmark=landmark, lat=lat, lng=lng, observed_at=obs, source_url=evidence_link,
        contact=contact_phone, allow_followup=allow_followup and bool(contact_phone),
        reporter_flagged_graphic=contains_graphic, want_tracking_token=True,
    )
    if photo is not None and photo.filename:
        data = await photo.read(get_settings().max_upload_mb * 1024 * 1024 + 1)
        try:
            attach_image(db, r, data, photo.filename, actor)
        except ImageRejected as e:
            db.rollback()
            raise HTTPException(422, str(e))
    db.commit()
    background.add_task(_bg_process, r.id)
    return {"id": r.public_id, "trackingToken": token, "status": r.status,
            "message": "Report received and queued for editorial verification. It is not published."}


@router.get("/reports/track/{ref}", dependencies=[Depends(rate_limit("track", 30, 300))])
def track(ref: str, token: str, lang: str = "en", db: Session = Depends(get_db)):
    r = _get(db, ref)
    if not check_tracking_token(token, r.tracking_token_hash):
        raise HTTPException(404, "Report not found")  # same error as unknown id
    return {"id": r.public_id, "status": r.status, "statusText": STATUS_TEXT[r.status].get(lang, STATUS_TEXT[r.status]["en"]),
            "receivedAt": workflow.fmt(r.created_at), "published": r.status == Status.PUBLISHED}


# ---------------- newsroom ----------------
@router.get("/signals")
def list_signals(
    status: str | None = None, channel: str | None = None, corridor: str | None = None, q: str | None = None,
    limit: int = 100, offset: int = 0, actor: Actor = Depends(newsroom), db: Session = Depends(get_db),
):
    stmt = select(Report).order_by(Report.created_at.desc())
    if status:
        stmt = stmt.where(Report.status == status)
    if channel:
        stmt = stmt.where(Report.channel == channel)
    if corridor:
        stmt = stmt.where(Report.corridor_id == corridor)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Report.text_original).like(like), func.lower(Report.road_area).like(like),
                              func.lower(Report.landmark).like(like)))
    rows = db.execute(stmt.limit(min(limit, 200)).offset(offset)).scalars().all()
    return [to_signal(db, r, actor) for r in rows]


@router.get("/signals/{ref}")
def get_signal(ref: str, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    return to_signal(db, _get(db, ref), actor)


class ChecklistIn(BaseModel):
    item: str = Field(pattern="^(locationAndTime|mediaAndDate|independentSource|hazardStillPresent)$")
    value: bool


_CHK = {"locationAndTime": "chk_location_time", "mediaAndDate": "chk_media_date",
        "independentSource": "chk_independent", "hazardStillPresent": "chk_still_present"}


@router.post("/signals/{ref}/checklist")
def set_checklist(ref: str, body: ChecklistIn, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    r = _get(db, ref)
    workflow.set_check(db, r, _CHK[body.item], body.value, actor)
    db.commit()
    return to_signal(db, r, actor)


class FieldsIn(BaseModel):
    categoryKey: str | None = Field(None, pattern="^(potholes|flooding|collisions|visibility|other)$")
    roadArea: str | None = Field(None, max_length=200)
    landmark: str | None = Field(None, max_length=200)
    corridorId: str | None = Field(None, max_length=30)
    severityLabel: str | None = Field(None, pattern="^(Review needed|Moderate|High|Critical)$")
    lat: float | None = Field(None, ge=-90, le=90)
    lng: float | None = Field(None, ge=-180, le=180)


@router.patch("/signals/{ref}/fields")
def edit_fields(ref: str, body: FieldsIn, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    """Humans correct the AI's suggestions (type, road, landmark, corridor, coordinates). Audited with before/after."""
    from ..ai.lexicon import CATEGORY_LABELS
    from ..corridors import BY_ID
    r = _get(db, ref)
    if r.status in (Status.PUBLISHED, Status.REJECTED):
        raise HTTPException(409, "Report is closed; reopen it first")
    changes = {}
    if body.categoryKey and body.categoryKey != r.category_key:
        changes["category_key"] = [r.category_key, body.categoryKey]
        r.category_key, r.category_label, r.category_source = body.categoryKey, CATEGORY_LABELS[body.categoryKey], "reporter"
    for attr, val in (("road_area", body.roadArea), ("landmark", body.landmark)):
        if val is not None and clean_text(val, 200) != getattr(r, attr):
            changes[attr] = [getattr(r, attr), clean_text(val, 200)]
            setattr(r, attr, clean_text(val, 200))
    if body.corridorId is not None:
        if body.corridorId and body.corridorId not in BY_ID:
            raise HTTPException(422, "Unknown corridor")
        changes["corridor_id"] = [r.corridor_id, body.corridorId or None]
        r.corridor_id = body.corridorId or None
    if body.severityLabel:
        changes["severity"] = [r.severity_label, body.severityLabel]
        r.severity_label = body.severityLabel
        r.is_critical = body.severityLabel == "Critical"
    if body.lat is not None and body.lng is not None:
        changes["coordinates"] = [[r.lat, r.lng], [body.lat, body.lng]]
        r.lat, r.lng, r.gps_reported = body.lat, body.lng, True
        r.location_precision = "Coordinates set by editor"
    if changes:
        audit.record(db, actor, "fields_edited", "report", r.id, changes)
        workflow.add_timeline(db, r, actor, "Corrected AI-suggested details: " + ", ".join(changes))
    db.commit()
    return to_signal(db, r, actor)


class NotesIn(BaseModel):
    notes: str = Field(max_length=5000)


@router.put("/signals/{ref}/notes")
def set_notes(ref: str, body: NotesIn, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    r = _get(db, ref)
    r.editorial_notes = clean_text(body.notes, 5000)
    audit.record(db, actor, "notes_updated", "report", r.id, {"length": len(r.editorial_notes)})
    db.commit()
    return {"ok": True}


class NoteIn(BaseModel):
    note: str | None = Field(None, max_length=500)


@router.post("/signals/{ref}/request-evidence")
def request_evidence(ref: str, body: NoteIn, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    r = _get(db, ref)
    workflow.request_evidence(db, r, actor, clean_text(body.note, 500) or None)
    db.commit()
    return to_signal(db, r, actor)


class TranslationIn(BaseModel):
    english: str = Field(min_length=3, max_length=1500)


@router.post("/signals/{ref}/translation/review")
def review_translation(ref: str, body: TranslationIn, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    """A human supplies/approves the English translation. Required before a sn/nd report can be published."""
    r = _get(db, ref)
    r.text_english = clean_text(body.english, 1500)
    r.translation_method, r.translation_reviewed, r.translation_reviewed_by = "human-reviewed", True, actor.id
    audit.record(db, actor, "translation_reviewed", "report", r.id)
    workflow.add_timeline(db, r, actor, "English translation reviewed and confirmed by a human.")
    db.commit()
    return to_signal(db, r, actor)


@router.post("/signals/{ref}/reject")
def reject(ref: str, body: NoteIn, actor: Actor = Depends(editor_only), db: Session = Depends(get_db)):
    r = _get(db, ref)
    workflow.reject(db, r, actor, clean_text(body.note, 500) or None)
    db.commit()
    return to_signal(db, r, actor)


@router.post("/signals/{ref}/verify")
def verify(ref: str, background: BackgroundTasks, actor: Actor = Depends(editor_only), db: Session = Depends(get_db)):
    """The ONLY route that can create a public alert. Editor role + all gates enforced in workflow.publish."""
    r = _get(db, ref)
    alert = workflow.publish(db, r, actor)
    db.commit()
    background.add_task(send_approved_alert, alert.id)
    return {"signal": to_signal(db, r, actor), "alertId": alert.public_code}


@router.post("/signals/{ref}/reprocess")
def reprocess(ref: str, background: BackgroundTasks, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    r = _get(db, ref)
    if r.status != Status.RECEIVED:
        raise HTTPException(409, "Only reports still at 'received' can be re-run")
    audit.record(db, actor, "reprocess_requested", "report", r.id)
    db.commit()
    background.add_task(_bg_process, r.id)
    return {"queued": True}


@router.post("/signals/{ref}/reopen")
def reopen(ref: str, actor: Actor = Depends(editor_only), db: Session = Depends(get_db)):
    r = _get(db, ref)
    workflow.transition(db, r, Status.AI_EXTRACTED, actor, "reopened by editor")
    workflow.add_timeline(db, r, actor, "Report reopened for review.")
    db.commit()
    return to_signal(db, r, actor)


@router.post("/signals/{ref}/duplicates/{other}/dismiss")
def dismiss_duplicate(ref: str, other: str, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    a, b = _get(db, ref), _get(db, other)
    link = db.execute(select(DuplicateLink).where(
        or_((DuplicateLink.report_id == a.id) & (DuplicateLink.other_id == b.id),
            (DuplicateLink.report_id == b.id) & (DuplicateLink.other_id == a.id)))).scalar_one_or_none()
    if not link:
        raise HTTPException(404, "No such duplicate link")
    link.dismissed = True
    audit.record(db, actor, "duplicate_dismissed", "report", a.id, {"other": b.public_id})
    db.commit()
    return {"ok": True}


@router.get("/stats")
def stats(actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    total = db.scalar(select(func.count(Report.id)))
    optin = db.scalar(select(func.count(Report.id)).where(Report.visibility == "opt-in"))
    awaiting = db.scalar(select(func.count(Report.id)).where(Report.status.in_(
        [Status.RECEIVED, Status.AI_EXTRACTED, Status.CORROBORATION, Status.EDITOR_APPROVAL])))
    alerts = db.scalar(select(func.count(PublicAlert.id)).where(PublicAlert.withdrawn_at.is_(None)))
    last = db.execute(select(PublicAlert).order_by(PublicAlert.approved_at.desc())).scalars().first()
    return {
        "totalSignalsCount": total, "optInSignalsCount": optin, "publicSignalsCount": total - optin,
        "awaitingReviewCount": awaiting, "approvedAlertsCount": alerts,
        # structurally zero: public_alerts.approved_by_id is NOT NULL and only editors can create one
        "autoPublishedByAiCount": 0,
        "lastEditorialUpdateTime": workflow.fmt(last.approved_at)[-5:] + " CAT" if last else None,
    }
