"""SMS & USSD Low-Bandwidth Intake Gateway

Ingests rapid mobile reports from offline or low-connectivity citizen environments
via SMS gateway or USSD menu (*140#).
"""

from datetime import datetime, timezone
from typing import Dict, Any
from sqlalchemy.orm import Session

from app.schemas.integration import SmsReport, UssdReport
from app.schemas.signal import CitizenReportCreate
from app.integrations.whatsapp import pseudonymize_phone
from app.ml.pipeline import process_intake_pipeline
from app.database.models import SignalReport, AuditLog


def ingest_sms_report(sms: SmsReport, db: Session) -> SignalReport:
    """Ingests a low-bandwidth SMS citizen report into the verification pipeline."""
    count = db.query(SignalReport).count()
    next_num = 45 + count
    signal_id = f"PZ-SIG-00{next_num}" if next_num < 100 else f"PZ-SIG-0{next_num}"
    inv_code = f"ROADS-04{next_num}"

    now = datetime.now(timezone.utc)
    readable_now = now.strftime("%d %b %Y, %H:%M")
    short_time = now.strftime("%H:%M")
    masked_phone = pseudonymize_phone(sms.sender_phone)

    report_input = CitizenReportCreate(
        categoryKey="other",
        categoryLabel="Road hazard",
        roadArea="Transit Corridor",
        landmark=f"SMS report ({masked_phone})",
        description=sms.body,
        reportedDateTime=readable_now,
        observedIso=now.isoformat(),
        language="English",
        photoType="none",
        sourceChannelLabel="Low-bandwidth SMS",
        sourceChannelShort="Citizen SMS (opt-in)",
        sourceProvenanceNote=f"{masked_phone} • {readable_now} • citizen-submitted via low-bandwidth SMS",
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
        source_channel_label="Low-bandwidth SMS",
        source_channel_short="Citizen SMS (opt-in)",
        source_badge_color="green",
        visibility="opt-in",
        workflow_status="lead",
        monitor_status_label="AI structured",
        monitor_status_color="green",
        inbox_status_line="Citizen SMS · AI structured",
        time_short=short_time,
        reported_date_time=readable_now,
        observed_iso=now.isoformat(),
        title=f"{clf['categoryLabel']} · {loc['canonicalRoad']}",
        inbox_title=f"{clf['categoryLabel']} · {loc['canonicalRoad']}",
        subtitle=f"Low-bandwidth SMS report · {trans['sourceLanguage']}",
        corridor=loc["corridor"],
        road_area=loc["canonicalRoad"],
        landmark=loc["landmark"],
        category_key=clf["categoryKey"],
        category_label=clf["categoryLabel"],
        severity_label=clf["severityLabel"],
        is_critical=clf["isCritical"],
        original_language=trans["sourceLanguage"],
        original_quote=f"“{sms.body.strip()}”",
        draft_english_translation=trans["translatedText"],
        source_provenance_note=f"{masked_phone} • {readable_now} • citizen-submitted via SMS",
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
        is_graphic_image=False,
        pipeline_stage=2,
        missing_items=ai_meta["missingItems"],
        checklist={
            "locationAndTime": False,
            "mediaAndDate": False,
            "independentSource": False,
            "hazardStillPresent": False,
        },
        editorial_notes="Inbound SMS intake. Contributor identity pseudonymized.",
        unconfirmed_summary=f"SMS report describing {clf['categoryLabel'].lower()} at {loc['canonicalRoad']}.",
        duplicate_cluster_title=dedup["duplicateClusterTitle"],
        duplicate_cluster_summary=dedup["duplicateClusterSummary"],
        duplicate_candidates=dedup["duplicateCandidates"],
        timeline=[
            {
                "time": readable_now,
                "description": f"Citizen SMS report ({signal_id}) received from {masked_phone}.",
            }
        ],
        is_user_submitted=True,
        map_coords=loc["mapCoords"],
    )

    db.add(new_signal)
    audit = AuditLog(
        signal_id=signal_id,
        action="SMS_INTAKE_RECEIVED",
        details=f"Received low-bandwidth SMS from {masked_phone}.",
        user_name="SMS Gateway",
        user_role="integration"
    )
    db.add(audit)
    db.commit()
    db.refresh(new_signal)
    return new_signal


