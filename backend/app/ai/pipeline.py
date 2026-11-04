"""AI processing pipeline: received -> ai_extracted.

Everything here produces SUGGESTIONS. The pipeline runs as the SYSTEM actor, which the workflow
refuses to let publish or reject. A failure leaves the report in `received` for human triage.
"""
from __future__ import annotations

import traceback
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..config import get_settings
from ..corridors import BY_ID
from ..models import DuplicateLink, Evidence, Report, Status, utcnow
from ..security import Actor
from ..workflow import add_timeline, fmt, transition
from .classifier import get_classifier
from .duplicates import find_duplicates
from .language import NAME_TO_CODE, detect_language, translate_to_english
from .lexicon import CATEGORY_LABELS
from .locations import extract_locations, haversine_m

SYSTEM = Actor.system("system:ai-pipeline")

_HIGH_HARM = ("injur", "dead", "death", "fatal", "killed", "overturn", "ambulance", "vakakuvara", "balimele",
              "vafa", "bafile", "casualt")
_HIGH_ROAD = ("deep", "huge", "big", "crater", "swerv", "tyre", "rakadzika", "omkhulu", "kutsauka", "burst")


def _infer_severity(category: str, text: str) -> tuple[str, bool]:
    t = text.lower()
    if category == "collisions":
        return ("High", True) if any(k in t for k in _HIGH_HARM) else ("High", False)
    if category == "flooding":
        return "High", False
    if category == "potholes" and any(k in t for k in _HIGH_ROAD):
        return "High", False
    return "Review needed", False


def _image_checks(report: Report, evs: list[Evidence], loc: dict) -> tuple[list[str], list[str]]:
    """Returns (graphic_reasons, provenance_notes)."""
    s = get_settings()
    graphic, notes = [], []
    for e in evs:
        if e.graphic_score >= s.graphic_threshold:
            graphic.append(f"colour screen score {e.graphic_score:.2f} ≥ {s.graphic_threshold}")
        ex = e.exif or {}
        if not ex.get("has_exif"):
            notes.append("Photo has no metadata (common for WhatsApp-compressed images): time and place unverified")
        if ex.get("captured_at") and report.observed_at:
            cap = datetime.fromisoformat(ex["captured_at"])
            obs = report.observed_at.replace(tzinfo=None)
            if abs((cap - obs).total_seconds()) > 24 * 3600:
                notes.append("Photo capture time differs from the claimed observation time by more than 24 h")
        if ex.get("gps"):
            ref = (report.lat, report.lng) if report.lat is not None else (
                (loc["best"]["lat"], loc["best"]["lng"]) if loc.get("best") else None)
            if ref and haversine_m(ex["gps"]["lat"], ex["gps"]["lng"], ref[0], ref[1]) > 5000:
                notes.append("Photo GPS is more than 5 km from the reported location")
    return graphic, notes


def process_report(db: Session, report_id: int) -> None:
    report = db.get(Report, report_id)
    if report is None or report.status not in (Status.RECEIVED,):
        return
    try:
        _run(db, report)
        db.commit()
    except Exception as exc:  # never lose a report because AI failed
        db.rollback()
        report = db.get(Report, report_id)
        report.ai_status = "failed"
        audit.record(db, SYSTEM, "ai_failed", "report", report.id, {"error": repr(exc)[:300],
                                                                  "trace": traceback.format_exc()[-600:]})
        add_timeline(db, report, "system", "AI extraction failed; flagged for manual triage.")
        db.commit()


