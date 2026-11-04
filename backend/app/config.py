"""Panzira AI - Backend Configuration Module

Handles environment settings, security keys, thresholds, and operational flags.
"""

from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Panzira AI - Road-Safety Intelligence Platform"
    API_V1_STR: str = "/api"
    
    # Secret Key for JWT token signing
    SECRET_KEY: str = "panzira-hackathon-insecure-secret-key-change-in-prod-2025"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database
    DATABASE_URL: str = "sqlite:///./panzira.db"
    
    # CORS Origins (Allow frontend dev and preview servers)
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://localhost:4173",
    ]
    
    # AI Safety & Workflow Constraints
    # Invariant: AI is STRICTLY forbidden from auto-publishing alerts
    AI_AUTO_PUBLISH_ENABLED: bool = False
    
    # Graphic Content Sensitivity Threshold (0.0 to 1.0)
    GRAPHIC_DETECTION_THRESHOLD: float = 0.55
    
    # Deduplication Similarity Threshold (0.0 to 1.0)
    DEDUPLICATION_THRESHOLD: float = 0.65
    
    # External Integration Tokens / Webhooks
    WHATSAPP_VERIFY_TOKEN: str = "panzira_whatsapp_optin_token_2025"
    FACEBOOK_FEED_ACCESS_TOKEN: str = "demo_meta_public_page_token"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

