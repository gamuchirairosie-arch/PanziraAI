"""Unauthenticated read-only API for the public dashboard. Only editor-approved, non-withdrawn alerts."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import PublicAlert
from ..security import rate_limit
from ..serializers import all_corridors, public_alert

router = APIRouter(prefix="/api/v1/public", tags=["public-v1"], dependencies=[Depends(rate_limit("public", 120, 60))])


@router.get("/alerts")
def alerts(category: str | None = None, corridor: str | None = None, limit: int = 100,
           db: Session = Depends(get_db)):
    stmt = select(PublicAlert).where(PublicAlert.withdrawn_at.is_(None)).order_by(PublicAlert.approved_at.desc())
    if category:
        stmt = stmt.where(PublicAlert.category_key == category)
    if corridor:
        stmt = stmt.where(PublicAlert.corridor_id == corridor)
    return [public_alert(a) for a in db.execute(stmt.limit(min(limit, 200))).scalars()]


@router.get("/alerts/{code}")
def alert(code: str, db: Session = Depends(get_db)):
    for a in db.execute(select(PublicAlert).where(PublicAlert.withdrawn_at.is_(None))).scalars():
        if a.public_code == code:
            return public_alert(a)
    raise HTTPException(404, "Alert not found")


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    n = db.scalar(select(func.count(PublicAlert.id)).where(PublicAlert.withdrawn_at.is_(None)))
    last = db.execute(select(PublicAlert).order_by(PublicAlert.approved_at.desc())).scalars().first()
    return {"approvedAlertsCount": n, "autoPublishedByAiCount": 0,
            "lastApprovedAtIso": last.approved_at.isoformat() if last else None}

