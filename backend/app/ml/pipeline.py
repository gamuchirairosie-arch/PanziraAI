"""AI / ML Intake Processing Pipeline

Orchestrates classification, translation, entity extraction, image safety
detection, and duplicate identification for every incoming signal.

Strict Safety Constraint:
AI NEVER automatically publishes alerts. It solely creates structured
unverified leads (pipeline stage 2) with explicit confidence scores
and missing verification items.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.ml.classifier import classify_hazard
from app.ml.translator import translate_to_english, detect_language
from app.ml.extractor import extract_location_entities
from app.ml.vision_safety import analyze_image_safety
from app.ml.deduplication import find_duplicate_candidates
from app.schemas.signal import CitizenReportCreate


def process_intake_pipeline(
    report_input: CitizenReportCreate,
    db: Session,
    exclude_signal_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes the end-to-end ML intake analysis for an incoming hazard report.
    Returns structured AI metadata, safety flags, and confidence indicators.
    """
    raw_text = report_input.description.strip()
    user_lang = report_input.language or "English"

    # 1. Translation Engine
    translation_result = translate_to_english(raw_text, user_lang)
    english_text = translation_result["translatedText"] or raw_text

    # 2. Hazard Classification
    text_for_classification = f"{raw_text} {english_text}"
    classification_result = classify_hazard(
        text=text_for_classification,
        user_selected_category=report_input.categoryKey
    )

    # 3. Location & Corridor Entity Extraction
    location_result = extract_location_entities(
        road_area_input=report_input.roadArea,
        landmark_input=report_input.landmark,
        description_input=raw_text
    )

    # 4. Computer Vision & Graphic Safety Gate
    vision_result = analyze_image_safety(
        photo_type=report_input.photoType,
        custom_photo_data_url=report_input.customPhotoDataUrl,
        photo_filename=report_input.photoFilename,
        contains_graphic_flag=bool(report_input.containsGraphicContent),
        category_key=classification_result["categoryKey"],
        description_text=raw_text
    )

    # 5. Duplicate Correlation & Cluster Detection
    dedup_result = find_duplicate_candidates(
        new_road_area=report_input.roadArea,
        new_landmark=report_input.landmark,
        new_category_key=classification_result["categoryKey"],
        new_description=raw_text,
        db=db,
        exclude_id=exclude_signal_id
    )

    # 6. Confidence Scoring & Uncertainty Indicators
    base_confidence = classification_result["confidencePercent"]
    if vision_result["hasPhoto"]:
        base_confidence = min(74, base_confidence + 8)
    else:
        base_confidence = max(45, base_confidence - 6)

    # Apply location confidence reduction
    base_confidence = max(42, base_confidence - location_result.get("confidenceReduction", 0))

    confidence_note = f"{base_confidence}% • insufficient to publish"

    # 7. Formulate Missing Verification Items for Editorial Gate
    missing_items = [
        "Independent confirmation of the hazard",
        "Precise landmark or GPS coordinate check",
    ]
    if vision_result["hasPhoto"]:
        missing_items.append("Image capture date & provenance check")
    else:
        missing_items.append("Second independent witness or municipal authority check")

    return {
        "classification": classification_result,
        "translation": translation_result,
        "location": location_result,
        "vision": vision_result,
        "deduplication": dedup_result,
        "confidencePercent": base_confidence,
        "confidenceNote": confidence_note,
        "missingItems": missing_items,
        # INVARIANT: Strict adherence to stage 2 (AI Structured Lead)
        "pipelineStage": 2,
        "workflowStatus": "lead",
    }

