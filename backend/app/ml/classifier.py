"""ML Road Hazard Classifier

Classifies incoming citizen and social reports into hazard categories,
computes severity, confidence scores, and uncertainty indicators.
"""

import re
from typing import Dict, Any, Tuple

# Multilingual keywords for hazard categories
KEYWORD_TAXONOMY = {
    "potholes": {
        "en": ["pothole", "potholes", "crater", "trench", "corrugated", "washed-out shoulder", "road damage", "damaged surface", "edge collapse", "broken tarmac"],
        "sn": ["gomba", "makomba", "mupata", "mugwagwa wakafa", "kutsauka", "zvakakanganisika"],
        "nd": ["umgodi", "amagodi", "umgwaqo owonakele", "ukubhidlika", "izimbobo"],
    },
    "flooding": {
        "en": ["flood", "flooding", "water", "drain", "drains", "standing water", "overflow", "submerged", "puddle", "torrent", "bridge covered"],
        "sn": ["mvura", "mvura yazara", "rwizi", "kufashukira", "dhureni rakavharika", "mupopoma"],
        "nd": ["amanzi", "amanzi amanengi", "isikhukhula", "ukugcwala", "amadamu", "umfula ugcwele"],
    },
    "collisions": {
        "en": ["crash", "collision", "accident", "overturned", "wreck", "hit", "smash", "breakdown", "blocking traffic", "truck stalled", "head-on", "stationary"],
        "sn": ["tsaona", "yakatsaukana", "mota yakarovera", "yapunzika", "yadonha", "mota yamira"],
        "nd": ["ingozi", "izingozi", "yatholana", "ukutshayisana", "imoto yemile", "ukubambana"],
    },
    "visibility": {
        "en": ["lights", "streetlights", "dark", "visibility", "unlit", "blackout", "smoke", "fog", "sign missing", "signage", "road markings", "roundabout lights"],
        "sn": ["magetsi", "rima", "magetsi emumugwagwa", "kusviba", "marambi", "hationi"],
        "nd": ["izibane", "ubumnyama", "izibane zomgwaqo", "asiboni", "akukhanyi"],
    },
    "other": {
        "en": ["tree", "livestock", "cows", "cattle", "donkey", "rock", "boulder", "debris", "oil spill", "barrier"],
        "sn": ["muti", "mhou", "mombe", "matombo", "marara", "donki"],
        "nd": ["isihlahla", "inkomo", "amatshe", "izidumbu", "ingulube", "amadonki"],
    }
}

SEVERITY_WEIGHTS = {
    "collisions": ("High", True),
    "flooding": ("High", False),
    "potholes": ("Review needed", False),
    "visibility": ("Review needed", False),
    "other": ("Review needed", False),
}

CATEGORY_LABELS = {
    "potholes": "Road surface damage",
    "flooding": "Flooding",
    "collisions": "Collision or breakdown",
    "visibility": "Visibility & lighting",
    "other": "Other road hazard",
}


def classify_hazard(text: str, user_selected_category: str = None) -> Dict[str, Any]:
    """
    Classifies hazard based on multilingual keywords, returning predicted category,
    confidence score (0-100), severity, and uncertainty note.
    """
    normalized_text = text.lower()
    scores = {cat: 0 for cat in KEYWORD_TAXONOMY}
    
    matched_terms = []
    
    for category, lang_dict in KEYWORD_TAXONOMY.items():
        for lang, words in lang_dict.items():
            for word in words:
                pattern = r'\b' + re.escape(word) + r'\b'
                matches = len(re.findall(pattern, normalized_text))
                if matches > 0:
                    scores[category] += matches * 2
                    matched_terms.append(f"{word} ({lang})")

    # If the user explicitly selected a category, give it a baseline boost
    if user_selected_category and user_selected_category in scores:
        scores[user_selected_category] += 3

    # Find highest scoring category
    best_category = max(scores, key=scores.get)
    best_score = scores[best_category]

    if best_score == 0:
        predicted_category = user_selected_category or "other"
        confidence_pct = 48
        uncertainty = "Low confidence: no specific hazard keywords matched. Requires human editor review."
    elif best_score <= 2:
        predicted_category = best_category
        confidence_pct = 58
        uncertainty = "Moderate confidence: single keyword indicator. Requires independent corroboration."
    else:
        predicted_category = best_category
        confidence_pct = min(78, 60 + best_score * 4)
        uncertainty = f"Keywords detected: {', '.join(matched_terms[:3])}. AI classification remains advisory."

    severity_label, is_critical = SEVERITY_WEIGHTS.get(predicted_category, ("Review needed", False))
    
    # Check if text mentions fatalities or severe multi-vehicle collision
    if any(k in normalized_text for k in ["head-on", "fatal", "trapped", "fire", "fuel tanker", "kufa", "kufela"]):
        severity_label = "Critical"
        is_critical = True

    return {
        "categoryKey": predicted_category,
        "categoryLabel": CATEGORY_LABELS.get(predicted_category, "Road hazard"),
        "severityLabel": severity_label,
        "isCritical": is_critical,
        "confidencePercent": confidence_pct,
        "uncertaintyNote": uncertainty,
        "matchedKeywords": matched_terms,
    }

