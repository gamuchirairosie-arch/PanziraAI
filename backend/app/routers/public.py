"""Public Dashboard API Router

Supplies sanitized, approved road alerts to the public dashboard and
receives citizen web hazard submissions.

Strict Safety Policy:
- ONLY human-approved, verified alerts are returned to the public dashboard.
- Unverified leads and pending investigations are NEVER exposed to the public.
- Graphic scene imagery is PERMANENTLY excluded from public API responses.
- Submitting a citizen report NEVER auto-publishes; it enters stage 2 for human review.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.database.models import VerifiedPublicAlert, SignalReport, CorridorWatch
from app.schemas.alert import VerifiedPublicAlertResponse, CorridorWatchResponse
from app.schemas.signal import CitizenReportCreate, SignalReportResponse
from app.ml.pipeline import process_intake_pipeline
from app.audit.logger import log_editorial_action

router = APIRouter(prefix="/public", tags=["Public Dashboard"])


@router.get("/alerts", response_model=List[VerifiedPublicAlertResponse])
def get_verified_public_alerts(
    corridor: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Returns verified, editor-approved road safety alerts for the public dashboard.
    Strictly excludes uncorroborated leads, contact numbers, and graphic media.
    """
    query = db.query(VerifiedPublicAlert).order_by(VerifiedPublicAlert.created_at.desc())
    if corridor:
        query = query.filter(VerifiedPublicAlert.corridor == corridor)
    if category:
        query = query.filter(VerifiedPublicAlert.category_key == category)
    alerts = query.all()
    return [VerifiedPublicAlertResponse.model_validate(a) for a in alerts]


@router.get("/corridors", response_model=List[CorridorWatchResponse])
def get_corridor_watchlist(db: Session = Depends(get_db)):
    """Returns high-risk transit corridor intelligence metrics for public awareness."""
    corridors = db.query(CorridorWatch).all()
    return [CorridorWatchResponse.model_validate(c) for c in corridors]


@router.get("/status")
def get_public_platform_status(db: Session = Depends(get_db)):
    """Returns platform overview counters and editorial update timestamps."""
    verified_count = db.query(VerifiedPublicAlert).count()
    latest_alert = db.query(VerifiedPublicAlert).order_by(VerifiedPublicAlert.created_at.desc()).first()

    return {
        "status": "operational",
        "verifiedAlertsCount": verified_count,
        "autoPublishedByAiCount": 0,  # INVARIANT: Always 0
        "lastEditorialUpdate": latest_alert.approved_at_readable if latest_alert else "14:20 CAT",
        "editorialDeskNotice": "All alerts independently corroborated and verified by human editors before broadcast.",
    }


@router.post("/submit", response_model=SignalReportResponse)
def submit_citizen_report(
    report_input: CitizenReportCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Receives citizen web hazard submissions.
    Executes AI structuring (stage 2), attaches uncertainty warnings,
    and queues for human editor review.
    
    INVARIANT: Does NOT publish an alert to the public dashboard!
    """
    now = datetime.now(timezone.utc)
    readable_now = now.strftime("%d %b %Y, %H:%M")
    short_time = now.strftime("%H:%M")

    # Generate sequential PZ-DEMO-XXXX ID
    count = db.query(SignalReport).count()
    next_num = 430 + count
    signal_id = f"PZ-DEMO-{next_num}"
    inv_code = f"ROADS-{next_num}"

    # Run AI analysis pipeline
    ai_meta = process_intake_pipeline(report_input, db)
    clf = ai_meta["classification"]
    loc = ai_meta["location"]
    trans = ai_meta["translation"]
    vis = ai_meta["vision"]
    dedup = ai_meta["deduplication"]

    new_signal = SignalReport(
        id=signal_id,
        investigation_code=inv_code,
        source_channel_label="Citizen web",
        source_channel_short="Citizen web (opt-in)",
        source_badge_color="red" if vis["isGraphic"] else "green",
        visibility="opt-in",
        workflow_status="lead",
        monitor_status_label="Graphic restricted" if vis["isGraphic"] else "Unverified lead",
        monitor_status_color="red" if vis["isGraphic"] else "gold",
        inbox_status_line=f"Citizen web · {'Graphic restricted' if vis['isGraphic'] else 'Unverified lead'}",
        time_short=short_time,
        reported_date_time=report_input.reportedDateTime or readable_now,
        observed_iso=report_input.observedIso or now.isoformat(),
        title=f"{clf['categoryLabel']} · {report_input.roadArea}",
        inbox_title=f"{clf['categoryLabel']} · {report_input.roadArea}",
        subtitle=f"{report_input.landmark} · Citizen submission",
        corridor=loc["corridor"],
        road_area=report_input.roadArea,
        landmark=report_input.landmark,
        category_key=clf["categoryKey"],
        category_label=clf["categoryLabel"],
        severity_label=clf["severityLabel"],
        is_critical=clf["isCritical"],
        original_language=trans["sourceLanguage"],
        original_quote=f"“{report_input.description.strip()}”",
        draft_english_translation=trans["translatedText"],
        source_provenance_note=f"Citizen web opt-in submission • Observed {report_input.reportedDateTime or readable_now} • contributor identity unconfirmed",
        evidence_link=report_input.evidenceLink,
        ai_hazard_type=clf["categoryLabel"],
        ai_likely_corridor=loc["aiLikelyCorridor"],
        ai_language_note=trans["languageNote"],
        ai_location_precision=loc["aiLocationPrecision"],
        ai_confidence_percent=ai_meta["confidencePercent"],
        ai_confidence_note=ai_meta["confidenceNote"],
        ai_image_heading=vis["heading"],
        ai_image_summary=vis["summary"],
        ai_image_caveat=vis["caveat"],
        photo_type=report_input.photoType,
        custom_photo_data_url=report_input.customPhotoDataUrl,  # Stored for newsroom desk only
        photo_filename=report_input.photoFilename,
        photo_caption=f"Citizen web upload ({signal_id}): {report_input.photoFilename or 'photo.jpg'}" if vis["hasPhoto"] else None,
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
        editorial_notes="",
        unconfirmed_summary=f"Citizen submission reporting {clf['categoryLabel'].lower()} at {report_input.roadArea} ({report_input.landmark}). Pending independent editorial verification.",
        duplicate_cluster_title=dedup["duplicateClusterTitle"],
        duplicate_cluster_summary=dedup["duplicateClusterSummary"],
        duplicate_candidates=dedup["duplicateCandidates"],
        timeline=[
            {
                "time": readable_now,
                "description": f"Citizen report ({signal_id}) received via web form. Held off public map pending human verification.",
            }
        ],
        is_user_submitted=True,
        map_coords=loc["mapCoords"],
    )

    db.add(new_signal)
    log_editorial_action(
        db=db,
        action="CITIZEN_REPORT_SUBMITTED",
        details=f"New report submitted from web form: {signal_id} ({clf['categoryLabel']} at {report_input.roadArea}). Held off public map.",
        signal_id=signal_id,
        ip_address=request.client.host if request.client else None
    )
    db.commit()
    db.refresh(new_signal)
    return SignalReportResponse.model_validate(new_signal)
