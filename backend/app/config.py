"""Panzira AI - Backend Configuration Module

Handles environment settings, security keys, thresholds, and operational flags.
Supports both modular service settings and core verification pipeline invariants.
"""

from functools import lru_cache
from typing import List, Tuple
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # Core environment & persistence
    env: str = "dev"
    database_url: str = "sqlite:///./panzira.db"
    secret_key: str = "panzira-hackathon-insecure-secret-key-change-in-prod-2025"
    field_encryption_key: str = "ZmDfcTF7_60GrrY167zsiPd67pEvs0aGOv2oasOM1Pg="
    phone_hash_pepper: str = "dev-pepper"
    access_token_minutes: int = 480
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000,http://localhost:4173"
    evidence_dir: str = "./data/evidence"
    max_upload_mb: int = 8
    require_four_eyes: bool = False

    # Integrations
    wa_verify_token: str = "panzira_whatsapp_optin_token_2025"
    wa_app_secret: str = ""
    wa_access_token: str = ""
    wa_phone_number_id: str = ""

    # Telegram Bot API (optional; the webhook is unavailable until configured)
    telegram_bot_token: str = ""
    telegram_webhook_secret: str = ""
    telegram_editor_chat_id: str = ""
    telegram_alert_chat_id: str = ""

    at_username: str = "sandbox"
    at_api_key: str = ""
    at_sender_id: str = ""
    at_webhook_secret: str = ""

    meta_graph_token: str = "demo_meta_public_page_token"
    meta_graph_version: str = "v21.0"

    # AI & ML pipeline
    translation_provider: str = "glossary"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"
    graphic_threshold: float = 0.55
    map_bbox: Tuple[float, float, float, float] = (-20.25, 28.45, -20.05, 28.72)  # s, w, n, e

    # Uppercase aliases & safety invariants
    PROJECT_NAME: str = "Panzira AI - Road-Safety Intelligence Platform"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = "sqlite:///./panzira.db"
    SECRET_KEY: str = "panzira-hackathon-insecure-secret-key-change-in-prod-2025"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    AI_AUTO_PUBLISH_ENABLED: bool = False  # Invariant: AI is STRICTLY forbidden from auto-publishing alerts
    GRAPHIC_DETECTION_THRESHOLD: float = 0.55
    DEDUPLICATION_THRESHOLD: float = 0.65
    WHATSAPP_VERIFY_TOKEN: str = "panzira_whatsapp_optin_token_2025"
    FACEBOOK_FEED_ACCESS_TOKEN: str = "demo_meta_public_page_token"

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return self.cors_list

    @property
    def cors_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.env == "prod":
        missing = []
        if s.secret_key.startswith("dev-only"):
            missing.append("SECRET_KEY")
        if not s.field_encryption_key:
            missing.append("FIELD_ENCRYPTION_KEY")
        if s.phone_hash_pepper == "dev-pepper":
            missing.append("PHONE_HASH_PEPPER")
        if missing:
            raise RuntimeError("Refusing to start in prod without: " + ", ".join(missing))
    return s


settings = get_settings()
