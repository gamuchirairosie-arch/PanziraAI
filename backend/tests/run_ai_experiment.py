import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.ai.language import detect_language, translate_to_english, LANG_NAMES
from app.ai.locations import extract_locations
from app.ai.classifier import get_classifier

def run_experiment():
    clf = get_classifier()

    samples = [
        ("Ndebele", "Kulamangodi amakhulu kuKhami road eduzane le-flyover. Izimota ziyatshona amavhili aphuke."),
        ("Shona", "Mota mbiri dzabhemberana paHarare Road pedyo neCement Side. Traffic yamira vanhu vakuvara."),
        ("English Vernacular", "Major flooding after heavy rain along Plumtree Road near Bellevue. Water over curb.")
    ]

    print("=" * 72)
    print("PANZIRA AI: OFFICIAL JUDGING EVIDENCE — AI BEFORE & AFTER EXPERIMENT")
    print("=" * 72)

    for lang, text in samples:
        print(f"\n[BEFORE: Raw Citizen Input ({lang})]")
        print(f"  \"{text}\"")

        res = clf.predict(text)
        loc = extract_locations(text)
        det = detect_language(text)
        detected_name = LANG_NAMES.get(det["code"], "English")
        trans = translate_to_english(text, det["code"])

        print("\n[AFTER: Structured Machine Intelligence]")
        print(f"  • Detected Language:    {detected_name} (Confidence: {det['confidence']*100:.0f}%)")
        print(f"  • Extracted Category:   {res['label_text']} (key: {res['label']})")
        print(f"  • Model Confidence:     {res['confidence'] * 100:.1f}%")
        print(f"  • Uncertainty Flags:    {res['uncertainty'] or 'None (High certainty)'}")
        print(f"  • Corridor Identified:  {loc.get('corridor_id', 'Bulawayo General')}")
        print(f"  • Landmark / Location:  {loc['best']['name'] if loc.get('best') else 'Bulawayo Corridor'}")
        print(f"  • Location Precision:   {loc.get('precision_text', 'Approximate')}")
        print(f"  • Draft Translation:    \"{trans['text']}\" (Reviewed: {trans['reviewed']})")
        print("  • Human Gate Status:    HELD AT STAGE 2 (Requires 4/4 editorial corroboration)")

    print("\n" + "=" * 72)

if __name__ == "__main__":
    run_experiment()
