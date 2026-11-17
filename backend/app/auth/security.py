"""Security & Cryptography Utilities

Provides secure PBKDF2-HMAC-SHA256 password hashing and JWT token operations.
Zero external native dependencies required.
"""

import base64
import os
import hmac
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
from app.config import settings
from app.security import hash_password as _v1_hash_password, verify_password as _v1_verify_password


def hash_password(password: str) -> str:
    """Hash a password using canonical PBKDF2-HMAC-SHA256."""
    return _v1_hash_password(password)


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verify a plain password against either pbkdf2$... or legacy hex(salt)$hex(key) hash."""
    return _v1_verify_password(plain_password, stored_hash)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a signed JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None
