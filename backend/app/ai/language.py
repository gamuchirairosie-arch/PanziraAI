"""Language detection (en / sn / nd) and draft translation.

Detection is marker-word scoring, good enough to route text to the right glossary or model;
reporter-selected language always wins. Translation output is ALWAYS a draft that a fluent
human editor must confirm before the report can be published.
"""
from __future__ import annotations

import re

import httpx

from ..config import get_settings
from .lexicon import ENGLISH_MARKERS, GLOSSARY, NDEBELE_MARKERS, SHONA_MARKERS

_TOK = re.compile(r"[a-zA-Z']+")
LANG_NAMES = {"en": "English", "sn": "Shona", "nd": "Ndebele"}
NAME_TO_CODE = {"english": "en", "shona": "sn", "ndebele": "nd", "en": "en", "sn": "sn", "nd": "nd"}


def detect_language(text: str) -> dict:
    toks = [t.lower() for t in _TOK.findall(text)]
    if not toks:
        return {"code": "en", "confidence": 0.0, "scores": {}}
    scores = {
        "en": sum(t in ENGLISH_MARKERS for t in toks),
        "sn": sum(t in SHONA_MARKERS for t in toks),
        "nd": sum(t in NDEBELE_MARKERS for t in toks),
    }
    # substring evidence for prefix-attached words ("nePlumtree", "paA5", "emgwaqweni")
    joined = " ".join(toks)
    scores["sn"] += 0.5 * sum(joined.count(m) for m in ("pane ", "mugwagwa", "mvura", "tsaona"))
    scores["nd"] += 0.5 * sum(joined.count(m) for m in ("emgwaqweni", "umgwaqo", "amanzi", "ingozi"))
    best = max(scores, key=scores.get)
    total = sum(scores.values()) or 1
    if scores[best] == 0:
        return {"code": "en", "confidence": 0.3, "scores": scores}
    return {"code": best, "confidence": round(scores[best] / total, 2), "scores": scores}


def _glossary_gloss(text: str, lang: str) -> str:
    """Offline, rough word/phrase gloss. Deliberately labelled as a gloss, not a translation."""
    out = text
    # attached prefixes first ("nePlumtree" -> "[near/at] Plumtree", "paA5" -> "[on] A5")
    out = re.sub(r"(?<![A-Za-z\[])ne(?=[A-Z])", "[near/at] ", out)
    out = re.sub(r"(?<![A-Za-z\[])pa(?=[A-Z])", "[on] ", out)
    for src in sorted(GLOSSARY, key=len, reverse=True):
        out = re.sub(rf"(?i)(?<![A-Za-z\[]){re.escape(src)}(?![A-Za-z\]])", f"[{GLOSSARY[src]}]", out)
    return out


def translate_to_english(text: str, lang: str) -> dict:
    """Returns {text, method, reviewed, note}. Never marks output as reviewed."""
    if lang == "en":
        return {"text": text, "method": "none", "reviewed": True, "note": "English original"}
    s = get_settings()
    if s.translation_provider == "anthropic" and s.anthropic_api_key:
        try:
            r = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": s.anthropic_api_key, "anthropic-version": "2023-06-01",
                         "content-type": "application/json"},
                json={
                    "model": s.anthropic_model, "max_tokens": 400,
                    "system": ("You translate short road-hazard reports from Zimbabwean "
                               f"{LANG_NAMES[lang]} into plain English. Output only the translation. "
                               "Keep place names and road numbers unchanged. Do not add details. "
                               "If a word is unclear, keep it in [brackets]."),
                    "messages": [{"role": "user", "content": text}],
                },
                timeout=20,
            )
            r.raise_for_status()
            out = "".join(b.get("text", "") for b in r.json().get("content", [])).strip()
            if out:
                return {"text": out, "method": "llm-draft", "reviewed": False,
                        "note": "Machine draft; fluent editor review required"}
        except Exception:
            pass  # fall through to glossary
    return {"text": _glossary_gloss(text, lang), "method": "glossary-gloss", "reviewed": False,
            "note": "Rough word-by-word gloss; fluent editor must translate before publication"}
