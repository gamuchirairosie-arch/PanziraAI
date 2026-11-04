"""SQLAlchemy Database Models for Panzira AI

Defines schema for Users, Signal Reports, Verified Public Alerts,
Corridor Watch, Working Briefs, and the Editorial Audit Trail.
Uses sqlalchemy.orm.synonym to provide complete, bidirectional support for
both camelCase and snake_case field access in models and queries.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
)
from sqlalchemy.orm import relationship, synonym
from app.database.session import Base


class FlexModel:
    """Mixin allowing models to be instantiated with either camelCase or snake_case kwargs."""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            if hasattr(self.__class__, k):
                setattr(self, k, v)
            else:
                camel = "".join(part.capitalize() if i > 0 else part for i, part in enumerate(k.split("_")))
                if hasattr(self.__class__, camel):
                    setattr(self, camel, v)
                else:
                    setattr(self, k, v)


class User(Base, FlexModel):
    """User account model for Newsroom Editors, Journalists, and Admins."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="journalist")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Synonyms
    fullName = synonym("full_name")
    isActive = synonym("is_active")

    # Relationships
    audit_logs = relationship("AuditLog", back_populates="user")


class SignalReport(Base, FlexModel):
    """Core intake signal model representing an incoming road-hazard lead."""
    __tablename__ = "signal_reports"

    id = Column(String(64), primary_key=True, index=True)
    investigationCode = Column("investigation_code", String(64), index=True, nullable=False)
    
    sourceChannelLabel = Column("source_channel_label", String(100), nullable=False)
    sourceChannelShort = Column("source_channel_short", String(100), nullable=False)
    sourceBadgeColor = Column("source_badge_color", String(20), default="green")
    visibility = Column(String(20), default="opt-in")
    
    workflowStatus = Column("workflow_status", String(50), default="lead", index=True)
    pipelineStage = Column("pipeline_stage", Integer, default=2)
    
    monitorStatusLabel = Column("monitor_status_label", String(100), default="Unverified lead")
    monitorStatusColor = Column("monitor_status_color", String(20), default="gold")
    inboxStatusLine = Column("inbox_status_line", String(150), default="Citizen web · Unverified lead")
    timeShort = Column("time_short", String(20), default="09:00")
    reportedDateTime = Column("reported_date_time", String(100), nullable=False)
    observedIso = Column("observed_iso", String(100), nullable=True)
    
    title = Column(String(255), nullable=False)
    inboxTitle = Column("inbox_title", String(255), nullable=True)
    subtitle = Column(String(255), default="")
    corridor = Column(String(150), nullable=False, index=True)
    roadArea = Column("road_area", String(150), nullable=False)
    landmark = Column(String(255), default="")
    categoryKey = Column("category_key", String(50), nullable=False, index=True)
    categoryLabel = Column("category_label", String(100), nullable=False)
    severityLabel = Column("severity_label", String(50), default="Review needed")
    isCritical = Column("is_critical", Boolean, default=False)
    
    originalLanguage = Column("original_language", String(50), default="English")
    originalQuote = Column("original_quote", Text, nullable=False)
    draftEnglishTranslation = Column("draft_english_translation", Text, nullable=True)
    sourceProvenanceNote = Column("source_provenance_note", Text, nullable=True)
    evidenceLink = Column("evidence_link", String(500), nullable=True)
    
    aiHazardType = Column("ai_hazard_type", String(150), default="")
    aiLikelyCorridor = Column("ai_likely_corridor", String(150), default="")
    aiLanguageNote = Column("ai_language_note", String(255), default="")
    aiLocationPrecision = Column("ai_location_precision", String(255), default="Landmark only · GPS unverified")
    aiConfidencePercent = Column("ai_confidence_percent", Integer, default=50)
    aiConfidenceNote = Column("ai_confidence_note", String(255), default="50% • insufficient to publish")
    aiImageHeading = Column("ai_image_heading", String(255), default="Text-only submission (no photo attached)")
    aiImageSummary = Column("ai_image_summary", Text, default="")
    aiImageCaveat = Column("ai_image_caveat", Text, default="AI analysis cannot establish location or recency without human verification.")
    
    photoType = Column("photo_type", String(50), default="none")
    customPhotoDataUrl = Column("custom_photo_data_url", Text, nullable=True)
    photoFilename = Column("photo_filename", String(255), nullable=True)
    photoCaption = Column("photo_caption", String(500), nullable=True)
    isGraphicImage = Column("is_graphic_image", Boolean, default=False)
    graphicSafetyReason = Column("graphic_safety_reason", Text, nullable=True)
    
    checklist = Column(JSON, default=lambda: {
        "locationAndTime": False,
        "mediaAndDate": False,
        "independentSource": False,
        "hazardStillPresent": False,
    })
    missingItems = Column("missing_items", JSON, default=list)
    editorialNotes = Column("editorial_notes", Text, default="")
    unconfirmedSummary = Column("unconfirmed_summary", Text, default="")
    
    duplicateClusterTitle = Column("duplicate_cluster_title", String(255), nullable=True)
    duplicateClusterSummary = Column("duplicate_cluster_summary", Text, nullable=True)
    duplicateCandidates = Column("duplicate_candidates", JSON, default=list)
    
    timeline = Column(JSON, default=list)
    isUserSubmitted = Column("is_user_submitted", Boolean, default=False)
    mapCoords = Column("map_coords", JSON, default=lambda: {"xPct": 50.0, "yPct": 50.0})
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Synonyms for snake_case compatibility
    investigation_code = synonym("investigationCode")
    source_channel_label = synonym("sourceChannelLabel")
    source_channel_short = synonym("sourceChannelShort")
    source_badge_color = synonym("sourceBadgeColor")
    workflow_status = synonym("workflowStatus")
    pipeline_stage = synonym("pipelineStage")
    monitor_status_label = synonym("monitorStatusLabel")
    monitor_status_color = synonym("monitorStatusColor")
    inbox_status_line = synonym("inboxStatusLine")
    time_short = synonym("timeShort")
    reported_date_time = synonym("reportedDateTime")
    observed_iso = synonym("observedIso")
    inbox_title = synonym("inboxTitle")
    road_area = synonym("roadArea")
    category_key = synonym("categoryKey")
    category_label = synonym("categoryLabel")
    severity_label = synonym("severityLabel")
    is_critical = synonym("isCritical")
    original_language = synonym("originalLanguage")
    original_quote = synonym("originalQuote")
    draft_english_translation = synonym("draftEnglishTranslation")
    source_provenance_note = synonym("sourceProvenanceNote")
    evidence_link = synonym("evidenceLink")
    ai_hazard_type = synonym("aiHazardType")
    ai_likely_corridor = synonym("aiLikelyCorridor")
    ai_language_note = synonym("aiLanguageNote")
    ai_location_precision = synonym("aiLocationPrecision")
    ai_confidence_percent = synonym("aiConfidencePercent")
    ai_confidence_note = synonym("aiConfidenceNote")
    ai_image_heading = synonym("aiImageHeading")
    ai_image_summary = synonym("aiImageSummary")
    ai_image_caveat = synonym("aiImageCaveat")
    photo_type = synonym("photoType")
    custom_photo_data_url = synonym("customPhotoDataUrl")
    photo_filename = synonym("photoFilename")
    photo_caption = synonym("photoCaption")
    is_graphic_image = synonym("isGraphicImage")
    graphic_safety_reason = synonym("graphicSafetyReason")
    missing_items = synonym("missingItems")
    editorial_notes = synonym("editorialNotes")
    unconfirmed_summary = synonym("unconfirmedSummary")
    duplicate_cluster_title = synonym("duplicateClusterTitle")
    duplicate_cluster_summary = synonym("duplicateClusterSummary")
    duplicate_candidates = synonym("duplicateCandidates")
    is_user_submitted = synonym("isUserSubmitted")
    map_coords = synonym("mapCoords")

    public_alert = relationship("VerifiedPublicAlert", back_populates="signal", uselist=False, cascade="all, delete-orphan")


