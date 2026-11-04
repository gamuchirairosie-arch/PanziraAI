from app.ai.classifier import HazardClassifier, get_classifier
from app.ai.images import analyze_image, hamming
from app.ai.language import detect_language, translate_to_english
from app.ai.locations import extract_locations
from tests.conftest import png_bytes, submit
from tests.heldout_examples import HELDOUT


def test_classifier_generalises_on_heldout_examples():
    clf = get_classifier()
    assert clf.accuracy_on(HELDOUT) >= 0.8


def test_classifier_reports_uncertainty():
    p = get_classifier().predict("something happened")
    assert p["confidence"] < 0.4
    assert {"very_short_text", "no_keyword_evidence"} & set(p["uncertainty"])


def test_language_detection():
    assert detect_language("Pane gomba paA5 pedyo nePlumtree turn-off. Mota dziri kutsauka nzira.")["code"] == "sn"
    assert detect_language("amanzi agcwele umgwaqo eduze kweEsigodini")["code"] == "nd"
    assert detect_language("There is a deep pothole on the road near the bridge")["code"] == "en"


def test_translation_is_always_an_unreviewed_draft():
    t = translate_to_english("Pane gomba paA5 pedyo nePlumtree", "sn")
    assert t["reviewed"] is False and "pothole" in t["text"]
    assert translate_to_english("hello", "en")["reviewed"] is True


def test_location_extraction():
    r = extract_locations("Streetlights out at the ZESA roundabout on Five Avenue")
    assert r["best"]["name"].startswith("ZESA Roundabout") and r["precision"] == "landmark"
    r = extract_locations("Crash on A7 near Esigodini at the 23km peg")
    assert r["corridor_id"] == "ESIGODINI" and r["km_peg"] == 23 and "A7" in r["road_refs"]
    r = extract_locations("big hole somewhere")
    assert r["precision"] == "none" and r["best"] is None


def test_pipeline_fills_gaps_and_flags_uncertainty(client, journo):
    ref = submit(client, desc="Streetlights are out at the ZESA roundabout on Five Avenue, very dark at night")["id"]
    s = client.get(f"/api/v1/signals/{ref}", headers=journo).json()
    assert s["categoryKey"] == "visibility" and "ZESA" in s["landmark"]
    assert s["aiConfidencePercent"] > 0 and isinstance(s["aiUncertainty"], list)
    assert s["pipelineStage"] == 2 and s["workflowStatus"] == "lead"


def test_reporter_category_kept_and_disagreement_flagged(client, journo):
    ref = submit(client, desc="Streetlights are out at the ZESA roundabout, very dark", category_key="potholes")["id"]
    s = client.get(f"/api/v1/signals/{ref}", headers=journo).json()
    assert s["categoryKey"] == "potholes"  # reporter's choice stands
    assert any(u.startswith("ai_suggests_visibility") for u in s["aiUncertainty"])


def test_duplicate_detection_by_text_place_and_image(client, journo):
    img = png_bytes(color=(90, 140, 60))
    a = submit(client, desc="Deep pothole on Khami Road near Mzilikazi, tyres damaged", photo=img)["id"]
    b = submit(client, desc="Big pothole along Khami Road by Mzilikazi damaging tyres", photo=img)["id"]
    sb = client.get(f"/api/v1/signals/{b}", headers=journo).json()
    assert sb["duplicateCandidates"] and sb["duplicateCandidates"][0]["id"] == a
    assert "identical image" in sb["duplicateCandidates"][0]["locationNote"] or "similar" in sb["duplicateCandidates"][0]["locationNote"]
    assert "not independent" in sb["duplicateClusterSummary"]
    unrelated = submit(client, desc="Flooding at the low-lying bridge near Gwanda, water over the tarmac")["id"]
    assert client.get(f"/api/v1/signals/{unrelated}", headers=journo).json()["duplicateCandidates"] == []
    # editor can dismiss a wrong suggestion
    assert client.post(f"/api/v1/signals/{b}/duplicates/{a}/dismiss", headers=journo).status_code == 200
    assert client.get(f"/api/v1/signals/{b}", headers=journo).json()["duplicateCandidates"] == []


def test_phash_survives_recompression():
    import io
    import numpy as np
    from PIL import Image
    rng = np.random.default_rng(5)
    base = Image.fromarray((rng.random((200, 300, 3)) * 255).astype("uint8"))
    b1, b2 = io.BytesIO(), io.BytesIO()
    base.save(b1, "JPEG", quality=92)
    base.resize((150, 100)).save(b2, "JPEG", quality=55)
    a1, _ = analyze_image(b1.getvalue(), 10_000_000)
    a2, _ = analyze_image(b2.getvalue(), 10_000_000)
    assert hamming(a1.phash, a2.phash) <= 10


def test_graphic_screen_flags_red_and_passes_neutral():
    assert analyze_image(png_bytes((130, 10, 10)), 10**7)[0].graphic_score >= 0.55
    assert analyze_image(png_bytes((120, 120, 120)), 10**7)[0].graphic_score < 0.2


def test_humans_can_correct_ai_suggestions_and_it_is_audited(client, journo, editor):
    ref = submit(client, desc="pothole near Plumtree turn-off on the A5")["id"]
    r = client.patch(f"/api/v1/signals/{ref}/fields", json={"roadArea": "A5 Bulawayo–Plumtree Road",
                                                           "landmark": "Plumtree turn-off", "lat": -20.2, "lng": 28.3},
                     headers=journo)
    assert r.status_code == 200 and r.json()["roadArea"].startswith("A5")
    acts = client.get("/api/v1/audit", params={"action": "fields_edited"}, headers=editor).json()
    assert acts and "road_area" in acts[0]["detail"]
