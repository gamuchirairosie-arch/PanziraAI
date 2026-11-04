"""Possible-duplicate detection across recent reports.

Score = category match + geographic proximity + time proximity + text similarity + image identity.
Output is a suggestion with reasons. Duplicates are NOT independent corroboration: the UI/editor must
treat linked reports as one source unless an editor confirms otherwise.
"""
from __future__ import annotations

from datetime import timedelta

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Evidence, Report, utcnow
from .images import hamming
from .locations import haversine_m

THRESHOLD = 0.55


def _when(r: Report):
    return r.observed_at or r.source_posted_at or r.created_at


def _aware(dt):
    return dt if dt.tzinfo else dt.replace(tzinfo=utcnow().tzinfo)


def find_duplicates(db: Session, report: Report, window_days: int = 30) -> list[dict]:
    since = utcnow() - timedelta(days=window_days)
    pool = db.execute(select(Report).where(Report.id != report.id, Report.created_at >= since)).scalars().all()
    if not pool:
        return []

    def text_of(r: Report) -> str:
        return (r.text_english or r.text_original or "").lower()

    texts = [text_of(report)] + [text_of(r) for r in pool]
    try:
        tf = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True).fit_transform(texts)
        sims = cosine_similarity(tf[0], tf[1:]).flatten()
    except ValueError:
        sims = np.zeros(len(pool))

    my_imgs = db.execute(select(Evidence).where(Evidence.report_id == report.id)).scalars().all()
    out = []
    for r, text_sim in zip(pool, sims):
        score, reasons = 0.0, []
        if r.category_key == report.category_key and report.category_key != "other":
            score += 0.2
            reasons.append("same hazard category")
        if report.lat is not None and r.lat is not None:
            d = haversine_m(report.lat, report.lng, r.lat, r.lng)
            if d <= 300:
                score += 0.3; reasons.append(f"within {int(d)} m")
            elif d <= 1000:
                score += 0.2; reasons.append(f"within {d / 1000:.1f} km")
            elif d <= 3000:
                score += 0.1; reasons.append(f"within {d / 1000:.1f} km")
        if report.corridor_id and report.corridor_id == r.corridor_id:
            score += 0.1; reasons.append("same corridor")
        if report.landmark and r.landmark and report.landmark.lower() == r.landmark.lower():
            score += 0.1; reasons.append("same landmark")
        dt = abs((_aware(_when(report)) - _aware(_when(r))).total_seconds())
        if dt <= 6 * 3600:
            score += 0.15; reasons.append("reported within 6 hours")
        elif dt <= 48 * 3600:
            score += 0.08; reasons.append("reported within 48 hours")
        if text_sim >= 0.35:
            score += min(0.3, float(text_sim) * 0.5); reasons.append(f"similar wording ({text_sim:.0%})")
        other_imgs = db.execute(select(Evidence).where(Evidence.report_id == r.id)).scalars().all()
        for a in my_imgs:
            for b in other_imgs:
                if a.sha256 == b.sha256:
                    score += 0.6; reasons.insert(0, "identical image file"); break
                if a.phash and b.phash and hamming(a.phash, b.phash) <= 8:
                    score += 0.5; reasons.insert(0, "visually near-identical image"); break
        if score >= THRESHOLD:
            out.append({"other_id": r.id, "score": round(min(score, 1.0), 2), "reasons": reasons})
    return sorted(out, key=lambda x: -x["score"])
