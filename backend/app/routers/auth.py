from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..db import get_db
from ..models import Report, Role, TimelineEvent, User, aware, utcnow
from ..security import (Actor, admin_only, client_ip, create_access_token, current_actor, hash_password, rate_limit,
                        verify_password)

router = APIRouter(prefix="/api/v1", tags=["auth"])

VALID_LICENSE_TIERS = ("safety_only", "free_attribution", "commercial_pool")
VALID_ATTRIBUTION_MODES = ("full_name", "handle", "anonymous")


def resolve_report_by_ref(db: Session, ref: str) -> Report | None:
    if not ref:
        return None
    cleaned = ref.strip().lstrip("#").strip()
    try:
        rid = int(cleaned.split("-")[-1]) if "-" in cleaned else int(cleaned)
    except ValueError:
        return None
    return db.get(Report, rid)


class LoginIn(BaseModel):
    email: str
    password: str


class CitizenRegisterIn(BaseModel):
    email: str = Field(max_length=255)
    name: str | None = Field(default=None, max_length=120)
    full_name: str | None = Field(default=None, max_length=120)
    password: str = Field(min_length=6, max_length=200)
    handle: str | None = Field(default=None, max_length=80)
    phone: str | None = Field(default=None, max_length=40)
    claim_reference: str | None = None
    claimReference: str | None = None
    claim_pin: str | None = None
    claimPin: str | None = None
    license_tier: str | None = None
    licenseTier: str | None = None
    attribution_mode: str | None = None
    attributionMode: str | None = None


class JournalistRegisterIn(BaseModel):
    email: str = Field(max_length=255)
    name: str | None = Field(default=None, max_length=120)
    full_name: str | None = Field(default=None, max_length=120)
    password: str = Field(min_length=6, max_length=200)
    media_house: str | None = Field(default=None, max_length=160)
    mediaHouse: str | None = Field(default=None, max_length=160)
    zmc_number: str | None = Field(default=None, max_length=80)
    zmcNumber: str | None = Field(default=None, max_length=80)
    press_card_url: str | None = Field(default=None, max_length=500)
    pressCardUrl: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=40)


class JournalistDecisionIn(BaseModel):
    decision: str | None = None
    approved: bool | None = None
    status: str | None = None
    action: str | None = None
    reason: str | None = Field(default=None, max_length=500)
    can_view_graphic: bool | None = None


class UserIn(BaseModel):
    email: str = Field(max_length=255)
    name: str = Field(min_length=2, max_length=120)
    role: str
    password: str = Field(min_length=10, max_length=200)
    can_view_graphic: bool = False


class UserPatch(BaseModel):
    role: str | None = None
    active: bool | None = None
    can_view_graphic: bool | None = None
    verification_status: str | None = None


def _public(u: User) -> dict:
    display_name = u.name or u.full_name or u.email
    v_status = u.verification_status or "verified"
    balance = round(float(u.royalty_balance_usd or 0.0), 2)
    return {
        "id": u.id,
        "email": u.email,
        "name": display_name,
        "full_name": u.full_name or display_name,
        "role": u.role,
        "handle": u.handle,
        "phone": u.phone,
        "media_house": u.media_house,
        "mediaHouse": u.media_house,
        "zmc_number": u.zmc_number,
        "zmcNumber": u.zmc_number,
        "press_card_url": u.press_card_url,
        "pressCardUrl": u.press_card_url,
        "verification_status": v_status,
        "verificationStatus": v_status,
        "royalty_balance_usd": balance,
        "royaltyBalanceUsd": balance,
        "canViewGraphic": bool(u.can_view_graphic),
        "active": bool(u.active),
        "is_active": bool(u.is_active if u.is_active is not None else u.active),
        "created_at": aware(u.created_at).isoformat() if u.created_at else None,
    }


@router.post("/auth/login", dependencies=[Depends(rate_limit("login", 10, 300))])
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    u = db.execute(select(User).where(User.email == body.email.lower().strip())).scalar_one_or_none()
    ip = client_ip(request)
    generic = HTTPException(401, "Invalid email or password")
    if not u:
        raise generic
    if u.locked_until and aware(u.locked_until) > utcnow():
        raise HTTPException(423, "Account temporarily locked. Try again later.")
    stored_pw = u.password_hash or u.hashed_password
    if not verify_password(body.password, stored_pw):
        u.failed_logins = (u.failed_logins or 0) + 1
        if u.failed_logins >= 5:
            u.locked_until, u.failed_logins = utcnow() + timedelta(minutes=15), 0
        audit.record(db, Actor.from_user(u), "login_failed", "user", u.id, ip=ip)
        db.commit()
        raise generic
    if (u.verification_status or "verified") != "verified":
        raise HTTPException(403, f"Account verification status is '{u.verification_status}'. Admin approval required.")
    if not u.active:
        raise generic
    u.failed_logins, u.locked_until = 0, None
    audit.record(db, Actor.from_user(u), "login", "user", u.id, ip=ip)
    db.commit()
    token = create_access_token(u)
    return {
        "accessToken": token,
        "access_token": token,
        "tokenType": "bearer",
        "token_type": "bearer",
        "user": _public(u),
    }


