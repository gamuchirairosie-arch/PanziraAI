"""Shapes API output exactly like the frontend's TypeScript types (SignalReport, VerifiedPublicAlert,
CorridorWatchItem, WorkingBriefDraft) so the UI can swap localStorage for these endpoints with minimal change.

Public serializers are WHITELISTS: nothing is exposed unless it is listed here.
"""
from __future__ import annotations

import math
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .corridors import BY_ID, CORRIDORS
from .models import Brief, DuplicateLink, Evidence, PublicAlert, Report, Status, utcnow
from .security import Actor, media_token
from .workflow import fmt

CHANNEL_LABEL = {"web": "Citizen web", "whatsapp": "Opt-in WhatsApp", "sms": "SMS report", "ussd": "USSD report",
                 "facebook_page": "Public Facebook page", "instagram": "Instagram link",
                 "public_link": "Submitted public link"}
CHANNEL_SHORT = {"web": "Citizen web (opt-in)", "whatsapp": "WhatsApp opt-in", "sms": "SMS opt-in",
                 "ussd": "USSD opt-in", "facebook_page": "Authorized Facebook page",
                 "instagram": "Instagram link", "public_link": "Submitted public link"}
LANG_NAME = {"en": "English", "sn": "Shona", "nd": "Ndebele"}
CHECK_MISSING = {
    "chk_independent": "Independent confirmation of the hazard",
    "chk_location_time": "Precise landmark or GPS coordinate check",
    "chk_media_date": "Image capture date & provenance check",
    "chk_still_present": "Confirmation that the hazard is still present",
}
STAGE = {Status.RECEIVED: 1, Status.AI_EXTRACTED: 2, Status.CORROBORATION: 3, Status.EDITOR_APPROVAL: 4,
         Status.PUBLISHED: 4, Status.REJECTED: 2}


def map_pct(lat: float | None, lng: float | None) -> dict:
    s0, w0, n0, e0 = get_settings().map_bbox
    if lat is None or lng is None:
        return {"xPct": 50.0, "yPct": 50.0}
    x = (lng - w0) / (e0 - w0) * 100
    y = (n0 - lat) / (n0 - s0) * 100
    # points beyond the Bulawayo viewport sit on the nearest edge
    return {"xPct": round(min(96, max(4, x)), 1), "yPct": round(min(96, max(4, y)), 1)}


def _workflow(r: Report) -> str:
    return {Status.RECEIVED: "lead", Status.AI_EXTRACTED: "lead", Status.CORROBORATION: "verifying",
            Status.EDITOR_APPROVAL: "verifying", Status.PUBLISHED: "verified", Status.REJECTED: "rejected"}[r.status]


def _monitor_label(r: Report) -> tuple[str, str]:
    if r.status == Status.PUBLISHED:
        return "Verified · Approved", "green"
    if r.status == Status.REJECTED:
        return "Rejected · Archived", "red"
    if r.is_graphic:
        return "Graphic restricted", "red"
    if r.status == Status.EDITOR_APPROVAL:
        return "Ready for editor gate", "green"
    if r.status == Status.CORROBORATION:
        return "Verifying", "gold"
    if r.status == Status.AI_EXTRACTED:
        return ("Needs corroboration", "gold") if r.visibility == "public" else ("AI structured", "green")
    return "Received", "gold"


def media_links(db: Session, r: Report, actor: Actor) -> dict:
    ev = db.execute(select(Evidence).where(Evidence.report_id == r.id).order_by(Evidence.created_at)
                    ).scalars().first()
    if not ev:
        return {"photoType": "none"}
    base = f"/api/v1/evidence/{ev.id}"
    out = {
        "photoType": "custom-upload", "photoFilename": ev.original_filename, "evidenceId": ev.id,
        "photoPreviewUrl": f"{base}/preview?t={media_token(ev.id, 'preview', actor.id or 0)}",
        "photoRestricted": ev.is_graphic,
    }
    if not ev.is_graphic:  # graphic originals only via the audited reveal endpoint
        out["photoFullUrl"] = f"{base}/full?t={media_token(ev.id, 'full', actor.id or 0)}"
    return out


