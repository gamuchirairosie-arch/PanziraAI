"""Database schema.

Workflow (matches the frontend): received -> ai_extracted -> corroboration
-> editor_approval -> published, with rejected / withdrawn as exits.
Only a human editor can create a PublicAlert (approved_by_id is NOT NULL).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (JSON, Boolean, DateTime, Float, ForeignKey, Integer,
                        String, Text, UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def aware(dt: datetime | None) -> datetime | None:
    """SQLite hands back naive datetimes; everything we store is UTC."""
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


class Role:
    JOURNALIST = "journalist"
    EDITOR = "editor"
    ADMIN = "admin"
    SYSTEM = "system"  # the AI pipeline / ingestion workers; can never publish
    ALL_HUMAN = (JOURNALIST, EDITOR, ADMIN)


class Status:
    RECEIVED = "received"
    AI_EXTRACTED = "ai_extracted"
    CORROBORATION = "corroboration"
    EDITOR_APPROVAL = "editor_approval"
    PUBLISHED = "published"
    REJECTED = "rejected"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    full_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    role: Mapped[str] = mapped_column(String(20))
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    can_view_graphic: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0, nullable=True)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (UniqueConstraint("channel", "source_ref", name="uq_source_ref"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # provenance
    channel: Mapped[str] = mapped_column(String(30))  # web|whatsapp|sms|ussd|facebook_page|instagram|public_link
    visibility: Mapped[str] = mapped_column(String(10))  # public (public source) | opt-in (citizen-initiated)
    source_url: Mapped[Optional[str]] = mapped_column(String(1000))
    source_ref: Mapped[Optional[str]] = mapped_column(String(200))  # platform post/message id
    source_account: Mapped[Optional[str]] = mapped_column(String(200))  # page name, never a private individual
    source_posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    observed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    contributor_hash: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    contact_enc: Mapped[Optional[str]] = mapped_column(Text)  # encrypted, only with follow-up consent
    tracking_token_hash: Mapped[Optional[str]] = mapped_column(String(64))

    status: Mapped[str] = mapped_column(String(20), default=Status.RECEIVED, index=True)

    # content
    text_original: Mapped[str] = mapped_column(Text, default="")
    language: Mapped[str] = mapped_column(String(10), default="en")  # en|sn|nd
    language_source: Mapped[str] = mapped_column(String(10), default="detected")  # reporter|detected
    text_english: Mapped[Optional[str]] = mapped_column(Text)
    translation_method: Mapped[Optional[str]] = mapped_column(String(30))
    translation_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    translation_reviewed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))

    # classification / location (reporter-supplied first, AI fills gaps)
    category_key: Mapped[str] = mapped_column(String(20), default="other")
    category_label: Mapped[str] = mapped_column(String(60), default="Other road hazard")
    category_source: Mapped[str] = mapped_column(String(10), default="ai")  # reporter|ai
    severity_label: Mapped[str] = mapped_column(String(30), default="Review needed")
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False)
    road_area: Mapped[str] = mapped_column(String(200), default="")
    landmark: Mapped[str] = mapped_column(String(200), default="")
    corridor_id: Mapped[Optional[str]] = mapped_column(String(30), index=True)
    lat: Mapped[Optional[float]] = mapped_column(Float)
    lng: Mapped[Optional[float]] = mapped_column(Float)
    location_precision: Mapped[str] = mapped_column(String(120), default="Unknown")
    gps_reported: Mapped[bool] = mapped_column(Boolean, default=False)

    # AI output (suggestions only)
    ai: Mapped[Optional[dict]] = mapped_column(JSON)
    ai_status: Mapped[str] = mapped_column(String(12), default="pending")  # pending|done|failed

    # graphic-safety
    is_graphic: Mapped[bool] = mapped_column(Boolean, default=False)
    graphic_reason: Mapped[Optional[str]] = mapped_column(Text)

    # verification
    chk_location_time: Mapped[bool] = mapped_column(Boolean, default=False)
    chk_media_date: Mapped[bool] = mapped_column(Boolean, default=False)
    chk_independent: Mapped[bool] = mapped_column(Boolean, default=False)
    chk_still_present: Mapped[bool] = mapped_column(Boolean, default=False)
    checklist_completed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    editorial_notes: Mapped[str] = mapped_column(Text, default="")
    duplicate_cluster_id: Mapped[Optional[str]] = mapped_column(String(40), index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    evidence: Mapped[list["Evidence"]] = relationship(back_populates="report", cascade="all, delete-orphan")
    timeline: Mapped[list["TimelineEvent"]] = relationship(
        back_populates="report", cascade="all, delete-orphan", order_by="TimelineEvent.ts"
    )

    @property
    def public_id(self) -> str:
        return f"PZ-SIG-{self.id:04d}"

    @property
    def investigation_code(self) -> str:
        return f"ROADS-{self.id:04d}"


class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="image")
    path: Mapped[str] = mapped_column(String(500))
    preview_path: Mapped[Optional[str]] = mapped_column(String(500))  # blurred copy for restricted items
    original_filename: Mapped[Optional[str]] = mapped_column(String(255))
    mime: Mapped[str] = mapped_column(String(60))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    phash: Mapped[Optional[str]] = mapped_column(String(16), index=True)
    exif: Mapped[Optional[dict]] = mapped_column(JSON)
    is_graphic: Mapped[bool] = mapped_column(Boolean, default=False)
    graphic_score: Mapped[float] = mapped_column(Float, default=0.0)
    analysis: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    report: Mapped[Report] = relationship(back_populates="evidence")


class TimelineEvent(Base):
    __tablename__ = "timeline"
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    actor_label: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    report: Mapped[Report] = relationship(back_populates="timeline")


class DuplicateLink(Base):
    __tablename__ = "duplicate_links"
    __table_args__ = (UniqueConstraint("report_id", "other_id", name="uq_dup_pair"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    other_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    score: Mapped[float] = mapped_column(Float)
    reasons: Mapped[list] = mapped_column(JSON)
    # an editor can dismiss a suggested duplicate
    dismissed: Mapped[bool] = mapped_column(Boolean, default=False)


class PublicAlert(Base):
    __tablename__ = "public_alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id"), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(300))
    corridor_id: Mapped[Optional[str]] = mapped_column(String(30))
    category_key: Mapped[str] = mapped_column(String(20))
    category_label: Mapped[str] = mapped_column(String(60))
    severity: Mapped[str] = mapped_column(String(30))
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str] = mapped_column(Text)
    source_attribution: Mapped[str] = mapped_column(Text)
    lat: Mapped[Optional[float]] = mapped_column(Float)
    lng: Mapped[Optional[float]] = mapped_column(Float)
    # NOT NULL: a public alert cannot exist without a named human approver
    approved_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    withdrawn_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    withdrawn_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    withdrawn_reason: Mapped[Optional[str]] = mapped_column(Text)

    @property
    def public_code(self) -> str:
        return f"PZ-PUB-{self.id:04d}"  # deliberately not derived from the internal report id


class Brief(Base):
    __tablename__ = "briefs"
    id: Mapped[int] = mapped_column(primary_key=True)
    investigation_id: Mapped[str] = mapped_column(String(30), unique=True)
    report_id: Mapped[Optional[int]] = mapped_column(ForeignKey("reports.id"))
    editor_name: Mapped[str] = mapped_column(String(120), default="")
    date_label: Mapped[str] = mapped_column(String(60), default="")
    title: Mapped[str] = mapped_column(Text, default="")
    dek: Mapped[str] = mapped_column(Text, default="")
    lead: Mapped[str] = mapped_column(Text, default="")
    reported_pattern: Mapped[str] = mapped_column(Text, default="")
    reporting_plan: Mapped[str] = mapped_column(Text, default="")
    questions_for_authorities: Mapped[list] = mapped_column(JSON, default=list)
    editor_notes: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AuditLog(Base):
    """Append-only, hash-chained. Each row commits to the previous row's hash."""
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    actor_id: Mapped[Optional[int]] = mapped_column(Integer)
    actor_label: Mapped[str] = mapped_column(String(120))
    actor_role: Mapped[str] = mapped_column(String(20))
    action: Mapped[str] = mapped_column(String(60), index=True)
    entity_type: Mapped[str] = mapped_column(String(30))
    entity_id: Mapped[str] = mapped_column(String(60), index=True)
    detail: Mapped[Optional[dict]] = mapped_column(JSON)
    ip: Mapped[Optional[str]] = mapped_column(String(64))
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))


