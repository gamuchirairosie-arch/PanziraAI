"""The verification workflow and the human-publish gate.

Received -> AI Extracted -> Corroboration -> Editor Approval -> Public Alert

Rules enforced HERE (not in the UI), so no client or integration can bypass them:
  * only the system pipeline may move received -> ai_extracted
  * only humans may corroborate; only an EDITOR may publish or reject
  * publishing requires all four checklist items, a human-reviewed translation (for sn/nd reports)
    and a named approver; the system actor can never publish
  * graphic media is never copied to the public alert
"""
from __future__ import annotations

from datetime import timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import audit
from .config import get_settings
from .models import PublicAlert, Report, Role, Status, TimelineEvent, utcnow
from .security import Actor

CAT = ZoneInfo("Africa/Harare")

TRANSITIONS: dict[str, dict[str, set[str]]] = {
    # from -> to -> roles allowed
    Status.RECEIVED: {Status.AI_EXTRACTED: {Role.SYSTEM}, Status.REJECTED: {Role.EDITOR}},
    Status.AI_EXTRACTED: {Status.CORROBORATION: {Role.JOURNALIST, Role.EDITOR},
                          Status.REJECTED: {Role.EDITOR}},
    Status.CORROBORATION: {Status.EDITOR_APPROVAL: {Role.JOURNALIST, Role.EDITOR},
                           Status.REJECTED: {Role.EDITOR}},
    Status.EDITOR_APPROVAL: {Status.PUBLISHED: {Role.EDITOR}, Status.CORROBORATION: {Role.JOURNALIST, Role.EDITOR},
                             Status.REJECTED: {Role.EDITOR}},
    Status.PUBLISHED: {},  # leaves via withdraw_alert()
    Status.REJECTED: {Status.AI_EXTRACTED: {Role.EDITOR}},  # reopen
}

CHECKS = ("chk_location_time", "chk_media_date", "chk_independent", "chk_still_present")


def fmt(dt) -> str:
    dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(CAT).strftime("%d %b %Y, %H:%M")


def add_timeline(db: Session, report: Report, actor: Actor | str, text: str) -> None:
    label = actor if isinstance(actor, str) else actor.label
    db.add(TimelineEvent(report_id=report.id, actor_label=label, description=text, ts=utcnow()))


def transition(db: Session, report: Report, to: str, actor: Actor, note: str | None = None) -> None:
    allowed = TRANSITIONS.get(report.status, {}).get(to)
    if allowed is None:
        raise HTTPException(409, f"Cannot move a report from '{report.status}' to '{to}'")
    if actor.role not in allowed:
        raise HTTPException(403, f"Role '{actor.role}' may not move a report to '{to}'")
    before = report.status
    report.status = to
    audit.record(db, actor, "status_change", "report", report.id, {"from": before, "to": to, "note": note})


def checklist_complete(r: Report) -> bool:
    return all(getattr(r, c) for c in CHECKS)


def set_check(db: Session, report: Report, field: str, value: bool, actor: Actor) -> None:
    if field not in CHECKS:
        raise HTTPException(422, "Unknown checklist item")
    if report.status in (Status.PUBLISHED, Status.REJECTED):
        raise HTTPException(409, "Report is closed; reopen it first")
    if report.status == Status.RECEIVED:
        raise HTTPException(409, "AI extraction has not finished yet")
    setattr(report, field, value)
    audit.record(db, actor, "checklist_set", "report", report.id, {"item": field, "value": value})
    add_timeline(db, report, actor, f"{'Completed' if value else 'Unchecked'} verification check: {field.removeprefix('chk_').replace('_', ' ')}.")

    if report.status == Status.AI_EXTRACTED and any(getattr(report, c) for c in CHECKS):
        transition(db, report, Status.CORROBORATION, actor)
    if report.status == Status.CORROBORATION and checklist_complete(report):
        report.checklist_completed_by = actor.id
        transition(db, report, Status.EDITOR_APPROVAL, actor, "all four checks complete")
        add_timeline(db, report, "system", "All four checks complete. Ready for editor approval.")
    elif report.status == Status.EDITOR_APPROVAL and not checklist_complete(report):
        transition(db, report, Status.CORROBORATION, actor, "check unticked")


