from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..db import get_db
from ..models import Role, User, aware, utcnow
from ..security import (Actor, admin_only, client_ip, create_access_token, current_actor, hash_password, rate_limit,
                        verify_password)

router = APIRouter(prefix="/api/v1", tags=["auth"])


class LoginIn(BaseModel):
    email: str
    password: str


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


def _public(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "role": u.role, "canViewGraphic": u.can_view_graphic,
            "active": u.active}


@router.post("/auth/login", dependencies=[Depends(rate_limit("login", 10, 300))])
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    u = db.execute(select(User).where(User.email == body.email.lower().strip())).scalar_one_or_none()
    ip = client_ip(request)
    generic = HTTPException(401, "Invalid email or password")
    if not u or not u.active:
        raise generic
    if u.locked_until and aware(u.locked_until) > utcnow():
        raise HTTPException(423, "Account temporarily locked. Try again later.")
    if not verify_password(body.password, u.password_hash):
        u.failed_logins += 1
        if u.failed_logins >= 5:
            u.locked_until, u.failed_logins = utcnow() + timedelta(minutes=15), 0
        audit.record(db, Actor.from_user(u), "login_failed", "user", u.id, ip=ip)
        db.commit()
        raise generic
    u.failed_logins, u.locked_until = 0, None
    audit.record(db, Actor.from_user(u), "login", "user", u.id, ip=ip)
    db.commit()
    return {"accessToken": create_access_token(u), "tokenType": "bearer", "user": _public(u)}


@router.get("/auth/me")
def me(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)):
    return _public(db.get(User, actor.id))


@router.post("/users", status_code=201)
def create_user(body: UserIn, request: Request, actor: Actor = Depends(admin_only), db: Session = Depends(get_db)):
    if body.role not in Role.ALL_HUMAN:
        raise HTTPException(422, "role must be journalist, editor or admin")
    email = body.email.lower().strip()
    if db.execute(select(User).where(User.email == email)).scalar_one_or_none():
        raise HTTPException(409, "Email already registered")
    u = User(email=email, name=body.name, role=body.role, password_hash=hash_password(body.password),
             can_view_graphic=body.can_view_graphic and body.role in (Role.EDITOR, Role.JOURNALIST))
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
        u.active = changes["active"] = body.active
    if body.can_view_graphic is not None:
        u.can_view_graphic = changes["can_view_graphic"] = body.can_view_graphic
    audit.record(db, actor, "user_updated", "user", u.id, changes, client_ip(request))
    db.commit()
    return _public(u)