class VerifiedPublicAlert(Base, FlexModel):
    """Public road alert model. ONLY populated when verified and approved by a human editor."""
    __tablename__ = "verified_public_alerts"

    id = Column(String(64), primary_key=True, index=True)
    sourceSignalId = Column("source_signal_id", String(64), ForeignKey("signal_reports.id"), nullable=False, unique=True)
    
    title = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    corridor = Column(String(150), nullable=False)
    categoryKey = Column("category_key", String(50), nullable=False)
    categoryLabel = Column("category_label", String(100), nullable=False)
    severity = Column(String(50), nullable=False)
    isCritical = Column("is_critical", Boolean, default=False)
    
    updatedAgo = Column("updated_ago", String(100), default="Recently updated")
    approvedAtIso = Column("approved_at_iso", String(100), nullable=False)
    approvedAtReadable = Column("approved_at_readable", String(100), nullable=False)
    
    description = Column(Text, nullable=False)
    sourceAttribution = Column("source_attribution", String(500), nullable=False)
    desktopPin = Column("desktop_pin", JSON, nullable=False)
    
    approvedByUserId = Column("approved_by_user_id", Integer, ForeignKey("users.id"), nullable=True)
    approvedByName = Column("approved_by_name", String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Synonyms
    source_signal_id = synonym("sourceSignalId")
    category_key = synonym("categoryKey")
    category_label = synonym("categoryLabel")
    is_critical = synonym("isCritical")
    updated_ago = synonym("updatedAgo")
    approved_at_iso = synonym("approvedAtIso")
    approved_at_readable = synonym("approvedAtReadable")
    source_attribution = synonym("sourceAttribution")
    desktop_pin = synonym("desktopPin")
    approved_by_user_id = synonym("approvedByUserId")
    approved_by_name = synonym("approvedByName")

    signal = relationship("SignalReport", back_populates="public_alert")


class AuditLog(Base, FlexModel):
    """Immutable audit trail of all editorial verification, rejection, and intake events."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(255), default="System")
    user_role = Column(String(50), default="system")
    signal_id = Column(String(64), index=True, nullable=True)
    action = Column(String(100), nullable=False, index=True)
    details = Column(Text, nullable=False)
    ip_address = Column(String(100), nullable=True)

    # Synonyms
    userId = synonym("user_id")
    userName = synonym("user_name")
    userRole = synonym("user_role")
    signalId = synonym("signal_id")
    ipAddress = synonym("ip_address")

    user = relationship("User", back_populates="audit_logs")


class CorridorWatch(Base, FlexModel):
    """Corridor watchlist data model for high-risk transit corridors."""
    __tablename__ = "corridor_watches"

    id = Column(String(50), primary_key=True)
    rank = Column(String(20), nullable=False)
    name = Column(String(100), nullable=False)
    fleetName = Column("fleet_name", String(150), nullable=False)
    badge = Column(String(100), nullable=False)
    fleetBadge = Column("fleet_badge", String(100), nullable=False)
    badgeColor = Column("badge_color", String(20), default="gold")
    submissionsSummary = Column("submissions_summary", String(255), nullable=False)
    hazardSummary = Column("hazard_summary", Text, nullable=False)
    patternNote = Column("pattern_note", Text, nullable=False)
    fleetConfidenceLine = Column("fleet_confidence_line", String(255), nullable=False)
    fleetRecommendation = Column("fleet_recommendation", Text, nullable=False)
    scoreDisplay = Column("score_display", String(50), nullable=False)
    scoreNumeric = Column("score_numeric", Float, nullable=True)
    confidenceLabel = Column("confidence_label", String(100), nullable=False)
    positiveFactors = Column("positive_factors", JSON, default=list)
    negativeFactors = Column("negative_factors", JSON, default=list)
    whyLocationMobile = Column("why_location_mobile", Text, nullable=False)
    missingMobile = Column("missing_mobile", Text, nullable=False)
    clusterCount = Column("cluster_count", Integer, default=1)
    apiEndpoint = Column("api_endpoint", String(255), nullable=False)

    # Synonyms
    fleet_name = synonym("fleetName")
    fleet_badge = synonym("fleetBadge")
    badge_color = synonym("badgeColor")
    submissions_summary = synonym("submissionsSummary")
    hazard_summary = synonym("hazardSummary")
    pattern_note = synonym("patternNote")
    fleet_confidence_line = synonym("fleetConfidenceLine")
    fleet_recommendation = synonym("fleetRecommendation")
    score_display = synonym("scoreDisplay")
    score_numeric = synonym("scoreNumeric")
    confidence_label = synonym("confidenceLabel")
    positive_factors = synonym("positiveFactors")
    negative_factors = synonym("negativeFactors")
    why_location_mobile = synonym("whyLocationMobile")
    missing_mobile = synonym("missingMobile")
    cluster_count = synonym("clusterCount")
    api_endpoint = synonym("apiEndpoint")


class WorkingBrief(Base, FlexModel):
    """Investigative working brief draft model for newsroom investigative packages."""
    __tablename__ = "working_briefs"

    id = Column(Integer, primary_key=True, index=True)
    investigationId = Column("investigation_id", String(64), unique=True, index=True, nullable=False)
    editorName = Column("editor_name", String(255), nullable=False)
    dateLabel = Column("date_label", String(100), nullable=False)
    title = Column(String(255), nullable=False)
    dek = Column(Text, nullable=False)
    lead = Column(Text, nullable=False)
    reportedPattern = Column("reported_pattern", Text, nullable=False)
    reportingPlan = Column("reporting_plan", Text, nullable=False)
    questionsForAuthorities = Column("questions_for_authorities", JSON, default=list)
    editorNotes = Column("editor_notes", Text, default="")
    lastSavedAt = Column("last_saved_at", String(100), nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Synonyms
    investigation_id = synonym("investigationId")
    editor_name = synonym("editorName")
    date_label = synonym("dateLabel")
    reported_pattern = synonym("reportedPattern")
    reporting_plan = synonym("reportingPlan")
    questions_for_authorities = synonym("questionsForAuthorities")
    editor_notes = synonym("editorNotes")
    last_saved_at = synonym("lastSavedAt")