def _run(db: Session, report: Report) -> None:
    clf = get_classifier()
    uncertainty: list[str] = []

    # 1. language
    det = detect_language(report.text_original)
    if report.language_source != "reporter":
        report.language = det["code"]
    elif det["code"] != report.language and det["confidence"] >= 0.7:
        uncertainty.append(f"language_mismatch_reporter_said_{report.language}_text_looks_{det['code']}")

    # 2. translation (draft)
    tr = translate_to_english(report.text_original, report.language)
    report.text_english = tr["text"]
    report.translation_method = tr["method"]
    report.translation_reviewed = tr["reviewed"]
    if not tr["reviewed"]:
        uncertainty.append("machine_translation_unreviewed")

    # 3. classification
    pred = clf.predict(report.text_original)
    uncertainty += pred["uncertainty"]
    if report.category_source == "reporter":
        agree = pred["label"] == report.category_key
        if not agree:
            uncertainty.append(f"ai_suggests_{pred['label']}_reporter_chose_{report.category_key}")
    else:
        report.category_key = pred["label"]
        report.category_label = CATEGORY_LABELS[pred["label"]]

    # 4. locations
    search_text = " ".join(x for x in [report.road_area, report.landmark, report.text_original] if x)
    loc = extract_locations(search_text)
    if not report.road_area:
        # a named road/corridor is more useful than the nearest town when the text mentions both
        if loc["road_refs"] and loc["corridor_id"] in BY_ID:
            report.road_area = BY_ID[loc["corridor_id"]].name
        elif loc["best"]:
            report.road_area = loc["best"]["name"]
        elif loc["road_refs"]:
            report.road_area = loc["road_refs"][0]
    if loc["best"] and report.lat is None:
        report.lat, report.lng = loc["best"]["lat"], loc["best"]["lng"]
    if not report.landmark:
        lm = next((c for c in loc["candidates"] if c["kind"] in ("landmark",)), None)
        if lm:
            report.landmark = lm["name"]
    report.corridor_id = report.corridor_id or loc["corridor_id"]
    report.location_precision = ("GPS supplied by reporter (unverified)" if report.gps_reported
                                 else loc["precision_text"])
    if loc["precision"] in ("none", "town"):
        uncertainty.append("location_imprecise")
    if loc["km_peg"] is None and loc["road_refs"]:
        uncertainty.append("no_kilometre_peg")

    # 5. severity
    report.severity_label, report.is_critical = _infer_severity(report.category_key, report.text_english or "")

    # 6. images / graphic safety
    evs = db.execute(select(Evidence).where(Evidence.report_id == report.id)).scalars().all()
    graphic_reasons, image_notes = _image_checks(report, evs, loc)
    if evs and report.category_key == "collisions":
        graphic_reasons.append("collision report with attached imagery (restricted by default)")
    if report.is_graphic and report.graphic_reason:  # reporter flagged it
        graphic_reasons.append(report.graphic_reason)
    if graphic_reasons:
        report.is_graphic = True
        report.graphic_reason = "; ".join(dict.fromkeys(graphic_reasons))
        for e in evs:
            e.is_graphic = True  # restrict every attachment of a flagged report
    uncertainty += [n for n in image_notes]

    # 7. duplicates
    dups = find_duplicates(db, report)
    for d in dups:
        exists = db.execute(select(DuplicateLink).where(DuplicateLink.report_id == report.id,
                                                        DuplicateLink.other_id == d["other_id"])).scalar_one_or_none()
        if not exists:
            db.add(DuplicateLink(report_id=report.id, other_id=d["other_id"], score=d["score"], reasons=d["reasons"]))
    if dups:
        other = db.get(Report, dups[0]["other_id"])
        report.duplicate_cluster_id = other.duplicate_cluster_id or f"CL-{min(report.id, other.id):04d}"
        if not other.duplicate_cluster_id:
            other.duplicate_cluster_id = report.duplicate_cluster_id
        uncertainty.append("possible_duplicate_of_existing_report")

    # 8. confidence (never authorises publication)
    conf = pred["confidence"]
    if report.category_source == "reporter" and pred["label"] == report.category_key:
        conf += 0.05
    if "location_imprecise" in uncertainty:
        conf -= 0.10
    if "machine_translation_unreviewed" in uncertainty:
        conf -= 0.05
    if not evs and not report.gps_reported:
        conf -= 0.04
    pct = int(round(max(0.15, min(0.92, conf)) * 100))

    report.ai = {
        "model": pred["model"],
        "hazard_probs": pred["probs"],
        "confidence_percent": pct,
        "confidence_note": f"{pct}% • insufficient to publish",
        "uncertainty": sorted(set(uncertainty)),
        "language": det,
        "translation": {"method": tr["method"], "note": tr["note"]},
        "locations": loc,
        "corridor_name": BY_ID[report.corridor_id].name if report.corridor_id in BY_ID else None,
        "duplicates": dups[:5],
        "images": [{"id": e.id, "graphic_score": e.graphic_score, "phash": e.phash, "exif": e.exif,
                    "analysis": e.analysis} for e in evs],
        "provenance_notes": image_notes,
        "processed_at": utcnow().isoformat(),
    }
    report.ai_status = "done"
    transition(db, report, Status.AI_EXTRACTED, SYSTEM, "AI extraction complete")
    add_timeline(db, report, "system:ai-pipeline",
                 f"AI structured hazard type ({report.category_label}), location ({report.location_precision}) "
                 f"and language ({report.language}). Suggestions only; queued for corroboration.")
    audit.record(db, SYSTEM, "ai_extracted", "report", report.id,
                 {"confidence": pct, "uncertainty": sorted(set(uncertainty))})
