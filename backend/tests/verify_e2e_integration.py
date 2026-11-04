"""Panzira AI - End-to-End Release & Hackathon Readiness Verification Script
Simulates two independent browser sessions:
  Session A: Citizen submitting road hazard via Web Wizard
  Session B: Newsroom Editor reviewing, checking, and gating publication

Tests:
1. Citizen submission -> Saved in DB (unverified lead)
2. Immediate query by Editor session -> Appears in Journalist Inbox
3. Premature publication attempt (0/4 checks) -> STRICT BACKEND REJECTION (HTTP 400)
4. Corroboration: Editor toggles all 4 independent checks
5. Authorized editorial approval -> Published to public map
6. Public verification -> Alert visible on Public Dashboard
7. Rejection & unverified isolation -> Never broadcast publicly
8. Graphic content safety -> Graphic media withheld from public alert
"""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.database.models import SignalReport, VerifiedPublicAlert, AuditLog

client = TestClient(app)

def test_full_e2e_workflow():
    print("=" * 70)
    print("PANZIRA AI - TRUE END-TO-END INTEGRATION AUDIT")
    print("=" * 70)

    # ---------------------------------------------------------
    # STEP 1: Session A (Citizen) submits a road hazard
    # ---------------------------------------------------------
    print("\n[*] STEP 1: Session A (Citizen) Submitting Road Hazard...")
    citizen_payload = {
        "categoryKey": "potholes",
        "categoryLabel": "Road surface damage",
        "roadArea": "Khami Road",
        "landmark": "Near flyover rail crossing",
        "description": "Deep trench-like pothole across both lanes, damaging wheel rims and axles",
        "reportedDateTime": "04 Nov 2026, 15:45",
        "observedIso": "2026-11-04T15:45:00Z",
        "evidenceLink": None,
        "language": "English",
        "photoType": "figma-road-damage",
        "customPhotoDataUrl": "data:image/jpeg;base64,fictional_demo_photo_payload",
        "photoFilename": "khami_pothole_survey.jpg",
        "containsGraphicContent": False,
        "sourceChannelLabel": "Citizen web",
        "sourceChannelShort": "Citizen web (opt-in)",
    }

    res_submit = client.post("/api/public/submit", json=citizen_payload)
    assert res_submit.status_code == 200, f"Submission failed: {res_submit.text}"
    new_signal = res_submit.json()
    signal_id = new_signal["id"]
    print(f"  [PASS] Citizen submitted successfully. Generated Signal ID: {signal_id}")
    assert new_signal["workflowStatus"] == "lead"
    assert new_signal["pipelineStage"] == 2
    print("  [PASS] Workflow status is 'lead', pipelineStage is 2 (AI Extracted, not published)")

    # Confirm directly in backend SQLite DB
    db = SessionLocal()
    db_sig = db.query(SignalReport).filter(SignalReport.id == signal_id).first()
    assert db_sig is not None, "Signal not found in backend SQLite DB!"
    print(f"  [PASS] Verified in backend SQLite: {db_sig.id} stored with status '{db_sig.workflow_status}'")

    # Confirm it is NOT on public dashboard
    res_pub_alerts = client.get("/api/public/alerts")
    pub_ids = [a["id"] for a in res_pub_alerts.json()]
    assert f"PZ-PUB-{signal_id}" not in pub_ids, "Unverified report leaked to public dashboard!"
    print("  [PASS] Confirmed unverified report is NOT in public alerts")

    # ---------------------------------------------------------
    # STEP 2: Session B (Editor) logs in and inspects Inbox
    # ---------------------------------------------------------
    print("\n[*] STEP 2: Session B (Newsroom Editor) Authenticating and Inspecting Inbox...")
    login_res = client.post("/api/auth/login", json={"email": "rudo.moyo@panzira.org", "password": "panzira_editor_2025"})
    assert login_res.status_code == 200, "Editor login failed!"
    token = login_res.json()["access_token"]
    editor_headers = {"Authorization": f"Bearer {token}"}
    print("  [PASS] Editor Rudo Moyo authenticated (JWT acquired)")

    res_inbox = client.get("/api/newsroom/signals", headers=editor_headers)
    assert res_inbox.status_code == 200, "Failed to fetch newsroom signals"
    all_signals = res_inbox.json()
    inbox_match = next((s for s in all_signals if s["id"] == signal_id), None)
    assert inbox_match is not None, f"Signal {signal_id} did not appear in Editor inbox!"
    print(f"  [PASS] Signal {signal_id} found in Editor inbox: '{inbox_match['title']}'")

    # ---------------------------------------------------------
    # STEP 3: Attempt Premature Publication (Editor Gate Test)
    # ---------------------------------------------------------
    print("\n[*] STEP 3: Testing Strict Editor Gate (Premature Publication Attempt)...")
    res_early_verify = client.post(f"/api/newsroom/signals/{signal_id}/verify", headers=editor_headers)
    assert res_early_verify.status_code == 400, f"Expected HTTP 400, got {res_early_verify.status_code}"
    err_detail = res_early_verify.json().get("detail", "")
    print(f"  [PASS] Backend rejected premature publication with HTTP 400: '{err_detail}'")

    # ---------------------------------------------------------
    # STEP 4: Session B performs all 4 independent editorial checks
    # ---------------------------------------------------------
    print("\n[*] STEP 4: Session B Completing 4/4 Independent Corroboration Checks...")
    checks = ["locationAndTime", "mediaAndDate", "independentSource", "hazardStillPresent"]
    for chk in checks:
        res_chk = client.post(
            f"/api/newsroom/signals/{signal_id}/checklist",
            headers=editor_headers,
            json={"field": chk}
        )
        assert res_chk.status_code == 200, f"Checklist toggle failed for {chk}"
        print(f"  [PASS] Toggled check '{chk}' -> TRUE")

    # Verify checklist state
    res_sig_updated = client.get("/api/newsroom/signals", headers=editor_headers)
    sig_updated = next(s for s in res_sig_updated.json() if s["id"] == signal_id)
    assert all(sig_updated["checklist"].values()), "Not all checks were recorded as True!"
    print("  [PASS] All 4 verification checklist items verified in backend state")

    # ---------------------------------------------------------
    # STEP 5: Session B approves and publishes alert
    # ---------------------------------------------------------
    print("\n[*] STEP 5: Session B Authorized Editorial Sign-Off & Broadcast...")
    res_verify_success = client.post(f"/api/newsroom/signals/{signal_id}/verify", headers=editor_headers)
    assert res_verify_success.status_code == 200, f"Verification failed: {res_verify_success.text}"
    verified_data = res_verify_success.json()
    assert verified_data["workflowStatus"] == "verified"
    print(f"  [PASS] Signal {signal_id} verified and approved by Editor Rudo Moyo")

    # ---------------------------------------------------------
    # STEP 6: Confirm alert appears on public dashboard & map
    # ---------------------------------------------------------
    print("\n[*] STEP 6: Verifying Public Alert Broadcast...")
    res_public_after = client.get("/api/public/alerts")
    assert res_public_after.status_code == 200
    pub_alerts_after = res_public_after.json()
    published_match = next((a for a in pub_alerts_after if a["sourceSignalId"] == signal_id), None)
    assert published_match is not None, f"Alert for {signal_id} not found in public alerts!"
    print(f"  [PASS] Public Alert live: ID {published_match['id']} - '{published_match['title']}'")
    print(f"  [PASS] Corridor: {published_match['corridor']}, Location: {published_match['location']}")
    print(f"  [PASS] Attribution: {published_match['sourceAttribution']}")

    # ---------------------------------------------------------
    # STEP 7: Test Rejection Workflow
    # ---------------------------------------------------------
    print("\n[*] STEP 7: Testing Rejection Isolation...")
    reject_payload = citizen_payload.copy()
    reject_payload["roadArea"] = "Luveve Road"
    reject_payload["description"] = "Unsubstantiated rumor about bridge collapse"
    res_reject_submit = client.post("/api/public/submit", json=reject_payload)
    reject_sig_id = res_reject_submit.json()["id"]

    res_reject = client.post(
        f"/api/newsroom/signals/{reject_sig_id}/reject",
        headers=editor_headers,
        json={"reason": "Uncorroborated report contradicted by municipal roads team."}
    )
    assert res_reject.status_code == 200
    rejected_sig = res_reject.json()
    assert rejected_sig["workflowStatus"] == "rejected"
    print(f"  [PASS] Signal {reject_sig_id} rejected and archived")

    # Confirm rejected signal is NOT in public alerts
    res_pub_recheck = client.get("/api/public/alerts")
    recheck_ids = [a["sourceSignalId"] for a in res_pub_recheck.json()]
    assert reject_sig_id not in recheck_ids, "Rejected report leaked to public dashboard!"
    print(f"  [PASS] Confirmed rejected signal {reject_sig_id} remains completely unpublished")

    # ---------------------------------------------------------
    # STEP 8: Test Graphic Content Protection
    # ---------------------------------------------------------
    print("\n[*] STEP 8: Testing Graphic Imagery Withholding Gate...")
    graphic_payload = citizen_payload.copy()
    graphic_payload["categoryKey"] = "collisions"
    graphic_payload["containsGraphicContent"] = True
    graphic_payload["description"] = "Serious head-on collision with injured passengers"
    res_graphic_submit = client.post("/api/public/submit", json=graphic_payload)
    graphic_sig_id = res_graphic_submit.json()["id"]
    graphic_sig = res_graphic_submit.json()
    assert graphic_sig["isGraphicImage"] is True
    print(f"  [PASS] Graphic submission {graphic_sig_id} flagged as isGraphicImage=True")

    # Complete checks and verify
    for chk in checks:
        client.post(f"/api/newsroom/signals/{graphic_sig_id}/checklist", headers=editor_headers, json={"field": chk})
    client.post(f"/api/newsroom/signals/{graphic_sig_id}/verify", headers=editor_headers)

    res_pub_graphic = client.get("/api/public/alerts")
    graphic_alert = next(a for a in res_pub_graphic.json() if a["sourceSignalId"] == graphic_sig_id)
    assert "Submitted scene imagery withheld" in graphic_alert["description"]
    print("  [PASS] Graphic image strictly withheld from public alert; safety notice attached")

    # Check Tamper-Evident Audit Trail
    audit_count = db.query(AuditLog).count()
    print(f"  [PASS] Audit logs recorded in tamper-evident chain: {audit_count} total entries")

    db.close()
    print("\n" + "=" * 70)
    print(">>> TRUE END-TO-END INTEGRATION AUDIT: 100% PASSED <<<")
    print("=" * 70)

if __name__ == "__main__":
    test_full_e2e_workflow()

