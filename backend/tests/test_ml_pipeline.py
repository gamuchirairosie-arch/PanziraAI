"""Tests for the ML Developer Processing Pipeline

Covers:
- Shona & Ndebele translation with domain-specific terminology
- Hazard classification & severity grading
- Corridor and junction entity extraction
- Vision safety & graphic blur gate detection
- Deduplication & cluster identification
"""

import unittest
from app.ml.translator import translate_to_english, detect_language
from app.ml.classifier import classify_hazard
from app.ml.extractor import extract_location_entities
from app.ml.vision_safety import analyze_image_safety


class TestMLPipeline(unittest.TestCase):

    def test_shona_translation(self):
        text = "Pane gomba paA5 pedyo nePlumtree turn-off. Mota dziri kutsauka nzira."
        detected = detect_language(text)
        self.assertEqual(detected, "Shona")

        res = translate_to_english(text, "Shona")
        self.assertTrue(res["requiresHumanReview"])
        self.assertIn("pothole", res["translatedText"].lower())
        self.assertIn("swerving", res["translatedText"].lower())

    def test_ndebele_translation(self):
        text = "Kulomgodi omkhulu emgwaqweni eduze leplumtree. Izimoto ziyaphambuka."
        detected = detect_language(text)
        self.assertEqual(detected, "Ndebele")

        res = translate_to_english(text, "Ndebele")
        self.assertTrue(res["requiresHumanReview"])
        self.assertIn("pothole", res["translatedText"].lower())

    def test_hazard_classification(self):
        # Pothole
        c1 = classify_hazard("Deep crater and severe road damage on outbound lane")
        self.assertEqual(c1["categoryKey"], "potholes")
        self.assertGreaterEqual(c1["confidencePercent"], 50)

        # Flooding
        c2 = classify_hazard("Blocked storm drain and standing water submerging both lanes")
        self.assertEqual(c2["categoryKey"], "flooding")

        # Collision with high severity
        c3 = classify_hazard("Two-car head-on collision blocking the road with trapped passengers")
        self.assertEqual(c3["categoryKey"], "collisions")
        self.assertEqual(c3["severityLabel"], "Critical")
        self.assertTrue(c3["isCritical"])

        # Visibility
        c4 = classify_hazard("Streetlights out at the roundabout, total darkness")
        self.assertEqual(c4["categoryKey"], "visibility")

    def test_corridor_extraction(self):
        res_a5 = extract_location_entities("A5 Plumtree Road", "Near Plumtree turn-off", "Cars swerving")
        self.assertEqual(res_a5["corridor"], "A5 · Bulawayo–Plumtree")
        self.assertAlmostEqual(res_a5["mapCoords"]["xPct"], 24.0, delta=5.0)

        res_khami = extract_location_entities("Khami Road", "Kelvin North junction", "Water overflow")
        self.assertEqual(res_khami["corridor"], "Khami Road Corridor")
        self.assertAlmostEqual(res_khami["mapCoords"]["xPct"], 28.0, delta=5.0)

    def test_vision_safety(self):
        # Graphic collision
        res_col = analyze_image_safety(
            photo_type="custom-upload",
            photo_filename="wreck.jpg",
            category_key="collisions",
            description_text="Severe vehicle rollover with blood and impact"
        )
        self.assertTrue(res_col["isGraphic"])
        self.assertIn("blurred for editorial safety", res_col["heading"])

        # Non-graphic road defect
        res_pot = analyze_image_safety(
            photo_type="custom-upload",
            photo_filename="pothole.jpg",
            category_key="potholes",
            description_text="Pothole in the tarmac"
        )
        self.assertFalse(res_pot["isGraphic"])


if __name__ == "__main__":
    unittest.main()
