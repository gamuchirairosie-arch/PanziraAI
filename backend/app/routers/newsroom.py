"""Newsroom Desk API Router

Handles verification workflows, checklist evaluation, evidence requests,
investigative notes, and the Editor Gate for public broadcast.

Strict Safety Policy:
- Verifying and publishing a signal requires the human 'editor' or 'admin' role.
- All 4 independent verification checklist items must be checked before approval.
- An immutable audit trail entry is created for every editorial action.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.database.models import SignalReport, VerifiedPublicAlert, User, AuditLog
from app.schemas.signal import (
    SignalReportResponse,
    ChecklistToggleRequest,
    EditorialNotesUpdate,
    EvidenceRequest,
    RejectSignalRequest,
)
from app.auth.dependencies import require_journalist, require_editor
from app.audit.logger import log_editorial_action
from app.integrations.telegram import send_legacy_approved_alert

router = APIRouter(prefix="/newsroom", tags=["Newsroom Editorial Desk"])


@router.get("/signals", response_model=List[SignalReportResponse])
def get_all_signals(
    status_filter: Optional[str] = Query(None, alias="status"),
    corridor_filter: Optional[str] = Query(None, alias="corridor"),
    search: Optional[str] = None,
    current_user: User = Depends(require_journalist),
    db: Session = Depends(get_db)
):
    """
    Retrieves all signal reports for the Newsroom desk.
    Accessible to authenticated journalists and editors.
    """
    query = db.query(SignalReport).order_by(SignalReport.created_at.desc())

    if status_filter:
        query = query.filter(SignalReport.workflow_status == status_filter)
    if corridor_filter:
        query = query.filter(SignalReport.corridor == corridor_filter)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (SignalReport.title.ilike(search_term)) |
            (SignalReport.road_area.ilike(search_term)) |
            (SignalReport.landmark.ilike(search_term)) |
            (SignalReport.original_quote.ilike(search_term))
        )

    signals = query.all()
    return [SignalReportResponse.model_validate(s) for s in signals]


@router.get("/signals/{signal_id}", response_model=SignalReportResponse)
def get_single_signal(
    signal_id: str,
    current_user: User = Depends(require_journalist),
    db: Session = Depends(get_db)
):
    """Retrieves full details of a single signal report including newsroom evidence."""
    sig = db.query(SignalReport).filter(SignalReport.id == signal_id).first()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal report not found")
    return SignalReportResponse.model_validate(sig)


@router.post("/signals/{signal_id}/checklist", response_model=SignalReportResponse)
def toggle_checklist_item(
    signal_id: str,
    payload: ChecklistToggleRequest,
    current_user: User = Depends(require_journalist),
    db: Session = Depends(get_db)
):
    """
    Toggles one of the 4 independent verification criteria:
    - locationAndTime
    - mediaAndDate
    - independentSource
    - hazardStillPresent
    """
    sig = db.query(SignalReport).filter(SignalReport.id == signal_id).first()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal report not found")

    checklist = dict(sig.checklist or {})
    current_val = checklist.get(payload.field, False)
    checklist[payload.field] = not current_val
    sig.checklist = checklist

    # Evaluate how many checks are met
    met_count = sum(1 for v in checklist.values() if v)

    if sig.workflow_status != "verified":
        if met_count == 4:
            sig.pipeline_stage = 4
            sig.monitor_status_label = "Ready for editor gate"
        elif met_count > 0:
            sig.pipeline_stage = 3
            sig.workflow_status = "verifying"
            sig.monitor_status_label = "Verifying"
        else:
            sig.pipeline_stage = 2
            sig.workflow_status = "lead"
            sig.monitor_status_label = "Unverified lead"

    log_editorial_action(
        db=db,
        action="CHECKLIST_TOGGLED",
        details=f"Toggled '{payload.field}' to {checklist[payload.field]} ({met_count}/4 checks met).",
        signal_id=signal_id,
        user=current_user
    )

    db.commit()
    db.refresh(sig)
    return SignalReportResponse.model_validate(sig)


@router.put("/signals/{signal_id}/notes", response_model=SignalReportResponse)
def update_editorial_notes(
    signal_id: str,
    payload: EditorialNotesUpdate,
    current_user: User = Depends(require_journalist),
    db: Session = Depends(get_db)
):
    """Updates internal newsroom desk notes on a signal."""
    sig = db.query(SignalReport).filter(SignalReport.id == signal_id).first()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal report not found")

    sig.editorial_notes = payload.notes
    log_editorial_action(
        db=db,
        action="EDITORIAL_NOTE_UPDATED",
        details="Updated editorial investigation notes.",
        signal_id=signal_id,
        user=current_user
    )
    db.commit()
    db.refresh(sig)
    return SignalReportResponse.model_validate(sig)


@router.post("/signals/{signal_id}/request-evidence", response_model=SignalReportResponse)
def request_evidence(
    signal_id: str,
    payload: EvidenceRequest,
    current_user: User = Depends(require_journalist),
    db: Session = Depends(get_db)
):
    """Logs an evidence follow-up request to the original contributor or ground reporter."""
    sig = db.query(SignalReport).filter(SignalReport.id == signal_id).first()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal report not found")

    now = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M")
    note_text = payload.note or f"Editor {current_user.full_name} requested exact landmark, timestamp, and independent corroboration."

    sig.workflow_status = "verifying"
    sig.monitor_status_label = "Evidence requested"
    sig.monitor_status_color = "gold"
    sig.inbox_status_line = f"{sig.source_channel_label} · Evidence requested"
    sig.pipeline_stage = 3

    current_timeline = list(sig.timeline or [])
    current_timeline.append({
        "time": now,
        "description": note_text
    })
    sig.timeline = current_timeline

    log_editorial_action(
        db=db,
        action="EVIDENCE_REQUESTED",
        details=note_text,
        signal_id=signal_id,
        user=current_user
    )
    db.commit()
    db.refresh(sig)
    return SignalReportResponse.model_validate(sig)


@router.post("/signals/{signal_id}/reject", response_model=SignalReportResponse)
def reject_signal(
    signal_id: str,
    payload: RejectSignalRequest,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db)
):
    """Archives/rejects uncorroborated leads or spam. Withholds from public map."""
    sig = db.query(SignalReport).filter(SignalReport.id == signal_id).first()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal report not found")

    now = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M")
    reason_text = payload.reason or f"Rejected by Editor {current_user.full_name} — uncorroborated or insufficient location evidence."

    sig.workflow_status = "rejected"
    sig.monitor_status_label = "Rejected · Archived"
    sig.monitor_status_color = "red"
    sig.inbox_status_line = f"{sig.source_channel_label} · Rejected"

    current_timeline = list(sig.timeline or [])
    current_timeline.append({
        "time": now,
        "description": reason_text
    })
    sig.timeline = current_timeline

    log_editorial_action(
        db=db,
        action="SIGNAL_REJECTED",
        details=reason_text,
        signal_id=signal_id,
        user=current_user
    )
    db.commit()
    db.refresh(sig)
    return SignalReportResponse.model_validate(sig)


@router.post("/signals/{signal_id}/verify", response_model=SignalReportResponse)
def verify_and_publish_signal(
    signal_id: str,
    background: BackgroundTasks,
    current_user: User = Depends(require_editor),
    db: Session = Depends(get_db)
):
    """
    CRITICAL HUMAN-IN-THE-LOOP EDITOR GATE:
    Verifies a signal and broadcasts a verified alert to the public dashboard.
    
    Requirements:
    1. Authenticated user must have 'editor' or 'admin' role (enforced by require_editor).
    2. All 4 independent checklist items must be TRUE.
    3. Graphic scene images are STRICTLY withheld from public alert broadcast.
    """
    sig = db.query(SignalReport).filter(SignalReport.id == signal_id).first()
    if not sig:
        raise HTTPException(status_code=404, detail="Signal report not found")

    checklist = sig.checklist or {}
    all_checked = all([
        checklist.get("locationAndTime", False),
        checklist.get("mediaAndDate", False),
        checklist.get("independentSource", False),
        checklist.get("hazardStillPresent", False),
    ])

    if not all_checked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Editor approval gate: Complete all 4 independent verification checks before verifying and publishing.",
        )

    approved_now = datetime.now(timezone.utc)
    readable_approval = approved_now.strftime("%d %b %Y, %H:%M")

    # Update Signal State
    sig.workflow_status = "verified"
    sig.pipeline_stage = 4
    sig.monitor_status_label = "Verified · Approved"
    sig.monitor_status_color = "green"
    sig.inbox_status_line = f"{sig.source_channel_label} · Verified"
    sig.missing_items = []

    timeline = list(sig.timeline or [])
    timeline.append({
        "time": readable_approval,
        "description": f"Independently verified (4/4 checks) and approved for public alert by Editor {current_user.full_name}."
    })
    sig.timeline = timeline

    # Create Public Alert if not already published
    existing_alert = db.query(VerifiedPublicAlert).filter(VerifiedPublicAlert.source_signal_id == signal_id).first()
    if not existing_alert:
        pin_asset = (
            "pinVerified2" if sig.category_key == "flooding"
            else "pinVerified0" if sig.category_key == "collisions"
            else "pinVerified1"
        )

        # Graphic safety check: permanently exclude graphic media from public descriptions
        graphic_notice = " Submitted scene imagery withheld under Panzira editorial graphic-safety policy." if sig.is_graphic_image else ""
        public_description = (
            f"{sig.category_label}: Independently corroborated road hazard at {sig.road_area} "
            f"({sig.landmark}).{graphic_notice}"
        )

        public_alert = VerifiedPublicAlert(
            id=f"PZ-PUB-{signal_id}",
            source_signal_id=signal_id,
            title=sig.inbox_title or sig.title,
            location=f"{sig.road_area}{f' ({sig.landmark})' if sig.landmark else ''}",
            corridor=sig.corridor,
            category_key=sig.category_key,
            category_label=sig.category_label,
            severity="Critical severity" if sig.is_critical else "High severity" if sig.severity_label == "High" else "Moderate severity",
            is_critical=bool(sig.is_critical or sig.severity_label == "High"),
            updated_ago=f"Approved {readable_approval}",
            approved_at_iso=approved_now.isoformat(),
            approved_at_readable=readable_approval,
            description=public_description,
            source_attribution=f"Independently corroborated (4/4 editorial checks) · Approved by {current_user.full_name} on {readable_approval}",
            desktop_pin={
                "xPct": sig.map_coords.get("xPct", 50.0),
                "yPct": sig.map_coords.get("yPct", 50.0),
                "pinAsset": pin_asset,
            },
            lat=sig.reported_lat if sig.gps_reported else None,
            lng=sig.reported_lng if sig.gps_reported else None,
            approved_by_user_id=current_user.id,
            approved_by_name=current_user.full_name,
        )
        db.add(public_alert)

    # Log to immutable audit trail
    log_editorial_action(
        db=db,
        action="SIGNAL_VERIFIED_AND_PUBLISHED",
        details=f"Signal {signal_id} verified with 4/4 checks and broadcast as public alert PZ-PUB-{signal_id}.",
        signal_id=signal_id,
        user=current_user
    )

    db.commit()
    db.refresh(sig)
    if not existing_alert:
        background.add_task(send_legacy_approved_alert, f"PZ-PUB-{signal_id}")
    return SignalReportResponse.model_validate(sig)


@router.get("/audit-logs")
def get_audit_trail(
    limit: int = 50,
    current_user: User = Depends(require_journalist),
    db: Session = Depends(get_db)
):
    """Retrieves immutable audit trail of recent editorial and intake actions."""
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return logs