def ingest_ussd_report(ussd: UssdReport, db: Session) -> SignalReport:
    """Ingests a structured USSD (*140#) menu submission."""
    count = db.query(SignalReport).count()
    next_num = 46 + count
    signal_id = f"PZ-SIG-00{next_num}" if next_num < 100 else f"PZ-SIG-0{next_num}"
    inv_code = f"ROADS-04{next_num}"

    now = datetime.now(timezone.utc)
    readable_now = now.strftime("%d %b %Y, %H:%M")
    short_time = now.strftime("%H:%M")
    masked_phone = pseudonymize_phone(ussd.phone_number)

    desc = f"USSD report: {ussd.selected_hazard_type} along {ussd.selected_corridor} near {ussd.landmark_text}."

    report_input = CitizenReportCreate(
        categoryKey="other",
        categoryLabel=ussd.selected_hazard_type,
        roadArea=ussd.selected_corridor,
        landmark=ussd.landmark_text,
        description=desc,
        reportedDateTime=readable_now,
        observedIso=now.isoformat(),
        language="English",
        photoType="none",
        sourceChannelLabel="USSD Menu (*140#)",
        sourceChannelShort="USSD intake (opt-in)",
        sourceProvenanceNote=f"{masked_phone} • {readable_now} • *140# USSD session {ussd.session_id}",
    )

    ai_meta = process_intake_pipeline(report_input, db)
    clf = ai_meta["classification"]
    loc = ai_meta["location"]
    vis = ai_meta["vision"]
    dedup = ai_meta["deduplication"]

    new_signal = SignalReport(
        id=signal_id,
        investigation_code=inv_code,
        source_channel_label="USSD Menu (*140#)",
        source_channel_short="USSD intake (opt-in)",
        source_badge_color="green",
        visibility="opt-in",
        workflow_status="lead",
        monitor_status_label="AI structured",
        monitor_status_color="green",
        inbox_status_line="USSD intake · AI structured",
        time_short=short_time,
        reported_date_time=readable_now,
        observed_iso=now.isoformat(),
        title=f"{clf['categoryLabel']} · {ussd.selected_corridor}",
        inbox_title=f"{clf['categoryLabel']} · {ussd.selected_corridor}",
        subtitle=f"USSD *140# report · {ussd.landmark_text}",
        corridor=loc["corridor"],
        road_area=ussd.selected_corridor,
        landmark=ussd.landmark_text,
        category_key=clf["categoryKey"],
        category_label=clf["categoryLabel"],
        severity_label=ussd.severity_level or "High",
        is_critical=clf["isCritical"],
        original_language="English",
        original_quote=f"“{desc}”",
        draft_english_translation=None,
        source_provenance_note=f"{masked_phone} • {readable_now} • *140# USSD session {ussd.session_id}",
        ai_hazard_type=clf["categoryLabel"],
        ai_likely_corridor=loc["aiLikelyCorridor"],
        ai_language_note="English • USSD menu selection",
        ai_location_precision=loc["aiLocationPrecision"],
        ai_confidence_percent=ai_meta["confidencePercent"],
        ai_confidence_note=ai_meta["confidenceNote"],
        ai_image_heading=vis["heading"],
        ai_image_summary=vis["summary"],
        ai_image_caveat=vis["caveat"],
        photo_type="none",
        is_graphic_image=False,
        pipeline_stage=2,
        missing_items=ai_meta["missingItems"],
        checklist={
            "locationAndTime": False,
            "mediaAndDate": False,
            "independentSource": False,
            "hazardStillPresent": False,
        },
        editorial_notes=f"Ingested from USSD menu session {ussd.session_id}.",
        unconfirmed_summary=f"USSD report of {clf['categoryLabel'].lower()} along {ussd.selected_corridor}.",
        duplicate_cluster_title=dedup["duplicateClusterTitle"],
        duplicate_cluster_summary=dedup["duplicateClusterSummary"],
        duplicate_candidates=dedup["duplicateCandidates"],
        timeline=[
            {
                "time": readable_now,
                "description": f"USSD *140# submission received from {masked_phone} (Session: {ussd.session_id}).",
            }
        ],
        is_user_submitted=True,
        map_coords=loc["mapCoords"],
    )

    db.add(new_signal)
    audit = AuditLog(
        signal_id=signal_id,
        action="USSD_INTAKE_RECEIVED",
        details=f"Received USSD submission from {masked_phone} for {ussd.selected_corridor}.",
        user_name="USSD Gateway",
        user_role="integration"
    )
    db.add(audit)
    db.commit()
    db.refresh(new_signal)
    return new_signal

