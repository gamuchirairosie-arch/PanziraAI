"""Location and road-name extraction using a gazetteer plus pattern rules.

Gazetteer coordinates are APPROXIMATE area centroids so the pipeline can place a lead on a map and
cluster it; they are never presented as exact positions. Replace with an OpenStreetMap-derived
gazetteer for production. Precision is reported explicitly and drives the confidence note.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass

from ..corridors import match_corridor


@dataclass(frozen=True)
class Place:
    name: str
    lat: float
    lng: float
    kind: str  # landmark | suburb | road | town
    aliases: tuple[str, ...] = ()


PLACES: list[Place] = [
    # Bulawayo landmarks / roads
    Place("ZESA Roundabout (Five Avenue)", -20.1495, 28.5840, "landmark", ("zesa roundabout", "zesa circle")),
    Place("Five Avenue", -20.1490, 28.5870, "road", ("five avenue", "fifth avenue", "5th avenue", "5th ave")),
    Place("Fife Street", -20.1560, 28.5810, "road", ("fife street", "fife st")),
    Place("Lobengula St & 12th Ave", -20.1590, 28.5830, "landmark",
          ("lobengula st and 12th", "lobengula street and 12th", "lobengula & 12th", "12th avenue")),
    Place("Lobengula Street", -20.1570, 28.5800, "road", ("lobengula street", "lobengula st", "lobengula")),
    Place("Khami Road", -20.1500, 28.5450, "road", ("khami road", "khami rd", "khami")),
    Place("Esigodini Road", -20.2200, 28.7200, "road", ("esigodini road",)),
    # suburbs
    Place("Mzilikazi", -20.1330, 28.5530, "suburb", ("mzilikazi",)),
    Place("Hillside", -20.1950, 28.6150, "suburb", ("hillside",)),
    Place("North End", -20.1280, 28.5890, "suburb", ("north end",)),
    Place("Suburbs", -20.1700, 28.5850, "suburb", ("suburbs",)),
    Place("Famona", -20.1750, 28.5650, "suburb", ("famona",)),
    Place("Luveve", -20.1280, 28.5250, "suburb", ("luveve",)),
    Place("Pumula", -20.1800, 28.4850, "suburb", ("pumula",)),
    Place("Nketa", -20.2050, 28.5350, "suburb", ("nketa",)),
    Place("Njube", -20.1600, 28.5300, "suburb", ("njube",)),
    Place("Bradfield", -20.1700, 28.5950, "suburb", ("bradfield",)),
    Place("Bulawayo CBD", -20.1561, 28.5817, "suburb", ("cbd", "city centre", "city center", "town centre")),
    # towns
    Place("Bulawayo", -20.1500, 28.5833, "town", ("bulawayo", "bulawayo", "koBulawayo")),
    Place("Plumtree", -20.4833, 27.8167, "town", ("plumtree",)),
    Place("Esigodini", -20.2833, 28.9333, "town", ("esigodini",)),
    Place("Gwanda", -20.9333, 29.0000, "town", ("gwanda",)),
    Place("Beitbridge", -22.2167, 30.0000, "town", ("beitbridge",)),
    Place("Gweru", -19.4500, 29.8167, "town", ("gweru",)),
    Place("Kwekwe", -18.9281, 29.8149, "town", ("kwekwe",)),
    Place("Masvingo", -20.0637, 30.8277, "town", ("masvingo",)),
    Place("Mutare", -18.9707, 32.6709, "town", ("mutare",)),
    Place("Harare", -17.8292, 31.0522, "town", ("harare",)),
    Place("Chitungwiza", -18.0127, 31.0756, "town", ("chitungwiza",)),
    Place("Victoria Falls", -17.9243, 25.8572, "town", ("victoria falls", "vic falls")),
    Place("Hwange", -18.3693, 26.5019, "town", ("hwange",)),
    Place("Lupane", -18.9333, 27.8000, "town", ("lupane",)),
    Place("Nyamandlovu", -20.0000, 28.2833, "town", ("nyamandlovu",)),
]

_KIND_RANK = {"landmark": 4, "road": 3, "suburb": 2, "town": 1}
_ROAD_REF = re.compile(r"(?<![A-Z0-9])A[-\s]?(\d{1,2})\b")
_KM = re.compile(r"\b(?:km\s*(?:peg|marker|mark)?\s*(\d{1,3})|(\d{1,3})\s*km\s*(?:peg|marker|mark)?)\b", re.I)
_PREFIX = r"(?:ne|pa|ku|kwa|ko|e|ku|ka)?"


def _compile(alias: str) -> re.Pattern:
    return re.compile(rf"(?<![A-Za-z]){_PREFIX}{re.escape(alias)}(?![A-Za-z])", re.I)


_COMPILED = [(p, a, _compile(a)) for p in PLACES for a in sorted(set(p.aliases) | {p.name.lower()}, key=len, reverse=True)]


def haversine_m(lat1, lng1, lat2, lng2) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def extract_locations(text: str) -> dict:
    found: dict[str, dict] = {}
    for place, alias, pat in _COMPILED:
        if place.name in found:
            continue
        m = pat.search(text)
        if m:
            found[place.name] = {"name": place.name, "lat": place.lat, "lng": place.lng, "kind": place.kind,
                                 "matched": m.group(0).strip()}
    cands = sorted(found.values(), key=lambda c: -_KIND_RANK[c["kind"]])

    road_refs = sorted({f"A{m.group(1)}" for m in _ROAD_REF.finditer(text)})
    km = next((int(g) for m in _KM.finditer(text) for g in m.groups() if g), None)
    corridor = match_corridor(text + " " + " ".join(road_refs))

    best = cands[0] if cands else None
    if best:
        precision = {"landmark": "landmark", "road": "road_only", "suburb": "area", "town": "town"}[best["kind"]]
    else:
        precision = "none"
    return {
        "candidates": cands[:6],
        "best": best,
        "road_refs": road_refs,
        "km_peg": km,
        "corridor_id": corridor,
        "precision": precision,
        "precision_text": {
            "landmark": "Named landmark · exact GPS missing",
            "road_only": "Road named · segment unconfirmed",
            "area": "Suburb/area only · exact point unknown",
            "town": "Town only · very low precision",
            "none": "No location found in text",
        }[precision],
    }
