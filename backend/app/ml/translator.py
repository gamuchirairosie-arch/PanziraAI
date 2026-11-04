"""ML Multilingual Translator (Shona & Ndebele to English)

Provides contextual road safety translation for Shona and Ndebele citizen reports.
Flagged as AI drafts that strictly require fluent human review before corroboration.
"""

import re
from typing import Dict, Any, Optional

# Specialized Zimbabwean road traffic lexicon & phrase alignments
SHONA_LEXICON = {
    "pane gomba": "there is a pothole",
    "makomba mahombe": "large deep potholes",
    "pa a5": "on the A5",
    "paa5": "on the A5",
    "pedyo ne": "near",
    "pedyo neplumtree turn-off": "near the Plumtree turn-off",
    "mota dziri kutsauka nzira": "cars are swerving dangerously off the lane",
    "kutsauka nzira": "swerving off the road / lane",
    "mvura yazara": "standing water / flooding",
    "mumugwagwa": "on the road",
    "tsaona yaitika": "an accident has occurred",
    "tsaona": "accident / collision",
    "mota yakarovera": "a vehicle collided",
    "magetsi haasi kushanda": "streetlights are not working",
    "rima guru": "total darkness / poor visibility",
    "muti wawira": "a tree has fallen",
    "matombo mumugwagwa": "rocks on the roadway",
    "bhazi raparara": "a bus has broken down",
    "kudonha": "collapsed / fallen",
    "kufashukira": "overflowing / flooded",
}

NDEBELE_LEXICON = {
    "kulomgodi": "there is a pothole",
    "kulomgodi omkhulu": "there is a huge pothole",
    "amagodi amakhulu": "large deep potholes",
    "eduze le": "near",
    "eduze leplumtree": "near Plumtree",
    "izimoto ziyaphambuka": "vehicles are swerving into oncoming traffic",
    "amanzi amanengi": "heavy flooding / high standing water",
    "emgwaqweni": "on the road",
    "ingozi yenzakele": "an accident occurred",
    "ingozi": "accident / collision",
    "izibane kazisebenzi": "streetlights are out",
    "kumnyama": "it is dark / poor visibility",
    "isihlahla siwile": "a tree has fallen",
    "amatshe emgwaqweni": "rocks on the roadway",
    "ibhasi lifile": "a bus has broken down",
    "ukubambana": "traffic jam / gridlock",
}

LANGUAGE_INDICATORS = {
    "Shona": ["pane", "gomba", "makomba", "mota", "dziri", "kutsauka", "nzira", "pedyo", "mvura", "mumugwagwa", "tsaona", "magetsi", "yazara", "neplumtree"],
    "Ndebele": ["kulo", "umgodi", "amagodi", "izimoto", "ziyaphambuka", "eduze", "amanzi", "emgwaqweni", "ingozi", "izibane", "isihlahla", "amatshe", "ngomgwaqo"],
}


def detect_language(text: str, default_lang: str = "English") -> str:
    """Detects whether text is Shona, Ndebele, or English based on vocabulary indicators."""
    lower = text.lower()
    words = re.findall(r'\b\w+\b', lower)
    
    shona_hits = sum(1 for w in words if w in LANGUAGE_INDICATORS["Shona"])
    ndebele_hits = sum(1 for w in words if w in LANGUAGE_INDICATORS["Ndebele"])

    if shona_hits > ndebele_hits and shona_hits >= 1:
        return "Shona"
    if ndebele_hits > shona_hits and ndebele_hits >= 1:
        return "Ndebele"
    return default_lang


def translate_to_english(text: str, source_language: Optional[str] = None) -> Dict[str, Any]:
    """
    Translates Shona or Ndebele hazard text into an English working draft.
    Includes explicit uncertainty notes regarding dialect and human review.
    """
    auto_detected = detect_language(text)
    detected_lang = source_language if source_language in ["Shona", "Ndebele"] else auto_detected
    
    if detected_lang == "English":
        return {
            "sourceLanguage": "English",
            "translatedText": None,
            "languageNote": "English • original citizen submission",
            "requiresHumanReview": False,
        }

    translated_text = text
    lexicon = SHONA_LEXICON if detected_lang == "Shona" else NDEBELE_LEXICON
    
    # Sort phrases by length descending to match longest phrases first
    sorted_phrases = sorted(lexicon.keys(), key=len, reverse=True)
    
    for phrase in sorted_phrases:
        replacement = lexicon[phrase]
        pattern = re.compile(re.escape(phrase), re.IGNORECASE)
        translated_text = pattern.sub(replacement, translated_text)

    # Clean up and capitalize
    translated_text = translated_text.strip()
    if translated_text:
        translated_text = translated_text[0].upper() + translated_text[1:]

    return {
        "sourceLanguage": detected_lang,
        "translatedText": f"“{translated_text}”",
        "languageNote": f"{detected_lang} → English • draft translation (human check required)",
        "requiresHumanReview": True,
        "editorialGuidance": (
            f"Draft translation queued from {detected_lang}. A fluent editor must verify local idioms "
            f"(e.g. 'kutsauka nzira' / swerving into oncoming traffic vs shoulder) before corroboration."
        )
    }