def to_signal(db: Session, r: Report, actor: Actor) -> dict:
    ai = r.ai or {}
    label, color = _monitor_label(r)
    wf = _workflow(r)
    corridor_name = BY_ID[r.corridor_id].name if r.corridor_id in BY_ID else (r.road_area or "Unassigned")
    chk = {"locationAndTime": r.chk_location_time, "mediaAndDate": r.chk_media_date,
           "independentSource": r.chk_independent, "hazardStillPresent": r.chk_still_present}
    pct = ai.get("confidence_percent", 0)
    evs = db.execute(select(Evidence).where(Evidence.report_id == r.id)).scalars().all()
    links = db.execute(select(DuplicateLink).where(
        (DuplicateLink.report_id == r.id) | (DuplicateLink.other_id == r.id), DuplicateLink.dismissed == False  # noqa: E712
    )).scalars().all()
    cands = []
    for l in links:
        oid = l.other_id if l.report_id == r.id else l.report_id
        o = db.get(Report, oid)
        if o:
            cands.append({
                "id": o.public_id, "sourceLabel": CHANNEL_SHORT[o.channel], "timestamp": fmt(o.created_at),
                "summary": (o.text_english or o.text_original)[:140],
                "quote": f"“{o.text_original[:160]}”",
                "locationNote": f"{o.road_area or 'Unknown'} · match {int(l.score * 100)}% ({', '.join(l.reasons[:3])})",
            })
    quote = f"“{r.text_original}”"
    missing = [txt for f, txt in CHECK_MISSING.items() if not getattr(r, f)] if r.status not in (
        Status.PUBLISHED, Status.REJECTED) else []
    out = {
        "id": r.public_id, "investigationCode": r.investigation_code,
        "sourceChannelLabel": CHANNEL_LABEL[r.channel], "sourceChannelShort": CHANNEL_SHORT[r.channel],
        "sourceBadgeColor": "red" if r.is_graphic else ("gold" if r.visibility == "public" else "green"),
        "visibility": r.visibility, "workflowStatus": wf, "monitorStatusLabel": label, "monitorStatusColor": color,
        "inboxStatusLine": f"{CHANNEL_LABEL[r.channel]} · {label}",
        "timeShort": fmt(r.created_at)[-5:], "reportedDateTime": fmt(r.source_posted_at or r.created_at),
        "observedIso": (r.observed_at or r.source_posted_at or r.created_at).isoformat(),
        "title": f"{r.category_label} · {r.road_area or 'Location pending'}",
        "inboxTitle": f"{r.category_label} · {r.road_area or 'Location pending'}",
        "subtitle": f"{r.landmark or 'Landmark unconfirmed'} · {CHANNEL_SHORT[r.channel]}",
        "corridor": corridor_name, "roadArea": r.road_area, "landmark": r.landmark,
        "categoryKey": r.category_key, "categoryLabel": r.category_label, "severityLabel": r.severity_label,
        "isCritical": r.is_critical, "originalLanguage": LANG_NAME[r.language], "originalQuote": quote,
        "draftEnglishTranslation": (f"{r.text_english}" if r.language != "en" and r.text_english else None),
        "translationReviewed": r.translation_reviewed, "translationMethod": r.translation_method,
        "sourceProvenanceNote": (
            f"{CHANNEL_SHORT[r.channel]} • Observed {fmt(r.observed_at or r.source_posted_at or r.created_at)} • "
            f"Received {fmt(r.created_at)}" + (f" • {r.source_account}" if r.source_account else "")
            + (" • contributor identity not disclosed" if r.visibility == "opt-in" else "")),
        "evidenceLink": r.source_url,
        "aiHazardType": r.category_label, "aiLikelyCorridor": corridor_name,
        "aiLanguageNote": ("English • original text" if r.language == "en" else
                           f"{LANG_NAME[r.language]} → English • draft translation, human review needed"),
        "aiLocationPrecision": r.location_precision, "aiConfidencePercent": pct,
        "aiConfidenceNote": ai.get("confidence_note", "Pending AI extraction"),
        "aiUncertainty": ai.get("uncertainty", []), "aiModel": ai.get("model"), "aiStatus": r.ai_status,
        "aiImageHeading": ("Potentially graphic submission — blurred for editorial safety" if r.is_graphic
                           else "Submitted photo" if evs else "Text-only submission (no photo attached)"),
        "aiImageSummary": ("Attachment restricted behind the newsroom blur gate. Never displayed on the public dashboard."
                           if r.is_graphic else "Image analysed for metadata and reuse; cannot establish location or recency."
                           if evs else "No photograph. Editors corroborate via independent witnesses or on-site checks."),
        "aiImageCaveat": "Automated image checks cannot establish location or recency without human verification.",
        "isGraphicImage": r.is_graphic, "graphicSafetyReason": r.graphic_reason,
        "pipelineStage": STAGE[r.status], "missingItems": missing, "checklist": chk,
        "editorialNotes": r.editorial_notes,
        "unconfirmedSummary": f"{r.category_label} reported at {r.road_area or 'an unconfirmed location'}"
                              f"{f' ({r.landmark})' if r.landmark else ''}. Pending independent editorial verification.",
        "duplicateClusterTitle": f"{len(cands) + 1} possible related reports" if cands else None,
        "duplicateClusterSummary": ("Linked by shared location, timing, wording or imagery. "
                                    "Duplicates are not independent corroboration.") if cands else None,
        "duplicateCandidates": cands,
        "timeline": [{"time": fmt(t.ts), "description": t.description} for t in r.timeline],
        "isUserSubmitted": r.visibility == "opt-in", "mapCoords": map_pct(r.lat, r.lng),
        "lat": r.lat, "lng": r.lng, "status": r.status,
    }
    out.update(media_links(db, r, actor))
    return out


