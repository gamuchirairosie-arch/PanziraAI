"""Corridor registry. Labels and ids mirror the frontend watchlist.

Confirm official road designations with the Department of Roads / ZINARA before the pitch;
only this file needs to change.
"""
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Corridor:
    id: str
    name: str
    aliases: tuple[str, ...]
    anchor: tuple[float, float]  # lat, lng of a representative point


CORRIDORS: list[Corridor] = [
    Corridor("A5", "A5 · Bulawayo–Plumtree",
             ("a5", "plumtree road", "plumtree", "bulawayo-plumtree", "bulawayo–plumtree"), (-20.30, 28.20)),
    Corridor("KHAMI", "Khami Road · Mzilikazi",
             ("khami road", "khami", "mzilikazi"), (-20.150, 28.545)),
    Corridor("ESIGODINI", "A7 · Esigodini corridor",
             ("a7", "esigodini", "esigodini road"), (-20.28, 28.93)),
    Corridor("CBD", "Central / Suburbs",
             ("five avenue", "5th avenue", "fife street", "lobengula", "12th avenue", "cbd", "zesa roundabout",
              "hillside", "north end", "takawira", "bulawayo cbd"), (-20.155, 28.583)),
]

BY_ID = {c.id: c for c in CORRIDORS}


def match_corridor(text: str) -> str | None:
    t = text.lower()
    best, best_len = None, 0
    for c in CORRIDORS:
        for a in c.aliases:
            if len(a) > best_len and re.search(rf"(?<![a-z0-9]){re.escape(a)}(?![a-z0-9])", t):
                best, best_len = c.id, len(a)
    return best