class Consent(Base):
    __tablename__ = "consents"
    id: Mapped[int] = mapped_column(primary_key=True)
    contributor_hash: Mapped[str] = mapped_column(String(64), index=True)
    channel: Mapped[str] = mapped_column(String(20))
    language: Mapped[str] = mapped_column(String(10), default="en")
    allow_followup: Mapped[bool] = mapped_column(Boolean, default=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class SourceRegistration(Base):
    """Allow-list of public pages/accounts we may read through official APIs."""
    __tablename__ = "source_registrations"
    __table_args__ = (UniqueConstraint("platform", "account_id", name="uq_source_acct"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    platform: Mapped[str] = mapped_column(String(20))  # facebook_page | instagram
    account_id: Mapped[str] = mapped_column(String(100))
    display_name: Mapped[str] = mapped_column(String(200))
    basis: Mapped[str] = mapped_column(Text)  # why we may read it (e.g. "Page admin granted access")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_polled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    registered_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))


class Outbox(Base):
    """Every outbound message (replies, follow-ups). Stores a hash of the recipient only."""
    __tablename__ = "outbox"
    id: Mapped[int] = mapped_column(primary_key=True)
    channel: Mapped[str] = mapped_column(String(20))
    to_hash: Mapped[str] = mapped_column(String(64))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="sent")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ContributorPref(Base):
    """Language preference for a hashed phone number. Holds no consent and no contact details."""
    __tablename__ = "contributor_prefs"
    contributor_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    language: Mapped[str] = mapped_column(String(2), default="en")


class TelegramUpdate(Base):
    """Processed Bot API update ids.

    Telegram retries webhook deliveries. Keeping only the provider update id avoids
    duplicate consent prompts, acknowledgements, and reports without retaining an
    unconsented message payload.
    """
    __tablename__ = "telegram_updates"
    update_id: Mapped[int] = mapped_column(primary_key=True)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RSSSource(Base):
    """Editor-managed public RSS feed allow-list. Feed items are leads, never verified alerts."""
    __tablename__ = "rss_sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    feed_url: Mapped[str] = mapped_column(String(1000), unique=True)
    publisher_domain: Mapped[str] = mapped_column(String(255))
    basis: Mapped[str] = mapped_column(Text, default="Publisher-provided public RSS feed")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    poll_interval_minutes: Mapped[int] = mapped_column(Integer, default=15)
    last_polled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[Optional[str]] = mapped_column(Text)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CollectionRun(Base):
    """Audit summary for each RSS collection attempt, including failed fetches."""
    __tablename__ = "collection_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[Optional[int]] = mapped_column(ForeignKey("rss_sources.id"), index=True)
    source_name: Mapped[str] = mapped_column(String(160))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    fetched_count: Mapped[int] = mapped_column(Integer, default=0)
    created_count: Mapped[int] = mapped_column(Integer, default=0)
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="running")
    error: Mapped[Optional[str]] = mapped_column(Text)