def public_alert(a: PublicAlert) -> dict:
    """WHITELIST. No report id, contributor info, evidence, notes, or precise coordinates."""
    pin = {"potholes": "pinVerified1", "flooding": "pinVerified2", "collisions": "pinVerified0"}.get(
        a.category_key, "pinVerified3")
    return {
        "id": a.public_code, "title": a.title, "location": a.location,
        "corridor": BY_ID[a.corridor_id].name if a.corridor_id in BY_ID else (a.location.split(" (")[0]),
        "categoryKey": a.category_key, "categoryLabel": a.category_label, "severity": a.severity,
        "isCritical": a.is_critical, "updatedAgo": f"Approved {fmt(a.approved_at)}",
        "approvedAtIso": a.approved_at.isoformat(), "approvedAtReadable": fmt(a.approved_at),
        "description": a.description, "sourceAttribution": a.source_attribution,
        "desktopPin": {**map_pct(a.lat, a.lng), "pinAsset": pin},
        "approxLat": round(a.lat, 3) if a.lat is not None else None,
        "approxLng": round(a.lng, 3) if a.lng is not None else None,
    }


def brief_out(b: Brief) -> dict:
    return {
        "investigationId": b.investigation_id, "editorName": b.editor_name, "dateLabel": b.date_label,
        "title": b.title, "dek": b.dek, "lead": b.lead, "reportedPattern": b.reported_pattern,
        "reportingPlan": b.reporting_plan, "questionsForAuthorities": b.questions_for_authorities or [],
        "editorNotes": b.editor_notes, "version": b.version,
        "lastSavedAt": f"Saved {fmt(b.updated_at)}" if b.updated_at else None,
    }