def request_evidence(db: Session, report: Report, actor: Actor, note: str | None) -> None:
    if report.status in (Status.PUBLISHED, Status.REJECTED, Status.RECEIVED):
        raise HTTPException(409, "Evidence cannot be requested at this stage")
    if report.status == Status.AI_EXTRACTED:
        transition(db, report, Status.CORROBORATION, actor, "evidence requested")
    audit.record(db, actor, "evidence_requested", "report", report.id, {"note": note})
    add_timeline(db, report, actor, note or "Requested exact landmark, capture time and independent corroboration.")


def publish(db: Session, report: Report, actor: Actor) -> PublicAlert:
    s = get_settings()
    if actor.role != Role.EDITOR or actor.id is None:
        raise HTTPException(403, "Only a human editor can publish a public alert")
    if report.status != Status.EDITOR_APPROVAL:
        raise HTTPException(409, "Report must be at the editor-approval stage")
    if not checklist_complete(report):
        raise HTTPException(409, "All four verification checks must be complete before publishing")
    if not report.road_area.strip():
        raise HTTPException(409, "A road or area name is required before publishing")
    if report.language != "en" and not report.translation_reviewed:
        raise HTTPException(409, "A fluent editor must review the English translation before publishing")
    if s.require_four_eyes and report.checklist_completed_by == actor.id:
        raise HTTPException(409, "Four-eyes rule: a different editor must approve")

    when = utcnow()
    transition(db, report, Status.PUBLISHED, actor)
    sev = ("Critical severity" if report.is_critical or report.severity_label == "Critical"
           else "High severity" if report.severity_label == "High" else "Moderate severity")
    place = report.road_area + (f" ({report.landmark})" if report.landmark else "")
    desc = f"{report.category_label}: independently corroborated road hazard at {report.road_area}" + (
        f" ({report.landmark})." if report.landmark else ".")
    if report.is_graphic:
        desc += " Submitted scene imagery is withheld under Panzira's editorial graphic-safety policy."
    alert = PublicAlert(
        report_id=report.id, title=report.category_label + " · " + (report.road_area or "Unspecified road"),
        location=place, corridor_id=report.corridor_id, category_key=report.category_key,
        category_label=report.category_label, severity=sev, is_critical=report.is_critical or sev != "Moderate severity",
        description=desc,
        source_attribution=f"Independently corroborated (4/4 editorial checks) · Approved by {actor.label} on {fmt(when)}",
        lat=report.lat, lng=report.lng, approved_by_id=actor.id, approved_at=when,
    )
    db.add(alert)
    db.flush()
    add_timeline(db, report, actor, "Independently verified (4/4 checks) and approved for public alert.")
    audit.record(db, actor, "alert_published", "alert", alert.id, {"report": report.public_id})
    return alert


def reject(db: Session, report: Report, actor: Actor, reason: str | None) -> None:
    transition(db, report, Status.REJECTED, actor, reason)
    add_timeline(db, report, actor, reason or "Rejected: uncorroborated or insufficient location evidence. Withheld from public map.")


def withdraw_alert(db: Session, alert: PublicAlert, actor: Actor, reason: str) -> None:
    if actor.role != Role.EDITOR:
        raise HTTPException(403, "Only an editor can withdraw an alert")
    if alert.withdrawn_at:
        raise HTTPException(409, "Alert already withdrawn")
    alert.withdrawn_at, alert.withdrawn_by_id, alert.withdrawn_reason = utcnow(), actor.id, reason
    report = db.get(Report, alert.report_id)
    report.status = Status.CORROBORATION
    report.chk_still_present = False
    audit.record(db, actor, "alert_withdrawn", "alert", alert.id, {"reason": reason})
    add_timeline(db, report, actor, f"Public alert withdrawn: {reason}")
