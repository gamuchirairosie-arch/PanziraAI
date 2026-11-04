"""Hash-chained audit trail and editorial action logging.

Every row stores hash = SHA256(prev_hash | canonical row content). Editing or deleting
a historic row breaks every hash after it, which `verify_chain` detects.
"""
import hashlib
import json
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AuditLog, utcnow
from ..security import Actor
from .logger import log_editorial_action

GENESIS = "0" * 64


def _digest(prev: str, row: dict) -> str:
    blob = json.dumps(row, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256((prev + blob).encode()).hexdigest()


def _row_content(ts: datetime, actor: Actor, action: str, etype: str, eid: str, detail, ip) -> dict:
    return {
        "ts": ts.replace(tzinfo=None).isoformat(),
        "actor_id": actor.id,
        "actor_label": actor.label,
        "actor_role": actor.role,
        "action": action,
        "entity_type": etype,
        "entity_id": str(eid),
        "detail": detail or {},
        "ip": ip,
    }


def record(db: Session, actor: Actor, action: str, entity_type: str, entity_id, detail: dict | None = None,
           ip: str | None = None) -> AuditLog:
    last = db.execute(select(AuditLog).order_by(AuditLog.id.desc()).limit(1)).scalar_one_or_none()
    prev = last.hash if last else GENESIS
    ts = utcnow()
    content = _row_content(ts, actor, action, entity_type, str(entity_id), detail, ip)
    row = AuditLog(
        ts=ts, actor_id=actor.id, actor_label=actor.label, actor_role=actor.role, action=action,
        entity_type=entity_type, entity_id=str(entity_id), detail=detail or {}, ip=ip,
        prev_hash=prev, hash=_digest(prev, content),
    )
    db.add(row)
    db.flush()
    return row


def verify_chain(db: Session) -> dict:
    prev = GENESIS
    count = 0
    for row in db.execute(select(AuditLog).order_by(AuditLog.id)).scalars():
        content = _row_content(row.ts, Actor(row.actor_id, row.actor_label, row.actor_role),
                               row.action, row.entity_type, row.entity_id, row.detail, row.ip)
        if row.prev_hash != prev or row.hash != _digest(prev, content):
            return {"ok": False, "broken_at": row.id, "checked": count}
        prev = row.hash
        count += 1
    return {"ok": True, "checked": count}

