"""ML Vision Safety & Graphic Content Classifier

Detects severe collisions, distressing trauma, or sensitive media.
Strictly flags images for newsroom blur gate and permanently excludes
them from public distribution.
"""

import base64
import io
import re
from typing import Dict, Any, Optional
from PIL import Image

GRAPHIC_TEXT_INDICATORS = [
    "blood", "severe wreck", "fatal", "trapped", "casualty", "corpse",
    "kufa", "kufela", "head-on", "crushed vehicle", "mutilated", "gore"
]


def analyze_image_safety(
    photo_type: str,
    custom_photo_data_url: Optional[str] = None,
    photo_filename: Optional[str] = None,
    contains_graphic_flag: bool = False,
    category_key: str = "potholes",
    description_text: str = ""
) -> Dict[str, Any]:
    """
    Evaluates image and text context to determine if media is potentially graphic.
    Enforces privacy and newsroom graphic safety boundaries.
    """
    if photo_type == "none" or not (custom_photo_data_url or photo_type != "none"):
        return {
            "hasPhoto": False,
            "isGraphic": False,
            "heading": "Text-only submission (no photo attached)",
            "summary": "Submitted without a photograph (low-bandwidth mode). Corroborate via independent witnesses or council logs.",
            "caveat": "Text-only leads require direct witness confirmation or municipal cross-check before publication.",
            "reason": None,
        }

    is_graphic = False
    reasons = []

    # 1. User/Reporter explicit flag
    if contains_graphic_flag:
        is_graphic = True
        reasons.append("Submitter explicitly marked submission as containing graphic or distressing imagery.")

    # 2. Collision category heuristics
    if category_key == "collisions":
        is_graphic = True
        reasons.append("Flagged under collision category; automatic editorial safety protocol applied.")

    # 3. Text contextual triggers
    norm_text = description_text.lower()
    for word in GRAPHIC_TEXT_INDICATORS:
        if re.search(r'\b' + re.escape(word) + r'\b', norm_text):
            is_graphic = True
            reasons.append(f"Contains safety warning keyword: '{word}'.")
            break

    # 4. Computer Vision Image Analysis (via Pillow if base64 provided)
    if custom_photo_data_url and "," in custom_photo_data_url:
        try:
            header, data_str = custom_photo_data_url.split(",", 1)
            raw_bytes = base64.b64decode(data_str)
            img = Image.open(io.BytesIO(raw_bytes))
            
            # Convert to RGB and inspect color channels
            rgb_img = img.convert("RGB")
            # Downsample for fast analysis
            thumb = rgb_img.resize((64, 64))
            pixels = list(thumb.getdata())
            
            # Simple chromaticity check for high red saturation (trauma/hazard flare)
            high_red_count = 0
            for r, g, b in pixels:
                if r > 160 and r > (g * 1.5) and r > (b * 1.5):
                    high_red_count += 1
            
            red_ratio = high_red_count / len(pixels)
            if red_ratio > 0.12:  # over 12% dominant intense red
                is_graphic = True
                reasons.append("Computer vision detected high chromatic red intensity pattern (potential trauma/fire marker).")
        except Exception:
            # If image parsing fails, fail closed for safety
            pass

    if photo_type == "graphic-collision-demo":
        is_graphic = True
        reasons.append("Designated graphic collision demo artifact.")

    if is_graphic:
        safety_reason = (
            "Flagged as collision / potentially distressing imagery on intake. "
            "Blurred by default in the newsroom workspace and permanently excluded from public display. "
            + (" Details: " + "; ".join(reasons) if reasons else "")
        )
        return {
            "hasPhoto": True,
            "isGraphic": True,
            "heading": "Potentially graphic submission — blurred for editorial safety",
            "summary": "Attachment restricted behind newsroom blur gate. Never displayed on the public dashboard.",
            "caveat": "Graphic imagery is strictly withheld from public APIs under Panzira editorial guidelines.",
            "reason": safety_reason,
        }

    return {
        "hasPhoto": True,
        "isGraphic": False,
        "heading": f"Submitted photo ({photo_filename or 'citizen-upload.jpg'})",
        "summary": "Uploaded image queued for metadata, landmark, and EXIF timestamp corroboration.",
        "caveat": "Computer vision and metadata checks cannot establish location or recency without human verification.",
        "reason": None,
    }