@router.post("/auth/register/citizen", status_code=201)
def register_citizen(body: CitizenRegisterIn, request: Request, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    if db.execute(select(User).where(User.email == email)).scalar_one_or_none():
        raise HTTPException(409, "Email already registered")
    display_name = (body.name or body.full_name or email.split("@")[0]).strip()
    if len(display_name) < 2:
        raise HTTPException(422, "Name must be at least 2 characters")

    claim_ref = (body.claim_reference or body.claimReference or "").strip()
    claim_pin = (body.claim_pin or body.claimPin or "").strip()
    lic_tier = body.license_tier or body.licenseTier
    attr_mode = body.attribution_mode or body.attributionMode

    target_report: Report | None = None
    if claim_ref or claim_pin:
        if not (claim_ref and claim_pin):
            raise HTTPException(400, "Both claim_reference and claim_pin are required to claim a report")
        target_report = resolve_report_by_ref(db, claim_ref)
        if not target_report or not target_report.claim_pin or target_report.claim_pin != claim_pin:
            raise HTTPException(400, "Invalid claim reference or PIN")
        if target_report.contributor_id is not None:
            raise HTTPException(409, "Report has already been claimed")

    if lic_tier and lic_tier not in VALID_LICENSE_TIERS:
        raise HTTPException(422, f"license_tier must be one of {VALID_LICENSE_TIERS}")
    if attr_mode and attr_mode not in VALID_ATTRIBUTION_MODES:
        raise HTTPException(422, f"attribution_mode must be one of {VALID_ATTRIBUTION_MODES}")

    pw_hash = hash_password(body.password)
    u = User(
        email=email,
        name=display_name,
        full_name=display_name,
        role=Role.CITIZEN,
        handle=body.handle.strip() if body.handle else None,
        phone=body.phone.strip() if body.phone else None,
        verification_status="verified",
        royalty_balance_usd=0.0,
        password_hash=pw_hash,
        hashed_password=pw_hash,
        can_view_graphic=False,
        active=True,
        is_active=True,
    )
    db.add(u)
    db.flush()

    actor = Actor.from_user(u)
    ip = client_ip(request)
    audit.record(db, actor, "citizen_registered", "user", u.id, {"email": u.email, "handle": u.handle}, ip)

    claimed_ref = None
    if target_report is not None:
        target_report.contributor_id = u.id
        if lic_tier:
            target_report.license_tier = lic_tier
        if attr_mode:
            target_report.attribution_mode = attr_mode
        claimed_ref = target_report.public_id
        db.add(TimelineEvent(
            report_id=target_report.id,
            actor_label=u.name,
            description=f"Guest report claimed by citizen contributor #{u.id} (license: {target_report.license_tier}).",
        ))
        audit.record(
            db, actor, "report_claimed_on_register", "report", target_report.public_id,
            {"contributor_id": u.id, "license_tier": target_report.license_tier, "attribution_mode": target_report.attribution_mode},
            ip,
        )

    db.commit()
    token = create_access_token(u)
    return {
        "accessToken": token,
        "access_token": token,
        "tokenType": "bearer",
        "token_type": "bearer",
        "user": _public(u),
        "claimedReport": claimed_ref,
        "claimed_report": claimed_ref,
    }


@router.post("/auth/register/journalist", status_code=201)
def register_journalist(body: JournalistRegisterIn, request: Request, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    if db.execute(select(User).where(User.email == email)).scalar_one_or_none():
        raise HTTPException(409, "Email already registered")
    display_name = (body.name or body.full_name or email.split("@")[0]).strip()
    media_house = (body.media_house or body.mediaHouse or "").strip()
    zmc_number = (body.zmc_number or body.zmcNumber or "").strip()
    press_card_url = (body.press_card_url or body.pressCardUrl or "").strip() or None
    if not media_house or not zmc_number:
        raise HTTPException(422, "media_house and zmc_number are required for journalist accreditation")

    pw_hash = hash_password(body.password)
    u = User(
        email=email,
        name=display_name,
        full_name=display_name,
        role=Role.JOURNALIST,
        phone=body.phone.strip() if body.phone else None,
        media_house=media_house,
        zmc_number=zmc_number,
        press_card_url=press_card_url,
        verification_status="pending_verification",
        royalty_balance_usd=0.0,
        password_hash=pw_hash,
        hashed_password=pw_hash,
        can_view_graphic=False,
        active=True,
        is_active=True,
    )
    db.add(u)
    db.flush()
    audit.record(
        db, Actor.from_user(u), "journalist_application_submitted", "user", u.id,
        {"media_house": media_house, "zmc_number": zmc_number},
        client_ip(request),
    )
    db.commit()
    return {
        "status": "pending_verification",
        "message": "Journalist accreditation application submitted. An administrator must verify your credentials before newsroom access is enabled.",
        "user": _public(u),
    }


@router.get("/admin/journalist-applications")
def list_journalist_applications(
    status: str | None = Query(default="pending_verification"),
    actor: Actor = Depends(admin_only),
    db: Session = Depends(get_db),
):
    q = select(User).where(User.role == Role.JOURNALIST).order_by(User.id.desc())
    if status and status != "all":
        q = q.where(User.verification_status == status)
    return [_public(u) for u in db.execute(q).scalars()]


@router.post("/admin/journalist-applications/{user_id}/decide")
def decide_journalist_application(
    user_id: int,
    body: JournalistDecisionIn,
    request: Request,
    actor: Actor = Depends(admin_only),
    db: Session = Depends(get_db),
):
    u = db.get(User, user_id)
    if not u or u.role != Role.JOURNALIST:
        raise HTTPException(404, "Journalist application not found")

    raw_decision = (body.decision or body.status or body.action or "").strip().lower()
    if body.approved is True or raw_decision in ("approve", "approved", "verified", "accept", "accepted"):
        u.verification_status = "verified"
        u.active = True
        u.is_active = True
        if body.can_view_graphic is not None:
            u.can_view_graphic = body.can_view_graphic
        outcome = "verified"
    elif body.approved is False or raw_decision in ("reject", "rejected", "deny", "denied"):
        u.verification_status = "rejected"
        u.active = False
        u.is_active = False
        outcome = "rejected"
    else:
        raise HTTPException(422, "Decision must be 'approve' or 'reject'")

    audit.record(
        db, actor, "journalist_application_decided", "user", u.id,
        {"decision": outcome, "reason": body.reason, "zmc_number": u.zmc_number, "media_house": u.media_house},
        client_ip(request),
    )
    db.commit()
    return _public(u)


@router.get("/auth/me")
def me(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)):
    return _public(db.get(User, actor.id))


@router.post("/users", status_code=201)
def create_user(body: UserIn, request: Request, actor: Actor = Depends(admin_only), db: Session = Depends(get_db)):
    if body.role not in Role.ALL_HUMAN:
        raise HTTPException(422, "role must be citizen, journalist, editor or admin")
    email = body.email.lower().strip()
    if db.execute(select(User).where(User.email == email)).scalar_one_or_none():
        raise HTTPException(409, "Email already registered")
    pw_hash = hash_password(body.password)
    u = User(
        email=email,
        name=body.name,
        full_name=body.name,
        role=body.role,
        password_hash=pw_hash,
        hashed_password=pw_hash,
        verification_status="verified",
        can_view_graphic=body.can_view_graphic and body.role in (Role.EDITOR, Role.JOURNALIST),
    )
    db.add(u)
    db.flush()
    audit.record(db, actor, "user_created", "user", u.id, {"role": u.role}, client_ip(request))
    db.commit()
    return _public(u)


@router.get("/users")
def list_users(actor: Actor = Depends(admin_only), db: Session = Depends(get_db)):
    return [_public(u) for u in db.execute(select(User).order_by(User.id)).scalars()]


@router.patch("/users/{uid}")
def patch_user(uid: int, body: UserPatch, request: Request, actor: Actor = Depends(admin_only),
               db: Session = Depends(get_db)):
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "User not found")
    changes = {}
    if body.role is not None:
        if body.role not in Role.ALL_HUMAN:
            raise HTTPException(422, "Invalid role")
        u.role = changes["role"] = body.role
    if body.active is not None:
        u.active = u.is_active = changes["active"] = body.active
    if body.can_view_graphic is not None:
        u.can_view_graphic = changes["can_view_graphic"] = body.can_view_graphic
    if body.verification_status is not None:
        u.verification_status = changes["verification_status"] = body.verification_status
    audit.record(db, actor, "user_updated", "user", u.id, changes, client_ip(request))
    db.commit()
    return _public(u)
