"""Pydantic Schemas for External Integrations (WhatsApp, Social Feeds, SMS/USSD)"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class WhatsAppWebhookEntry(BaseModel):
    """WhatsApp Business Cloud API / Twilio inbound message webhook."""
    from_number: str = Field(..., description="E.164 phone number of user (hashed or pseudonymized for privacy)")
    message_body: str = Field(..., min_length=1)
    timestamp: Optional[str] = None
    media_url: Optional[str] = None
    media_content_type: Optional[str] = None
    user_consented_opt_in: bool = Field(True, description="Enforces strict opt-in compliance; private groups refused")
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class PublicFeedPost(BaseModel):
    """Permitted civic or authority public page post (e.g. Bulawayo City Council)."""
    platform: str = Field(..., description="'facebook' | 'instagram' | 'x' | 'rss'")
    page_name: str = Field(..., description="Permitted public page name, e.g. 'City of Bulawayo Official'")
    post_url: str = Field(..., description="Permanent link to the public post")
    post_text: str = Field(..., description="Full text of the public announcement/post")
    published_timestamp: str = Field(..., description="ISO or readable publication timestamp")
    media_urls: Optional[List[str]] = Field(default_factory=list)
    has_explicit_permission: bool = Field(True, description="Strict compliance check: must be a permitted public source")


class SmsReport(BaseModel):
    """Low-bandwidth SMS intake message."""
    sender_phone: str = Field(..., description="Sender phone number")
    body: str = Field(..., min_length=3, description="SMS message text")
    timestamp: Optional[str] = None


class UssdReport(BaseModel):
    """USSD menu submission (e.g. *140# menu selection)."""
    session_id: str
    phone_number: str
    selected_corridor: str
    selected_hazard_type: str
    landmark_text: str
    severity_level: Optional[str] = "High"

