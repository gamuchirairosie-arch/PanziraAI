"""Pydantic Schemas for Authentication & User Management"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    name: Optional[str] = None
    role: str = "journalist"  # 'citizen' | 'admin' | 'editor' | 'journalist'
    handle: Optional[str] = None
    phone: Optional[str] = None
    media_house: Optional[str] = None
    zmc_number: Optional[str] = None
    press_card_url: Optional[str] = None
    verification_status: str = "verified"
    royalty_balance_usd: float = 0.0


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool = True
    active: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

