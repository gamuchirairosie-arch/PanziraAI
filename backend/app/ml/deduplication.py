"""ML Deduplication & Correlation Engine

Identifies potential duplicate reports based on corridor proximity,
hazard category, temporal proximity, and textual similarity.
"""

import re
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database.models import SignalReport


def tokenize(text: str) -> set:
    """Extract lowercased word tokens of length >= 3."""
    return set(re.findall(r'\b[a-z0-9]{3,}\b', text.lower()))


def compute_jaccard_similarity(set_a: set, set_b: set) -> float:
    """Calculate Jaccard index between two token sets."""
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a.intersection(set_b))
    union = len(set_a.union(set_b))
    return intersection / union if union > 0 else 0.0


def find_duplicate_candidates(
    new_road_area: str,
    new_landmark: str,
    new_category_key: str,
    new_description: str,
    db: Session,
    exclude_id: Optional[str] = None,
    limit: int = 3
) -> Dict[str, Any]:
    """
    Scans the database for potential duplicate or correlating reports.
    Returns matched duplicate candidates and cluster summaries.
    """
    # Fetch recent active signals
    query = db.query(SignalReport).filter(
        SignalReport.workflow_status.in_(["lead", "verifying", "verified"])
    )
    if exclude_id:
        query = query.filter(SignalReport.id != exclude_id)
        
    existing_signals = query.order_by(SignalReport.created_at.desc()).limit(30).all()
    
    new_tokens = tokenize(f"{new_road_area} {new_landmark} {new_description}")
    candidates = []

    for sig in existing_signals:
        sig_tokens = tokenize(f"{sig.road_area} {sig.landmark} {sig.original_quote}")
        sim = compute_jaccard_similarity(new_tokens, sig_tokens)

        # Match criteria: same category + corridor overlap or high text similarity
        corridor_match = (
            sig.category_key == new_category_key and (
                new_road_area.lower() in sig.road_area.lower() or
                sig.road_area.lower() in new_road_area.lower() or
                (new_landmark and new_landmark.lower() in (sig.landmark or "").lower())
            )
        )

        score = sim * 0.5 + (0.5 if corridor_match else 0.0)

        if score >= 0.25 or corridor_match:
            candidates.append({
                "id": sig.id,
                "sourceLabel": sig.source_channel_label,
                "timestamp": sig.reported_date_time,
                "summary": sig.inbox_title or sig.title,
                "quote": sig.original_quote[:120] + ("..." if len(sig.original_quote) > 120 else ""),
                "locationNote": f"{sig.road_area} ({sig.landmark})",
                "similarityScore": round(score, 2),
            })

    # Sort descending by similarity
    candidates.sort(key=lambda c: c["similarityScore"], reverse=True)
    top_candidates = candidates[:limit]

    cluster_title = None
    cluster_summary = None

    if top_candidates:
        first = top_candidates[0]
        cluster_title = f"Possible link to corridor cluster ({first['id']})"
        cluster_summary = (
            f"Overlaps geographically with {len(top_candidates)} active report(s) along {new_road_area}. "
            "Editors must verify whether reporters are independent witnesses before counting as corroboration."
        )

    return {
        "duplicateCandidates": top_candidates,
        "duplicateClusterTitle": cluster_title,
        "duplicateClusterSummary": cluster_summary,
    }

