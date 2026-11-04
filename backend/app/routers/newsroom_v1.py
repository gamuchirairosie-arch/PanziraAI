"""Corridors, briefs, alert withdrawal, audit trail and source registrations."""
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit, workflow
from ..corridors import BY_ID
from ..db import SessionLocal, get_db
from ..integrations import meta
from ..intake import clean_text, create_report
from ..models import AuditLog, Brief, PublicAlert, Report, Role, SourceRegistration
from ..security import (Actor, admin_only, client_ip, editor_only, newsroom, require_roles)
from ..serializers import all_corridors, brief_out, corridor_risk
from .reports import _bg_process, _get

router = APIRouter(prefix="/api/v1", tags=["newsroom-v1"])


# ---------- corridors ----------
@router.get("/corridors")
def corridors(actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    return all_corridors(db)


@router.get("/corridors/{cid}/risk")
def corridor(cid: str, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    cid = cid.upper().replace("A7-", "")
    if cid not in BY_ID:
        raise HTTPException(404, "Unknown corridor")
    return corridor_risk(db, cid)


# ---------- briefs ----------
class BriefIn(BaseModel):
    editorName: str = Field("", max_length=120)
    dateLabel: str = Field("", max_length=60)
    title: str = Field("", max_length=400)
    dek: str = Field("", max_length=2000)
    lead: str = Field("", max_length=4000)
    reportedPattern: str = Field("", max_length=4000)
    reportingPlan: str = Field("", max_length=4000)
    questionsForAuthorities: list[str] = Field(default_factory=list, max_length=20)
    editorNotes: str = Field("", max_length=4000)
    baseVersion: int | None = None


@router.get("/briefs/{inv}")
def get_brief(inv: str, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    b = db.execute(select(Brief).where(Brief.investigation_id == inv)).scalar_one_or_none()
    if not b:
        raise HTTPException(404, "Brief not found")
    return brief_out(b)


@router.put("/briefs/{inv}")
def put_brief(inv: str, body: BriefIn, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    b = db.execute(select(Brief).where(Brief.investigation_id == inv)).scalar_one_or_none()
    if b and body.baseVersion is not None and body.baseVersion != b.version:
        raise HTTPException(409, "Brief was changed by someone else. Reload before saving.")
    if not b:
        b = Brief(investigation_id=inv, version=0)
        db.add(b)
    b.editor_name, b.date_label = clean_text(body.editorName, 120), clean_text(body.dateLabel, 60)
    b.title, b.dek, b.lead = (clean_text(x, 4000) for x in (body.title, body.dek, body.lead))
    b.reported_pattern, b.reporting_plan = clean_text(body.reportedPattern, 4000), clean_text(body.reportingPlan, 4000)
    b.questions_for_authorities = [clean_text(q, 400) for q in body.questionsForAuthorities]
    b.editor_notes = clean_text(body.editorNotes, 4000)
    b.version += 1
    b.updated_by_id = actor.id
    db.flush()
    audit.record(db, actor, "brief_saved", "brief", inv, {"version": b.version})
    db.commit()
    return brief_out(b)


@router.post("/briefs/from-signal/{ref}")
def brief_from_signal(ref: str, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    """Scaffolds a brief the same way the frontend's 'open working brief' action does. Draft text is a starting
    point that stays attributed as unconfirmed until an editor changes it."""
    r = _get(db, ref)
    existing = db.execute(select(Brief).where(Brief.investigation_id == r.investigation_code)).scalar_one_or_none()
    if existing:
        return brief_out(existing)
    verified = r.status == "published"
    b = Brief(
        investigation_id=r.investigation_code, report_id=r.id, editor_name=actor.label,
        date_label=workflow.fmt(r.created_at)[:11],
        title=f"{r.category_label}: verification questions for {r.road_area or 'this location'}",
        dek=(f"Incoming {r.channel.replace('_', ' ')} submission ({r.public_id}) reports {r.category_label.lower()} "
             f"near {r.landmark or 'an unconfirmed landmark'}. Location precision and impact claims remain under editorial review."),
        lead=(f"A report observed at {workflow.fmt(r.observed_at or r.created_at)} describes {r.category_label.lower()} along "
              f"{r.road_area or 'an unconfirmed road'} [{r.public_id}]."
              + (" Core details have been independently verified by the desk." if verified
                 else " This account is an investigative lead, not an established fact.")),
        reported_pattern="", reporting_plan=("Establish an exact landmark and chronology; obtain independent on-the-ground confirmation; "
                                             "cross-check emergency-services incident logs."),
        questions_for_authorities=[
            "When was this road segment last inspected, and what was the recorded surface/drainage rating?",
            "Has the roads authority or local municipality received prior incident reports for this specific landmark in the last 14 days?",
            "Are maintenance crews or traffic-calming interventions scheduled for this corridor?",
        ],
        editor_notes=f"Scaffolded from incoming signal {r.public_id} for investigative tracking.",
        version=1, updated_by_id=actor.id,
    )
    db.add(b)
    db.flush()
    audit.record(db, actor, "brief_opened", "brief", b.investigation_id, {"source_report": r.public_id})
    db.commit()
    return brief_out(b)


# ---------- alerts ----------
class ReasonIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


@router.post("/alerts/{code}/withdraw")
def withdraw(code: str, body: ReasonIn, actor: Actor = Depends(editor_only), db: Session = Depends(get_db)):
    a = next((x for x in db.execute(select(PublicAlert)).scalars() if x.public_code == code), None)
    if not a:
        raise HTTPException(404, "Alert not found")
    workflow.withdraw_alert(db, a, actor, clean_text(body.reason, 500))
    db.commit()
    return {"withdrawn": True}


# ---------- audit ----------
@router.get("/audit")
def audit_list(entity_id: str | None = None, action: str | None = None, limit: int = 200,
               actor: Actor = Depends(require_roles(Role.EDITOR, Role.ADMIN)), db: Session = Depends(get_db)):
    stmt = select(AuditLog).order_by(AuditLog.id.desc())
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    return [{"id": a.id, "ts": a.ts.isoformat(), "actor": a.actor_label, "role": a.actor_role, "action": a.action,
             "entityType": a.entity_type, "entityId": a.entity_id, "detail": a.detail}
            for a in db.execute(stmt.limit(min(limit, 500))).scalars()]


@router.get("/audit/verify")
def audit_verify(actor: Actor = Depends(require_roles(Role.EDITOR, Role.ADMIN)), db: Session = Depends(get_db)):
    return audit.verify_chain(db)


# ---------- permitted social sources ----------
class SourceIn(BaseModel):
    platform: str = Field(pattern="^(facebook_page|instagram)$")
    account_id: str = Field(min_length=3, max_length=100)
    display_name: str = Field(min_length=2, max_length=200)
    basis: str = Field(min_length=10, max_length=500, description="Why we are allowed to read this account")


@router.post("/sources", status_code=201)
def register_source(body: SourceIn, request: Request, actor: Actor = Depends(admin_only), db: Session = Depends(get_db)):
    s = SourceRegistration(platform=body.platform, account_id=body.account_id, display_name=body.display_name,
                           basis=body.basis, registered_by_id=actor.id)
    db.add(s)
    db.flush()
    audit.record(db, actor, "source_registered", "source", s.id, {"platform": s.platform, "account": s.account_id},
                 client_ip(request))
    db.commit()
    return {"id": s.id}


@router.get("/sources")
def list_sources(actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    return [{"id": s.id, "platform": s.platform, "accountId": s.account_id, "name": s.display_name, "basis": s.basis,
             "active": s.active, "lastPolledAt": s.last_polled_at.isoformat() if s.last_polled_at else None}
            for s in db.execute(select(SourceRegistration)).scalars()]


@router.post("/sources/poll")
def poll(background: BackgroundTasks, actor: Actor = Depends(admin_only), db: Session = Depends(get_db)):
    res = meta.poll_registered_sources(db, Actor.system("system:social-ingest"))
    audit.record(db, actor, "social_poll", "source", "all", {k: v for k, v in res.items() if k != "report_ids"})
    db.commit()
    for rid in res.get("report_ids", []):
        background.add_task(_bg_process, rid)
    return {k: v for k, v in res.items() if k != "report_ids"}


class LinkIn(BaseModel):
    url: HttpUrl
    note: str = Field("", max_length=500)
    text: str = Field("", max_length=1500, description="Optional: the post text, typed or pasted by the person submitting")


@router.post("/ingest/public-link", status_code=201)
def ingest_link(body: LinkIn, background: BackgroundTasks, actor: Actor = Depends(newsroom),
                db: Session = Depends(get_db)):
    """A journalist records a PUBLIC post they found. We store the link, time and the text they supply; if Meta's
    oEmbed is configured we also record the public author/page name. We never fetch or scrape the post page."""
    url = str(body.url)
    host = body.url.host or ""
    if not any(h in host for h in ("facebook.com", "fb.com", "instagram.com", "x.com", "twitter.com")):
        raise HTTPException(422, "Only public Facebook, Instagram or X links are supported")
    oembed = meta.fetch_oembed(url) if ("facebook" in host or "instagram" in host) else None
    channel = "instagram" if "instagram" in host else "facebook_page" if "facebook" in host or "fb.com" in host else "public_link"
    text = clean_text(body.text) or clean_text(body.note) or f"Public post submitted as a lead: {url}"
    r, _, created = create_report(
        db, channel=channel, text=text, actor=actor, source_url=url, source_ref=f"link:{url}",
        source_account=(oembed or {}).get("author_name"),
    )
    db.commit()
    if created:
        background.add_task(_bg_process, r.id)
    return {"id": r.public_id, "created": created, "oembed": bool(oembed)}

