"""Investigative Working Briefs Router

Stores, retrieves, and updates investigative newsroom reporting packages.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.database.models import WorkingBrief, User
from app.schemas.alert import WorkingBriefDraftSchema, WorkingBriefUpdate
from app.auth.dependencies import require_journalist
from app.audit.logger import log_editorial_action

router = APIRouter(prefix="/newsroom/briefs", tags=["Investigative Working Briefs"])


@router.get("", response_model=WorkingBriefDraftSchema)
def get_working_brief(
    current_user: User = Depends(require_journalist),
    db: Session = Depends(get_db)
):
    """Retrieves the active newsroom working brief draft."""
    brief = db.query(WorkingBrief).first()
    if not brief:
        raise HTTPException(status_code=404, detail="No active working brief found")
    return WorkingBriefDraftSchema.model_validate(brief)


@router.put("", response_model=WorkingBriefDraftSchema)
def update_working_brief(
    payload: WorkingBriefUpdate,
    current_user: User = Depends(require_journalist),
    db: Session = Depends(get_db)
):
    """Updates fields on the active investigative working brief."""
    brief = db.query(WorkingBrief).first()
    if not brief:
        raise HTTPException(status_code=404, detail="No active working brief found")

    if payload.title is not None:
        brief.title = payload.title
    if payload.dek is not None:
        brief.dek = payload.dek
    if payload.lead is not None:
        brief.lead = payload.lead
    if payload.reportedPattern is not None:
        brief.reported_pattern = payload.reportedPattern
    if payload.reportingPlan is not None:
        brief.reporting_plan = payload.reportingPlan
    if payload.questionsForAuthorities is not None:
        brief.questions_for_authorities = payload.questionsForAuthorities
    if payload.editorNotes is not None:
        brief.editor_notes = payload.editorNotes

    now_readable = datetime.utcnow().strftime("%d %b %Y, %H:%M")
    brief.last_saved_at = f"Saved {now_readable} CAT (newsroom draft)"

    log_editorial_action(
        db=db,
        action="BRIEF_UPDATED",
        details=f"Updated investigative brief {brief.investigation_id} by {current_user.full_name}.",
        signal_id=brief.investigation_id,
        user=current_user
    )

    db.commit()
    db.refresh(brief)
    return WorkingBriefDraftSchema.model_validate(brief)

