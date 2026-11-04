"""Editorial Audit Trail Logging Service

Maintains an immutable, append-only record of editorial verification decisions,
checklist changes, evidence requests, and note updates.
"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.database.models import AuditLog, User


def log_editorial_action(
    db: Session,
    action: str,
    details: str,
    signal_id: Optional[str] = None,
    user: Optional[User] = None,
    ip_address: Optional[str] = None
) -> AuditLog:
    """Creates and persists an audit log record."""
    audit_entry = AuditLog(
        timestamp=datetime.now(timezone.utc),
        user_id=user.id if user else None,
        user_name=user.full_name if user else "Public Submitter",
        user_role=user.role if user else "public",
        signal_id=signal_id,
        action=action,
        details=details,
        ip_address=ip_address,
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry
