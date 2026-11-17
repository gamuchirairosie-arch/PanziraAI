"""End-to-End V3 Live Demo Smoke Test covering all 3 Acts against /api/v1 endpoints:
- Act 1 (Guest Citizen): Submit hazard photo + commercial_pool license -> returns PZ-XXXX reference,
  4-digit claim_pin, and runs AI/EXIF/Moire forensics.
- Act 1b (Citizen Claim): Sign in as Tariro (tariro@citizen.co.zw) and link the guest report
  via POST /api/v1/reports/claim using reference + 4-digit claim_pin.
- Act 2 (Journalist Application & Admin Approval): Submit ZMC press application via
  POST /api/v1/auth/register/journalist, confirm pre-approval login returns 403, sign in as
  Admin (rudo@panzira.zw), approve application via POST /api/v1/admin/journalist-applications/{id}/decide,
  and confirm applicant login succeeds.
- Act 2b (Anti-Collision Lock, Human Visual AI Gate, Instant Licensing & Publishing):
  Sign in as Journalist (nqobile@chronicle.co.zw), claim 30m lock (/claim), confirm second journalist
  receives 409 Conflict, complete verification checklist + /visual-ai-check (confirming publish & license
  both block with 409 beforehand), license media ($5 standard -> +$3.50 & $15 24h exclusive -> +$10.50,
  confirming rival newsroom gets 409), publish alert (/verify), and confirm it appears in
  GET /api/v1/public/alerts.
- Act 3 (Royalty Payout & SHA-256 Audit Ledger): Confirm Citizen GET /api/v1/auth/me reflects
  the 70% royalty credits (+$14.00 delta) and GET /api/v1/audit/verify returns verified=True, ok=True.
"""
from __future__ import annotations

from app.database.seed import seed_database
from app.db import SessionLocal
from tests.conftest import complete_checks
from tests.test_sprint1_upgrades import _make_camera_jpeg_with_exif


def _login_v3(client, email: str, password: str = "panzira2026") -> dict[str, str]:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['accessToken']}"}


def test_seeded_v3_demo_personas_login(client):
    db = SessionLocal()
    seed_database(db)
    db.close()

    expected = [
        ("tariro@citizen.co.zw", "citizen", "verified"),
        ("nqobile@chronicle.co.zw", "journalist", "verified"),
        ("rudo@panzira.zw", "admin", "verified"),
    ]
    for email, role, status in expected:
        res = client.post("/api/v1/auth/login", json={"email": email, "password": "panzira2026"})
        assert res.status_code == 200, f"Login failed for {email}: {res.text}"
        user = res.json()["user"]
        assert user["role"] == role
        assert user["verification_status"] == status


def test_v3_three_act_live_demo_e2e_flow(client):
    db = SessionLocal()
    seed_database(db)
    db.close()

    # ---------- ACT 1: Guest Citizen Report Submission + Forensics ----------
    cam_bytes = _make_camera_jpeg_with_exif()
    submit_res = client.post(
        "/api/v1/reports",
        data={
            "description": "Burst stormwater culvert flooding Khami Road lane near 6th Ave Extension.",
            "category_key": "flooding",
            "road_area": "Khami Road & 6th Ave Extension",
            "landmark": "Near Flyover Westbound",
            "lat": "-20.1452",
            "lng": "28.5711",
            "license_tier": "commercial_pool",
            "attribution_mode": "handle",
        },
        files={"photo": ("khami_flooding.jpg", cam_bytes, "image/jpeg")},
    )
    assert submit_res.status_code == 201, submit_res.text
    report_data = submit_res.json()
    ref = report_data["id"]
    pin = report_data["claim_pin"]
    assert ref.startswith("PZ-")
    assert len(pin) == 4 and pin.isdigit()
    assert report_data["ai_scan_verdict"] == "authentic_camera"
    assert report_data["commercial_eligible"] is True

    # ---------- ACT 1b: Citizen Sign-In & Claim via 4-Digit PIN ----------
    tariro_hdr = _login_v3(client, "tariro@citizen.co.zw")
    me_before = client.get("/api/v1/auth/me", headers=tariro_hdr)
    assert me_before.status_code == 200
    starting_balance = float(me_before.json()["royalty_balance_usd"])
    assert starting_balance == 16.0

    # Wrong PIN must be rejected
    bad_pin = "0000" if pin != "0000" else "9999"
    bad_claim = client.post(
        "/api/v1/reports/claim",
        json={"reference": ref, "claim_pin": bad_pin},
        headers=tariro_hdr,
    )
    assert bad_claim.status_code == 400

    # Correct reference + 4-digit PIN links report to Tariro
    claim_res = client.post(
        "/api/v1/reports/claim",
        json={
            "reference": ref,
            "claim_pin": pin,
            "license_tier": "commercial_pool",
            "attribution_mode": "handle",
        },
        headers=tariro_hdr,
    )
    assert claim_res.status_code == 200, claim_res.text
    claimed = claim_res.json()
    assert claimed["license_tier"] == "commercial_pool"
    assert claimed["attribution_mode"] == "handle"
    assert claimed["contributor_id"] == me_before.json()["id"]

    # ---------- ACT 2: Journalist ZMC Application & Admin Approval ----------
    journo_reg = client.post(
        "/api/v1/auth/register/journalist",
        json={
            "email": "buhle.ncube@chronicle.co.zw",
            "name": "Buhle Ncube",
            "password": "journo_demo_pass_2026",
            "media_house": "The Chronicle",
            "zmc_number": "ZMC-2026-9901",
            "press_card_url": "https://zmc.org.zw/cards/ZMC-2026-9901.pdf",
        },
    )
    assert journo_reg.status_code == 201, journo_reg.text
    applicant_id = journo_reg.json()["user"]["id"]
    assert journo_reg.json()["user"]["verification_status"] == "pending_verification"

    # Pending applicant cannot sign in before admin approval
    pending_login = client.post(
        "/api/v1/auth/login",
        json={"email": "buhle.ncube@chronicle.co.zw", "password": "journo_demo_pass_2026"},
    )
    assert pending_login.status_code == 403

    # Admin signs in and approves the journalist application
    admin_hdr = _login_v3(client, "rudo@panzira.zw")
    apps_res = client.get("/api/v1/admin/journalist-applications", headers=admin_hdr)
    assert apps_res.status_code == 200, apps_res.text
    assert any(a["id"] == applicant_id and a["zmc_number"] == "ZMC-2026-9901" for a in apps_res.json())

    decide_res = client.post(
        f"/api/v1/admin/journalist-applications/{applicant_id}/decide",
        json={"decision": "approve", "reason": "Verified active 2026 ZMC accreditation."},
        headers=admin_hdr,
    )
    assert decide_res.status_code == 200, decide_res.text
    assert decide_res.json()["verification_status"] == "verified"

    buhle_hdr = _login_v3(client, "buhle.ncube@chronicle.co.zw", "journo_demo_pass_2026")

    # ---------- ACT 2b: 30m Claim Lock, Visual AI Gate, Instant Licensing & Publish ----------
    nqobile_hdr = _login_v3(client, "nqobile@chronicle.co.zw")
    lock_res = client.post(f"/api/v1/signals/{ref}/claim", headers=nqobile_hdr)
    assert lock_res.status_code == 200, lock_res.text
    lock_body = lock_res.json()
    assert lock_body["claimed_by_name"] == "Nqobile Dube"
    assert lock_body["claim_locked_until"] is not None

    # Second journalist attempting to claim or mutate the locked signal gets 409 Conflict
    rival_claim = client.post(f"/api/v1/signals/{ref}/claim", headers=buhle_hdr)
    assert rival_claim.status_code == 409
    assert "Locked by Nqobile Dube until" in rival_claim.json()["detail"]

    rival_chk = client.post(
        f"/api/v1/signals/{ref}/checklist",
        json={"item": "locationAndTime", "value": True},
        headers=buhle_hdr,
    )
    assert rival_chk.status_code == 409

    # Lock holder completes all 4 newsroom verification checklist items
    complete_checks(client, nqobile_hdr, ref)

    # Publishing or licensing BEFORE human_visual_ai_check must fail with 409
    blocked_publish = client.post(f"/api/v1/signals/{ref}/verify", headers=admin_hdr)
    assert blocked_publish.status_code == 409

    blocked_license = client.post(
        f"/api/v1/signals/{ref}/license-media",
        json={"license_type": "standard_5", "media_house": "CITE ZW"},
        headers=nqobile_hdr,
    )
    assert blocked_license.status_code == 409

    # Complete Human Visual AI Inspection Gate
    visual_res = client.post(
        f"/api/v1/signals/{ref}/visual-ai-check",
        json={"human_visual_ai_check": True},
        headers=nqobile_hdr,
    )
    assert visual_res.status_code == 200, visual_res.text
    assert visual_res.json()["human_visual_ai_check"] is True

    # Instant Media Licensing: $5 Standard (+$3.50 -> 70%) then $15 24h Exclusive (+$10.50 -> 70%)
    std_lic = client.post(
        f"/api/v1/signals/{ref}/license-media",
        json={"license_type": "standard_5", "media_house": "CITE ZW"},
        headers=nqobile_hdr,
    )
    assert std_lic.status_code == 200, std_lic.text
    std_body = std_lic.json()
    assert std_body["gross_amount_usd"] == 5.0
    assert std_body["contributor_share_usd"] == 3.5
    assert std_body["platform_fee_usd"] == 1.5
    assert std_body["contributor_balance_usd"] == starting_balance + 3.5
    assert std_body["media_access_token"]

    excl_lic = client.post(
        f"/api/v1/signals/{ref}/license-media",
        json={"license_type": "exclusive_15", "media_house": "The Chronicle"},
        headers=nqobile_hdr,
    )
    assert excl_lic.status_code == 200, excl_lic.text
    excl_body = excl_lic.json()
    assert excl_body["gross_amount_usd"] == 15.0
    assert excl_body["contributor_share_usd"] == 10.5
    assert excl_body["platform_fee_usd"] == 4.5
    assert excl_body["contributor_balance_usd"] == starting_balance + 14.0
    assert excl_body["exclusive_license_holder"] == "The Chronicle"
    assert excl_body["exclusive_until"] is not None

    # Competing newsroom is blocked from licensing during the 24h exclusive window
    competing_lic = client.post(
        f"/api/v1/signals/{ref}/license-media",
        json={"license_type": "standard_5", "media_house": "ZBC News"},
        headers=buhle_hdr,
    )
    assert competing_lic.status_code == 409
    assert "The Chronicle" in competing_lic.json()["detail"]

    # Admin publishes verified alert to the public road conditions map
    verify_res = client.post(f"/api/v1/signals/{ref}/verify", headers=admin_hdr)
    assert verify_res.status_code == 200, verify_res.text
    alert_code = verify_res.json()["alertId"]
    assert alert_code

    public_alerts = client.get("/api/v1/public/alerts")
    assert public_alerts.status_code == 200, public_alerts.text
    assert any(a["id"] == alert_code for a in public_alerts.json())

    # ---------- ACT 3: Citizen Wallet 70% Credit & SHA-256 Audit Ledger ----------
    me_after = client.get("/api/v1/auth/me", headers=tariro_hdr)
    assert me_after.status_code == 200, me_after.text
    assert float(me_after.json()["royalty_balance_usd"]) == starting_balance + 14.0

    audit_res = client.get("/api/v1/audit/verify", headers=admin_hdr)
    assert audit_res.status_code == 200, audit_res.text
    audit_body = audit_res.json()
    assert audit_body["ok"] is True
    assert audit_body["verified"] is True
    assert audit_body["checked"] > 0
