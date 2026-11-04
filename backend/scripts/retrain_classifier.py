"""Retrain the hazard classifier from editor-confirmed reports and print cross-validated accuracy.

    python -m scripts.retrain_classifier --min 30
Uses reports that reached editor approval/published and whose category an editor confirmed or corrected.
Writes nothing to disk: the model is rebuilt from the seed corpus + these labels at every start-up when you
wire `extra=` into get_classifier(); this script reports whether the extra data helps before you do.
"""
import argparse

from sqlalchemy import select

from app.ai.classifier import HazardClassifier
from app.db import SessionLocal
from app.models import Report, Status


def main(min_rows: int) -> None:
    db = SessionLocal()
    rows = db.execute(select(Report).where(Report.status.in_([Status.EDITOR_APPROVAL, Status.PUBLISHED]))).scalars().all()
    extra = [(r.text_original, r.category_key) for r in rows if r.text_original]
    base = HazardClassifier()
    print(f"seed-only cross-val accuracy: {base.cross_val_accuracy():.2f}")
    if len(extra) < min_rows:
        print(f"Only {len(extra)} confirmed reports (need {min_rows}). Keep collecting editor decisions.")
        return
    boosted = HazardClassifier(extra=extra)
    print(f"seed + {len(extra)} confirmed reports cross-val accuracy: {boosted.cross_val_accuracy():.2f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--min", type=int, default=30)
    main(ap.parse_args().min)
