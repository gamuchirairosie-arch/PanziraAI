"""Social Media & Public Data Ingestion Collector

Collects and ingests permitted public Facebook, Instagram, and municipal feeds.
Strictly requires explicit public feed authorization and records full provenance
(source page, direct post URL, and original timestamp).
"""

from datetime import datetime, timezone
from typing import Dict, Any
from sqlalchemy.orm import Session

from app.schemas.integration import PublicFeedPost
from app.schemas.signal import CitizenReportCreate
from app.ml.pipeline import process_intake_pipeline
from app.database.models import SignalReport, AuditLog


def ingest_public_social_post(post: PublicFeedPost, db: Session) -> SignalReport:
    """
    Ingests an authorized public social post into the newsroom signal monitor
    as an unverified public-feed lead.
    """
    if not post.has_explicit_permission:
        raise ValueError(
            "Unauthorized source rejected. Panzira AI strictly requires explicit permission "
            "for civic and social feed ingestion."
        )

    count = db.query(SignalReport).count()
    next_num = 44 + count
    signal_id = f"PZ-SIG-00{next_num}" if next_num < 100 else f"PZ-SIG-0{next_num}"
    inv_code = f"ROADS-04{next_num}"

    now = datetime.now(timezone.utc)
    readable_now = now.strftime("%d %b %Y, %H:%M")
    short_time = now.strftime("%H:%M")

    platform_title = post.platform.capitalize()
    source_label = f"Public {platform_title} page"
    source_short = f"Authorized {platform_title} page"

    # Formulate citizen report input for ML pipeline
    report_input = CitizenReportCreate(
        categoryKey="other",
        categoryLabel="Road hazard",
        roadArea="Urban Corridor",
        landmark=f"{post.page_name} public feed",
        description=post.post_text,
        reportedDateTime=post.published_timestamp or readable_now,
        observedIso=now.isoformat(),
        evidenceLink=post.post_url,
        language="English",
        photoType="none",
        sourceChannelLabel=source_label,
        sourceChannelShort=source_short,
        sourceProvenanceNote=f"{source_label} ({post.page_name}) • {post.published_timestamp} • original author not yet contacted",
    )

    ai_meta = process_intake_pipeline(report_input, db)

    clf = ai_meta["classification"]
    loc = ai_meta["location"]
    trans = ai_meta["translation"]
    vis = ai_meta["vision"]
    dedup = ai_meta["deduplication"]

    new_signal = SignalReport(
        id=signal_id,
        investigation_code=inv_code,
        source_channel_label=source_label,
        source_channel_short=source_short,
        source_badge_color="gold",
        visibility="public",
        workflow_status="lead",
        monitor_status_label="Needs corroboration",
        monitor_status_color="gold",
        inbox_status_line=f"Authorized public feed · Lead",
        time_short=short_time,
        reported_date_time=post.published_timestamp or readable_now,
        observed_iso=now.isoformat(),
        title=f"{clf['categoryLabel']} · {loc['canonicalRoad']}",
        inbox_title=f"{clf['categoryLabel']} · {loc['canonicalRoad']}",
        subtitle=f"Authorized public {platform_title} lead · Bulawayo",
        corridor=loc["corridor"],
        road_area=loc["canonicalRoad"],
        landmark=loc["landmark"],
        category_key=clf["categoryKey"],
        category_label=clf["categoryLabel"],
        severity_label=clf["severityLabel"],
        is_critical=clf["isCritical"],
        original_language=trans["sourceLanguage"],
        original_quote=f"“{post.post_text.strip()}”",
        draft_english_translation=trans["translatedText"],
        source_provenance_note=f"Authorized public-page post ({post.page_name}) • {post.published_timestamp} • source link: {post.post_url}",
        evidence_link=post.post_url,
        ai_hazard_type=clf["categoryLabel"],
        ai_likely_corridor=loc["aiLikelyCorridor"],
        ai_language_note=trans["languageNote"],
        ai_location_precision=loc["aiLocationPrecision"],
        ai_confidence_percent=ai_meta["confidencePercent"],
        ai_confidence_note=ai_meta["confidenceNote"],
        ai_image_heading=vis["heading"],
        ai_image_summary="Text-only public page post. An editor must verify current hazard status before publishing.",
        ai_image_caveat="Public social mentions are treated strictly as unverified leads, never confirmed facts.",
        photo_type="none",
        is_graphic_image=vis["isGraphic"],
        graphic_safety_reason=vis["reason"],
        pipeline_stage=2,
        missing_items=ai_meta["missingItems"],
        checklist={
            "locationAndTime": False,
            "mediaAndDate": False,
            "independentSource": False,
            "hazardStillPresent": False,
        },
        editorial_notes=f"Publicly accessible post from {post.page_name}; original author not yet contacted. Cross-check municipal fault desk.",
        unconfirmed_summary=f"Public {platform_title} post reporting {clf['categoryLabel'].lower()} along {loc['canonicalRoad']}.",
        duplicate_cluster_title=dedup["duplicateClusterTitle"],
        duplicate_cluster_summary=dedup["duplicateClusterSummary"],
        duplicate_candidates=dedup["duplicateCandidates"],
        timeline=[
            {
                "time": readable_now,
                "description": f"Authorized public-page post ingested from {post.page_name} into Signal Monitor as an unverified lead.",
            },
            {
                "time": readable_now,
                "description": f"AI structured location ({loc['canonicalRoad']}) and hazard ({clf['categoryLabel']}); queued for corroboration.",
            }
        ],
        is_user_submitted=False,
        map_coords=loc["mapCoords"],
    )

    db.add(new_signal)

    # Log to audit trail
    audit_entry = AuditLog(
        signal_id=signal_id,
        action="SOCIAL_FEED_INGESTED",
        details=f"Ingested authorized public {post.platform} post from {post.page_name} (URL: {post.post_url}).",
        user_name="Social Feed Collector",
        user_role="integration"
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(new_signal)
    return new_signal

