"""WhatsApp Webhook Integration

Handles citizen-initiated, opt-in WhatsApp submissions.
Strict Policy:
Never scrape private WhatsApp groups without authorization. Only user-initiated,
direct messages sent to the authorized newsroom tipline are ingested.
"""

import hashlib
from datetime import datetime, timezone
from typing import Dict, Any
from sqlalchemy.orm import Session

from app.schemas.integration import WhatsAppWebhookEntry
from app.schemas.signal import CitizenReportCreate
from app.ml.pipeline import process_intake_pipeline
from app.database.models import SignalReport, AuditLog


def pseudonymize_phone(phone: str) -> str:
    """Masks personal phone number for privacy protection (e.g., +263***4589)."""
    clean = phone.strip()
    if len(clean) >= 7:
        return f"{clean[:4]}***{clean[-4:]}"
    return "Source identifier hidden"


def ingest_whatsapp_message(entry: WhatsAppWebhookEntry, db: Session) -> SignalReport:
    """
    Ingests an opt-in WhatsApp message, validates consent, executes AI intake,
    and stores the signal in the database.
    """
    if not entry.user_consented_opt_in:
        raise ValueError(
            "Opt-in consent missing. Panzira strictly requires user-initiated consent "
            "and refuses unauthorized scraping of private groups."
        )

    # Generate sequential PZ-SIG-XXXX ID
    count = db.query(SignalReport).count()
    next_num = 43 + count
    signal_id = f"PZ-SIG-00{next_num}" if next_num < 100 else f"PZ-SIG-0{next_num}"
    inv_code = f"ROADS-04{next_num}"

    now = datetime.now(timezone.utc)
    readable_now = now.strftime("%d %b %Y, %H:%M")
    short_time = now.strftime("%H:%M")
    masked_source = pseudonymize_phone(entry.from_number)

    # Formulate citizen report input for ML pipeline
    # Try to extract road / area from text
    report_input = CitizenReportCreate(
        categoryKey="other",  # Will be classified by ML
        categoryLabel="Road hazard",
        roadArea="Transit Corridor",  # Extracted by ML
        landmark=f"WhatsApp report ({masked_source})",
        description=entry.message_body,
        reportedDateTime=readable_now,
        observedIso=now.isoformat(),
        language="English",  # ML translator will auto-detect Shona / Ndebele
        photoType="none",
        sourceChannelLabel="Opt-in WhatsApp",
        sourceChannelShort="WhatsApp opt-in",
        sourceProvenanceNote=f"{masked_source} • {readable_now} • citizen-submitted via WhatsApp tipline",
    )

    # Run AI / ML intake pipeline
    ai_meta = process_intake_pipeline(report_input, db)

    clf = ai_meta["classification"]
    loc = ai_meta["location"]
    trans = ai_meta["translation"]
    vis = ai_meta["vision"]
    dedup = ai_meta["deduplication"]

    # Build DB Model
    new_signal = SignalReport(
        id=signal_id,
        investigation_code=inv_code,
        source_channel_label="Opt-in WhatsApp",
        source_channel_short="WhatsApp opt-in",
        source_badge_color="green",
        visibility="opt-in",
        workflow_status="lead",
        monitor_status_label="AI structured",
        monitor_status_color="green",
        inbox_status_line="Opt-in WhatsApp · AI structured",
        time_short=short_time,
        reported_date_time=readable_now,
        observed_iso=now.isoformat(),
        title=f"{clf['categoryLabel']} · {loc['canonicalRoad']}",
        inbox_title=f"{clf['categoryLabel']} · {loc['canonicalRoad']}",
        subtitle=f"User-initiated WhatsApp report · {trans['sourceLanguage']}",
        corridor=loc["corridor"],
        road_area=loc["canonicalRoad"],
        landmark=loc["landmark"],
        category_key=clf["categoryKey"],
        category_label=clf["categoryLabel"],
        severity_label=clf["severityLabel"],
        is_critical=clf["isCritical"],
        original_language=trans["sourceLanguage"],
        original_quote=f"“{entry.message_body.strip()}”",
        draft_english_translation=trans["translatedText"],
        source_provenance_note=f"{masked_source} • {readable_now} • citizen-submitted via WhatsApp tipline",
        ai_hazard_type=clf["categoryLabel"],
        ai_likely_corridor=loc["aiLikelyCorridor"],
        ai_language_note=trans["languageNote"],
        ai_location_precision=loc["aiLocationPrecision"],
        ai_confidence_percent=ai_meta["confidencePercent"],
        ai_confidence_note=ai_meta["confidenceNote"],
        ai_image_heading=vis["heading"],
        ai_image_summary=vis["summary"],
        ai_image_caveat=vis["caveat"],
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
        editorial_notes="Citizen-initiated WhatsApp tip. Verified opt-in compliance.",
        unconfirmed_summary=f"WhatsApp report describing {clf['categoryLabel'].lower()} along {loc['canonicalRoad']}.",
        duplicate_cluster_title=dedup["duplicateClusterTitle"],
        duplicate_cluster_summary=dedup["duplicateClusterSummary"],
        duplicate_candidates=dedup["duplicateCandidates"],
        timeline=[
            {
                "time": readable_now,
                "description": f"Citizen-initiated WhatsApp tip ({signal_id}) ingested into Signal Monitor as an unverified lead.",
            },
            {
                "time": readable_now,
                "description": f"AI structured hazard type ({clf['categoryLabel']}) and corridor ({loc['canonicalRoad']}); held off public map pending human verification.",
            }
        ],
        is_user_submitted=True,
        map_coords=loc["mapCoords"],
    )

    db.add(new_signal)

    # Log to audit trail
    audit_entry = AuditLog(
        signal_id=signal_id,
        action="WHATSAPP_INTAKE_RECEIVED",
        details=f"Received user-initiated WhatsApp report from {masked_source}. Pipeline stage 2 (AI structured).",
        user_name="WhatsApp Webhook Service",
        user_role="integration"
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(new_signal)
    return new_signal