# ---------- corridor intelligence ----------
_STATUS_W = {Status.RECEIVED: 0.4, Status.AI_EXTRACTED: 0.5, Status.CORROBORATION: 0.8,
             Status.EDITOR_APPROVAL: 1.0, Status.PUBLISHED: 1.5}


def corridor_risk(db: Session, cid: str, rank: int = 0) -> dict:
    c = BY_ID[cid]
    since = utcnow() - timedelta(days=30)
    rows = db.execute(select(Report).where(Report.corridor_id == cid, Report.created_at >= since,
                                           Report.status != Status.REJECTED)).scalars().all()
    now = utcnow()
    clusters: dict[str, list[Report]] = {}
    for r in rows:
        clusters.setdefault(r.duplicate_cluster_id or f"solo-{r.id}", []).append(r)
    independent = len(clusters)  # linked duplicates count once
    weight = 0.0
    for group in clusters.values():
        best = max(group, key=lambda x: _STATUS_W[x.status])
        age_days = max(0.0, (now - best.created_at.replace(tzinfo=best.created_at.tzinfo or now.tzinfo)).total_seconds() / 86400)
        weight += _STATUS_W[best.status] * math.exp(-age_days / 10)
    published = sum(1 for r in rows if r.status == Status.PUBLISHED)
    score = None if (independent < 2 and published == 0) else int(round(100 * (1 - math.exp(-0.45 * weight))))
    dup_candidates = len(rows) - independent
    if score is None:
        badge, color, conf = "Insufficient data", "gold", "Confidence: insufficient • No risk score issued"
        rec = "Recommended: request corroboration before action"
    elif published >= 2:
        badge, color, conf = ("Elevated · Verified" if score >= 60 else "Monitor · Verified"), ("red" if score >= 60 else "gold"), "Moderate confidence • includes editor-verified alerts"
        rec = "Recommended: review verified alerts before dispatch"
    else:
        badge, color = ("Elevated screening" if score >= 60 else "Monitor"), ("red" if score >= 60 else "gold")
        conf = "Low confidence • Do not reroute on this signal alone"
        rec = "Recommended: ask for on-site confirmation / driver check-in"
    cats = sorted({r.category_label for r in rows})
    pos, neg = [], []
    if len(rows) >= 2:
        pos.append(f"+ {len(rows)} related submissions in 30 days")
    if published:
        pos.append(f"+ {published} editor-verified alert(s)")
    if dup_candidates:
        neg.append(f"− {dup_candidates} reports linked as possible duplicates (not independent)")
    if not published:
        neg.append("− No editor-verified alert on this corridor")
    neg.append("− No validated crash-history model attached")
    return {
        "id": cid, "rank": f"{rank:02d}", "name": c.name, "fleetName": c.name, "badge": badge,
        "fleetBadge": badge + (" · Review" if score else ""), "badgeColor": color,
        "submissionsSummary": f"{len(rows)} related submissions · {dup_candidates} duplicate candidates",
        "hazardSummary": " · ".join(cats) or "No active reports",
        "patternNote": "Signal pattern from unverified and verified reports. Confirm source independence and location before issuing advice.",
        "fleetConfidenceLine": conf, "fleetRecommendation": rec,
        "scoreDisplay": f"{score} / 100" if score is not None else "Unscored", "scoreNumeric": score,
        "confidenceLabel": "Illustrative cluster-priority score · " + ("Low confidence" if not published else "Includes verified alerts"),
        "positiveFactors": pos, "negativeFactors": neg, "clusterCount": len(rows),
        "independentSources": independent, "verifiedAlerts": published,
        "apiEndpoint": f"GET /api/v1/corridors/{cid}/risk",
    }


def all_corridors(db: Session) -> list[dict]:
    items = [corridor_risk(db, c.id) for c in CORRIDORS]
    items.sort(key=lambda x: -(x["scoreNumeric"] or -1))
    for i, it in enumerate(items, 1):
        it["rank"] = f"{i:02d}"
    return items
