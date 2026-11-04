import base64
import hashlib
import hmac
import secrets
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable

import jwt
from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import Role, User

settings = get_settings()
bearer = HTTPBearer(auto_error=False)

# ---------- passwords (PBKDF2-HMAC-SHA256, per-user salt) ----------
_ITER = 310_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITER)
    return f"pbkdf2${_ITER}${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, it, salt_b64, dk_b64 = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt_b64), int(it))
        return hmac.compare_digest(dk, base64.b64decode(dk_b64))
    except Exception:
        return False


# ---------- tokens ----------
def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


@dataclass
class Actor:
    """Who is performing an action. `id` is None for the system pipeline."""
    id: int | None
    label: str
    role: str
    can_view_graphic: bool = False

    @classmethod
    def system(cls, label: str = "system:pipeline") -> "Actor":
        return cls(None, label, Role.SYSTEM)

    @classmethod
    def from_user(cls, u: User) -> "Actor":
        return cls(u.id, u.name, u.role, u.can_view_graphic)


def current_actor(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Actor:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    try:
        data = jwt.decode(creds.credentials, settings.secret_key, algorithms=["HS256"])
        user = db.get(User, int(data["sub"]))
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    if not user or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account disabled")
    # role always comes from the database, never from the token
    return Actor.from_user(user)


def require_roles(*roles: str) -> Callable:
    def dep(actor: Actor = Depends(current_actor)) -> Actor:
        if actor.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role cannot perform this action")
        return actor
    return dep


newsroom = require_roles(Role.JOURNALIST, Role.EDITOR, Role.ADMIN)
editor_only = require_roles(Role.EDITOR)
admin_only = require_roles(Role.ADMIN)


# ---------- privacy helpers ----------
def hash_contact(value: str) -> str:
    """Stable pseudonym for a phone number. Peppered so it cannot be reversed by brute force offline."""
    norm = "".join(ch for ch in value if ch.isdigit())
    return hmac.new(settings.phone_hash_pepper.encode(), norm.encode(), hashlib.sha256).hexdigest()


def _fernet() -> Fernet | None:
    if not settings.field_encryption_key:
        return None
    return Fernet(settings.field_encryption_key.encode())


def encrypt_field(value: str) -> str | None:
    f = _fernet()
    return f.encrypt(value.encode()).decode() if f else None


def decrypt_field(token: str) -> str | None:
    f = _fernet()
    try:
        return f.decrypt(token.encode()).decode() if f else None
    except Exception:
        return None


def new_tracking_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(9)
    return raw, hashlib.sha256(raw.encode()).hexdigest()


def check_tracking_token(raw: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    return hmac.compare_digest(hashlib.sha256(raw.encode()).hexdigest(), stored_hash)


# ---------- rate limiting (in-process; put Redis behind this for multi-worker deploys) ----------
class RateLimiter:
    def __init__(self) -> None:
        self.hits: dict[str, deque] = defaultdict(deque)
        self.lock = threading.Lock()

    def check(self, key: str, limit: int, window_s: int) -> bool:
        now = time.monotonic()
        with self.lock:
            q = self.hits[key]
            while q and q[0] < now - window_s:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True

    def reset(self) -> None:
        with self.lock:
            self.hits.clear()


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown"))


def rate_limit(name: str, limit: int, window_s: int) -> Callable:
    def dep(request: Request) -> None:
        if not limiter.check(f"{name}:{client_ip(request)}", limit, window_s):
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests. Please slow down.")
    return dep


# ---------- short-lived signed media links (so <img src> works without exposing bearer tokens) ----------
def media_token(evidence_id: str, variant: str, user_id: int, minutes: int = 5, reveal: bool = False) -> str:
    now = datetime.now(timezone.utc)
    claims = {"ev": evidence_id, "var": variant, "sub": str(user_id), "aud": "media",
              "exp": now + timedelta(minutes=minutes)}
    if reveal:
        claims["rev"] = True
    return jwt.encode(claims, settings.secret_key, algorithm="HS256")


def read_media_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"], audience="media")
    except Exception:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Media link expired or invalid")
