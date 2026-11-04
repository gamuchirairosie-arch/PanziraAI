"""ML Location & Corridor Extractor

Extracts transit corridors, junctions, landmarks, and precision metadata
from incoming road hazard descriptions and location fields.
"""

import re
from typing import Dict, Any, Tuple

# Corridor Definitions & Coordinates in Bulawayo Grid
CORRIDOR_DEFINITIONS = [
    {
        "id": "A5",
        "name": "A5 · Bulawayo–Plumtree",
        "canonical_road": "A5 Bulawayo–Plumtree Road",
        "keywords": ["a5", "plumtree", "bellevue", "belmont", "donnington", "plumtree road", "plumtree turn-off", "bellevue turn-off"],
        "base_coords": {"xPct": 24.0, "yPct": 68.0},
    },
    {
        "id": "KHAMI",
        "name": "Khami Road Corridor",
        "canonical_road": "Khami Road, Bulawayo",
        "keywords": ["khami", "mzilikazi", "kelvin", "kelvin north", "westgate", "steeldale", "thorngrove", "khami flyover"],
        "base_coords": {"xPct": 28.0, "yPct": 43.0},
    },
    {
        "id": "ESIGODINI",
        "name": "Esigodini Road · A7",
        "canonical_road": "Esigodini Road (A7), Bulawayo",
        "keywords": ["esigodini", "a7", "gwanda", "ascot", "hillside", "matsheumhlope", "matsheumhlope stream", "burnside"],
        "base_coords": {"xPct": 76.0, "yPct": 74.0},
    },
    {
        "id": "CBD",
        "name": "Bulawayo CBD / Inner Ring",
        "canonical_road": "Bulawayo Central / Inner Arterials",
        "keywords": ["cbd", "five avenue", "zesa", "zesa roundabout", "lobengula", "12th avenue", "leopold takawira", "robert mugabe", "jason moyo"],
        "base_coords": {"xPct": 54.0, "yPct": 52.0},
    },
    {
        "id": "LUVEVE",
        "name": "Luveve Road Corridor",
        "canonical_road": "Luveve Road, Bulawayo",
        "keywords": ["luveve", "entumbane", "mpopoma", "gwabalanda", "matshobana", "luveve flyover"],
        "base_coords": {"xPct": 38.0, "yPct": 28.0},
    },
    {
        "id": "A6",
        "name": "A6 · Victoria Falls Road",
        "canonical_road": "A6 Victoria Falls Road",
        "keywords": ["a6", "victoria falls", "vic falls", "north end", "richmond", "sauerstown"],
        "base_coords": {"xPct": 58.0, "yPct": 24.0},
    }
]

LANDMARK_PATTERNS = [
    r'(?:near|pedyo ne|eduze le|at|opposite|approaching|past)\s+([A-Za-z0-9\s\-–\.\/]+?)(?:,|\.|\sand\s|\swith\s|$)',
    r'(?:turn-off|roundabout|circle|flyover|bridge|junction|intersection|robots|lights)',
]


def extract_location_entities(road_area_input: str, landmark_input: str, description_input: str) -> Dict[str, Any]:
    """
    Extracts corridor identity, canonical road name, normalized coordinates,
    and precision rating from submitted inputs.
    """
    combined_text = f"{road_area_input} {landmark_input} {description_input}".lower()

    matched_corridor = None
    max_keyword_matches = 0

    for corridor in CORRIDOR_DEFINITIONS:
        matches = 0
        for kw in corridor["keywords"]:
            if re.search(r'\b' + re.escape(kw) + r'\b', combined_text):
                matches += len(kw.split()) + 1  # Weight multi-word matches higher
        if matches > max_keyword_matches:
            max_keyword_matches = matches
            matched_corridor = corridor

    if not matched_corridor:
        # Default fallback to CBD center if unknown
        matched_corridor = CORRIDOR_DEFINITIONS[3]
        ai_corridor_label = road_area_input.strip() or "Bulawayo Urban Area"
        precision = "Broad area description · GPS coordinates unconfirmed"
        confidence_reduction = 15
    else:
        ai_corridor_label = matched_corridor["name"]
        confidence_reduction = 0

    # Determine precision based on landmarks
    has_specific_junction = any(j in combined_text for j in [
        "roundabout", "circle", "turn-off", "flyover", "junction", "intersection", "robots", "bridge", "zesa"
    ])
    has_gps_coords = bool(re.search(r'-?\d{1,2}\.\d{4,},\s*-?\d{1,2}\.\d{4,}', combined_text))

    if has_gps_coords:
        precision = "Verified GPS coordinate · corridor junction check needed"
    elif has_specific_junction:
        precision = "Named junction · lane direction unconfirmed"
    elif landmark_input.strip():
        precision = "Reporter landmark description · GPS unverified"
    else:
        precision = "Corridor-level estimate only · specific landmark missing"

    # Derive map coords with slight natural jitter based on text length to prevent pin stacking
    jitter_x = (len(combined_text) % 5) * 1.5 - 3.0
    jitter_y = (len(landmark_input) % 4) * 1.2 - 2.0
    coords = {
        "xPct": round(matched_corridor["base_coords"]["xPct"] + jitter_x, 1),
        "yPct": round(matched_corridor["base_coords"]["yPct"] + jitter_y, 1),
    }

    return {
        "corridor": matched_corridor["name"],
        "canonicalRoad": road_area_input.strip() or matched_corridor["canonical_road"],
        "landmark": landmark_input.strip() or "Unspecified landmark",
        "aiLikelyCorridor": f"{matched_corridor['name']} ({ai_corridor_label})",
        "aiLocationPrecision": precision,
        "mapCoords": coords,
        "confidenceReduction": confidence_reduction,
    }

