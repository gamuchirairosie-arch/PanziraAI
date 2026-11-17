import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .. import audit, workflow
from ..ai.images import ImageRejected
from ..ai.pipeline import process_report
from ..config import get_settings
from ..db import SessionLocal, get_db
from ..intake import VALID_ATTRIBUTION_MODES, VALID_LICENSE_TIERS, attach_image, clean_text, create_report
from ..integrations.telegram import send_approved_alert
from ..models import (
    AuditLog,
    DuplicateLink,
    Evidence,
    MediaLicenseTransaction,
    PublicAlert,
    Report,
    Role,
    Status,
    User,
    aware,
    utcnow,
)
from ..security import (
    Actor,
    bearer,
    check_tracking_token,
    citizen_or_above,
    client_ip,
    current_actor,
    editor_only,
    media_token,
    newsroom,
    rate_limit,
)
from ..serializers import to_signal
from ..i18n import STATUS_TEXT

router = APIRouter(prefix="/api/v1", tags=["reports"])
_REF = re.compile(r"^(?:#?(?:PZ-SIG-|PZ-DEMO-|PZ-|ROADS-))?(\d{1,6})$", re.IGNORECASE)
LOCK_DURATION = timedelta(minutes=30)


def _bg_process(report_id: int) -> None:
    db = SessionLocal()
    try:
        process_report(db, report_id)
    finally:
        db.close()


def _get(db: Session, ref: str) -> Report:
    m = _REF.match((ref or "").strip())
    r = db.get(Report, int(m.group(1))) if m else None
    if not r:
        raise HTTPException(404, "Report not found")
    return r


def _is_locked_by_other(r: Report, actor: Actor) -> bool:
    if actor.role == Role.ADMIN:
        return False
    if not r.claimed_by_id or not r.claim_locked_until:
        return False
    locked_until = aware(r.claim_locked_until)
    if not locked_until or locked_until <= utcnow():
        return False
    return r.claimed_by_id != actor.id


def _enforce_signal_lock(db: Session, r: Report, actor: Actor, *, is_verify: bool = False) -> None:
    if not _is_locked_by_other(r, actor):
        return
    if is_verify and actor.role in (Role.EDITOR, Role.ADMIN) and r.status == Status.EDITOR_APPROVAL:
        holder = db.get(User, r.claimed_by_id) if r.claimed_by_id else None
        explicit_claim = db.execute(
            select(AuditLog.id)
            .where(
                AuditLog.action == "signal_claimed",
                AuditLog.entity_id.in_([str(r.id), r.public_id]),
                AuditLog.actor_id == r.claimed_by_id,
            )
            .limit(1)
        ).scalar_one_or_none()
        if holder and holder.role == Role.JOURNALIST and explicit_claim is None:
            return
    locked_str = aware(r.claim_locked_until).isoformat() if r.claim_locked_until else ""
    holder_name = r.claimed_by_name or f"User #{r.claimed_by_id}"
    raise HTTPException(409, f"Locked by {holder_name} until {locked_str}")


def _acquire_signal_lock(db: Session, r: Report, actor: Actor) -> None:
    now = utcnow()
    media_house = actor.media_house
    if not media_house and actor.id:
        u = db.get(User, actor.id)
        media_house = u.media_house if u else None
    r.claimed_by_id = actor.id
    r.claimed_by_name = actor.label
    r.claimed_by_media_house = media_house
    r.claim_locked_until = now + LOCK_DURATION


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
    license_tier: str = Form("safety_only"),
    attribution_mode: str = Form("anonymous"),
    photo: UploadFile | None = File(None),
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
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
    if license_tier not in VALID_LICENSE_TIERS:
        raise HTTPException(422, f"license_tier must be one of {sorted(VALID_LICENSE_TIERS)}")
    if attribution_mode not in VALID_ATTRIBUTION_MODES:
        raise HTTPException(422, f"attribution_mode must be one of {sorted(VALID_ATTRIBUTION_MODES)}")

    contributor_id = None
    if creds is not None:
        try:
            actor_opt = current_actor(creds=creds, db=db)
            contributor_id = actor_opt.id
        except HTTPException:
            pass

    actor = Actor.system("system:web-intake")
    r, token, _ = create_report(
        db, channel="web", text=description, actor=actor, language=language, category_key=category_key,
        road_area=road_area, landmark=landmark, lat=lat, lng=lng, observed_at=obs, source_url=evidence_link,
        contact=contact_phone, allow_followup=allow_followup and bool(contact_phone),
        reporter_flagged_graphic=contains_graphic, want_tracking_token=True,
        contributor_id=contributor_id, license_tier=license_tier, attribution_mode=attribution_mode,
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
    return {
        "id": r.public_id,
        "trackingToken": token,
        "claimPin": r.claim_pin,
        "claim_pin": r.claim_pin,
        "licenseTier": r.license_tier,
        "license_tier": r.license_tier,
        "attributionMode": r.attribution_mode,
        "attribution_mode": r.attribution_mode,
        "aiScanVerdict": r.ai_scan_verdict,
        "ai_scan_verdict": r.ai_scan_verdict,
        "aiScanSummary": r.ai_scan_summary,
        "ai_scan_summary": r.ai_scan_summary,
        "commercialEligible": r.commercial_eligible,
        "commercial_eligible": r.commercial_eligible,
        "status": r.status,
        "message": "Report received and queued for editorial verification. It is not published.",
    }


class ClaimReportIn(BaseModel):
    reference: str | None = None
    ref: str | None = None
    report_ref: str | None = None
    id: str | None = None
    claim_pin: str | None = None
    claimPin: str | None = None
    pin: str | None = None
    license_tier: str | None = None
    licenseTier: str | None = None
    attribution_mode: str | None = None
    attributionMode: str | None = None


@router.post("/reports/claim")
def claim_guest_report(
    body: ClaimReportIn,
    request: Request,
    actor: Actor = Depends(citizen_or_above),
    db: Session = Depends(get_db),
):
    ref_val = (body.reference or body.ref or body.report_ref or body.id or "").strip()
    pin_val = (body.claim_pin or body.claimPin or body.pin or "").strip()
    if not ref_val or not pin_val:
        raise HTTPException(422, "reference and claim_pin are required")
    r = _get(db, ref_val)
    if not r.claim_pin or r.claim_pin != pin_val:
        raise HTTPException(400, "Invalid claim PIN for this report")
    if r.contributor_id is not None and r.contributor_id != actor.id:
        raise HTTPException(409, "Report has already been claimed by another contributor")

    lic_tier = body.license_tier or body.licenseTier
    attr_mode = body.attribution_mode or body.attributionMode
    if lic_tier is not None:
        if lic_tier not in VALID_LICENSE_TIERS:
            raise HTTPException(422, f"license_tier must be one of {sorted(VALID_LICENSE_TIERS)}")
        r.license_tier = lic_tier
    if attr_mode is not None:
        if attr_mode not in VALID_ATTRIBUTION_MODES:
            raise HTTPException(422, f"attribution_mode must be one of {sorted(VALID_ATTRIBUTION_MODES)}")
        r.attribution_mode = attr_mode

    r.contributor_id = actor.id
    workflow.add_timeline(
        db, r, actor,
        f"Report claimed by contributor {actor.label} (license_tier={r.license_tier}, attribution_mode={r.attribution_mode}).",
    )
    audit.record(
        db, actor, "report_claimed", "report", r.public_id,
        {"contributor_id": actor.id, "license_tier": r.license_tier, "attribution_mode": r.attribution_mode},
        client_ip(request),
    )
    db.commit()
    return {
        "id": r.public_id,
        "reference": r.public_id,
        "contributorId": r.contributor_id,
        "contributor_id": r.contributor_id,
        "licenseTier": r.license_tier,
        "license_tier": r.license_tier,
        "attributionMode": r.attribution_mode,
        "attribution_mode": r.attribution_mode,
        "commercialEligible": r.commercial_eligible,
        "commercial_eligible": r.commercial_eligible,
    }


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


@router.post("/signals/{ref}/claim")
def claim_signal(ref: str, request: Request, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    r = _get(db, ref)
    _enforce_signal_lock(db, r, actor)
    _acquire_signal_lock(db, r, actor)
    locked_iso = aware(r.claim_locked_until).isoformat() if r.claim_locked_until else None
    workflow.add_timeline(
        db, r, actor,
        f"Signal claimed for verification by {r.claimed_by_name} ({r.claimed_by_media_house or 'Panzira Newsroom'}) until {locked_iso}.",
    )
    audit.record(
        db, actor, "signal_claimed", "report", r.public_id,
        {"claimed_by_id": r.claimed_by_id, "claimed_by_name": r.claimed_by_name, "claim_locked_until": locked_iso},
        client_ip(request),
    )
    db.commit()
    return to_signal(db, r, actor)


@router.post("/signals/{ref}/release")
def release_signal(ref: str, request: Request, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    r = _get(db, ref)
    if _is_locked_by_other(r, actor):
        locked_str = aware(r.claim_locked_until).isoformat() if r.claim_locked_until else ""
        raise HTTPException(409, f"Locked by {r.claimed_by_name} until {locked_str}")
    prev_holder = r.claimed_by_name
    r.claimed_by_id = None
    r.claimed_by_name = None
    r.claimed_by_media_house = None
    r.claim_locked_until = None
    workflow.add_timeline(db, r, actor, f"Verification lock released by {actor.label}.")
    audit.record(db, actor, "signal_released", "report", r.public_id, {"previous_holder": prev_holder}, client_ip(request))
    db.commit()
    return to_signal(db, r, actor)


class ChecklistIn(BaseModel):
    item: str = Field(
        pattern="^(locationAndTime|mediaAndDate|independentSource|hazardStillPresent|humanVisualAiCheck|human_visual_ai_check|translationReviewed|translation_reviewed|translationVerified|translation_verified)$"
    )
    value: bool


_CHK = {
    "locationAndTime": "chk_location_time",
    "mediaAndDate": "chk_media_date",
    "independentSource": "chk_independent",
    "hazardStillPresent": "chk_still_present",
    "humanVisualAiCheck": "human_visual_ai_check",
    "human_visual_ai_check": "human_visual_ai_check",
    "translationReviewed": "translation_reviewed",
    "translation_reviewed": "translation_reviewed",
    "translationVerified": "translation_reviewed",
    "translation_verified": "translation_reviewed",
}


@router.post("/signals/{ref}/checklist")
def set_checklist(ref: str, body: ChecklistIn, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    r = _get(db, ref)
    _enforce_signal_lock(db, r, actor)
    now = utcnow()
    if not r.claimed_by_id or not r.claim_locked_until or aware(r.claim_locked_until) <= now:
        _acquire_signal_lock(db, r, actor)
    elif r.claimed_by_id == actor.id:
        r.claim_locked_until = now + LOCK_DURATION
    workflow.set_check(db, r, _CHK[body.item], body.value, actor)
    db.commit()
    return to_signal(db, r, actor)


class VisualAiCheckIn(BaseModel):
    human_visual_ai_check: bool = True
    humanVisualAiCheck: bool | None = None
    checked: bool | None = None
    passed: bool | None = None


@router.post("/signals/{ref}/visual-ai-check")
@router.post("/signals/{ref}/human-visual-check")
def set_visual_ai_check(
    ref: str,
    body: VisualAiCheckIn | None = Body(default=None),
    actor: Actor = Depends(newsroom),
    db: Session = Depends(get_db),
):
    r = _get(db, ref)
    _enforce_signal_lock(db, r, actor)
    val = True
    if body is not None:
        if body.passed is not None:
            val = body.passed
        elif body.checked is not None:
            val = body.checked
        elif body.humanVisualAiCheck is not None:
            val = body.humanVisualAiCheck
        else:
            val = body.human_visual_ai_check
    r.human_visual_ai_check = bool(val)
    audit.record(db, actor, "human_visual_ai_check_set", "report", r.public_id, {"human_visual_ai_check": r.human_visual_ai_check})
    workflow.add_timeline(
        db, r, actor,
        f"{'Confirmed' if r.human_visual_ai_check else 'Cleared'} mandatory human visual AI artifact inspection.",
    )
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
    humanVisualAiCheck: bool | None = None
    human_visual_ai_check: bool | None = None


@router.patch("/signals/{ref}/fields")
def edit_fields(ref: str, body: FieldsIn, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    """Humans correct the AI's suggestions (type, road, landmark, corridor, coordinates). Audited with before/after."""
    from ..ai.lexicon import CATEGORY_LABELS
    from ..corridors import BY_ID
    r = _get(db, ref)
    _enforce_signal_lock(db, r, actor)
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
    hv_check = body.humanVisualAiCheck if body.humanVisualAiCheck is not None else body.human_visual_ai_check
    if hv_check is not None and bool(hv_check) != bool(r.human_visual_ai_check):
        changes["human_visual_ai_check"] = [r.human_visual_ai_check, bool(hv_check)]
        r.human_visual_ai_check = bool(hv_check)
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
    _enforce_signal_lock(db, r, actor)
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


class VerifyIn(BaseModel):
    human_visual_ai_check: bool | None = None
    humanVisualAiCheck: bool | None = None


@router.post("/signals/{ref}/verify")
def verify(
    ref: str,
    background: BackgroundTasks,
    body: VerifyIn | None = Body(default=None),
    actor: Actor = Depends(editor_only),
    db: Session = Depends(get_db),
):
    """The ONLY route that can create a public alert. Editor/Admin role + all gates enforced in workflow.publish."""
    r = _get(db, ref)
    _enforce_signal_lock(db, r, actor, is_verify=True)
    if body is not None:
        hv = body.humanVisualAiCheck if body.humanVisualAiCheck is not None else body.human_visual_ai_check
        if hv is not None:
            r.human_visual_ai_check = bool(hv)
    alert = workflow.publish(db, r, actor)
    db.commit()
    background.add_task(send_approved_alert, alert.id)
    return {"signal": to_signal(db, r, actor), "alertId": alert.public_code}


class LicenseMediaIn(BaseModel):
    license_type: str | None = None
    licenseType: str | None = None
    tier: str | None = None
    media_house: str | None = None
    mediaHouse: str | None = None


@router.post("/signals/{ref}/license-media")
@router.post("/signals/{ref}/license")
def license_media(
    ref: str,
    body: LicenseMediaIn,
    request: Request,
    actor: Actor = Depends(newsroom),
    db: Session = Depends(get_db),
):
    r = _get(db, ref)
    if r.license_tier != "commercial_pool":
        raise HTTPException(409, "Report media is not opted into the commercial_pool license tier")
    if not r.commercial_eligible:
        raise HTTPException(
            409,
            "Report media is not eligible for commercial licensing (flagged by AI forensics, screen recapture, or duplicate)",
        )
    if not r.human_visual_ai_check:
        raise HTTPException(
            409,
            "Mandatory human visual AI inspection check (human_visual_ai_check) must be completed before licensing media",
        )

    raw_type = (body.license_type or body.licenseType or body.tier or "standard_5").strip().lower()
    if raw_type in ("standard", "standard_5"):
        lic_type = "standard_5"
        gross_usd = 5.0
        contributor_share_usd = 3.5
        platform_fee_usd = 1.5
    elif raw_type in ("exclusive", "exclusive_15"):
        lic_type = "exclusive_15"
        gross_usd = 15.0
        contributor_share_usd = 10.5
        platform_fee_usd = 4.5
    else:
        raise HTTPException(422, "license_type must be 'standard_5' or 'exclusive_15'")

    user_row = db.get(User, actor.id) if actor.id else None
    media_house = (
        body.media_house
        or body.mediaHouse
        or actor.media_house
        or (user_row.media_house if user_row else None)
        or "Accredited Newsroom"
    ).strip()

    now = utcnow()
    if r.exclusive_until and aware(r.exclusive_until) > now:
        if r.exclusive_license_holder and r.exclusive_license_holder.lower() != media_house.lower():
            raise HTTPException(
                409,
                f"Media is under an active 24h exclusive lock by {r.exclusive_license_holder} until {aware(r.exclusive_until).isoformat()}",
            )

    if lic_type == "exclusive_15":
        r.exclusive_license_holder = media_house
        r.exclusive_until = now + timedelta(hours=24)

    contributor = db.get(User, r.contributor_id) if r.contributor_id else None
    if contributor is not None:
        contributor.royalty_balance_usd = round(float(contributor.royalty_balance_usd or 0.0) + contributor_share_usd, 2)

    settlement_ref = f"PZ-LIC-{uuid.uuid4().hex[:10].upper()}"
    tx = MediaLicenseTransaction(
        report_ref=r.public_id,
        contributor_id=r.contributor_id,
        journalist_id=actor.id,
        media_house=media_house,
        license_type=lic_type,
        gross_amount_usd=gross_usd,
        contributor_share_usd=contributor_share_usd,
        platform_fee_usd=platform_fee_usd,
        settlement_status="settled",
        settlement_ref=settlement_ref,
    )
    db.add(tx)
    db.flush()

    ev = db.execute(select(Evidence).where(Evidence.report_id == r.id).order_by(Evidence.created_at)).scalars().first()
    clean_token = media_token(ev.id if ev else r.public_id, "full", actor.id or 0, minutes=60, reveal=True)
    clean_url = f"/api/v1/evidence/{ev.id}/full?t={clean_token}" if ev else None

    workflow.add_timeline(
        db, r, actor,
        f"Media licensed ({lic_type}) by {media_house} (${gross_usd:.2f} USD; +${contributor_share_usd:.2f} USD to contributor).",
    )
    audit.record(
        db, actor, "media_licensed", "report", r.public_id,
        {
            "transaction_id": tx.id,
            "settlement_ref": settlement_ref,
            "license_type": lic_type,
            "media_house": media_house,
            "gross_amount_usd": gross_usd,
            "contributor_share_usd": contributor_share_usd,
            "platform_fee_usd": platform_fee_usd,
            "contributor_id": r.contributor_id,
        },
        client_ip(request),
    )
    db.commit()

    new_balance = round(float(contributor.royalty_balance_usd or 0.0), 2) if contributor else None
    return {
        "transactionId": tx.id,
        "transaction_id": tx.id,
        "settlementRef": tx.settlement_ref,
        "settlement_ref": tx.settlement_ref,
        "reportRef": r.public_id,
        "report_ref": r.public_id,
        "licenseType": tx.license_type,
        "license_type": tx.license_type,
        "mediaHouse": tx.media_house,
        "media_house": tx.media_house,
        "grossAmountUsd": tx.gross_amount_usd,
        "gross_amount_usd": tx.gross_amount_usd,
        "contributorShareUsd": tx.contributor_share_usd,
        "contributor_share_usd": tx.contributor_share_usd,
        "platformFeeUsd": tx.platform_fee_usd,
        "platform_fee_usd": tx.platform_fee_usd,
        "settlementStatus": tx.settlement_status,
        "settlement_status": tx.settlement_status,
        "contributorBalanceUsd": new_balance,
        "contributor_balance_usd": new_balance,
        "exclusiveLicenseHolder": r.exclusive_license_holder,
        "exclusive_license_holder": r.exclusive_license_holder,
        "exclusiveUntil": aware(r.exclusive_until).isoformat() if r.exclusive_until else None,
        "exclusive_until": aware(r.exclusive_until).isoformat() if r.exclusive_until else None,
        "mediaAccessToken": clean_token,
        "media_access_token": clean_token,
        "downloadUrl": clean_url,
        "download_url": clean_url,
    }


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
