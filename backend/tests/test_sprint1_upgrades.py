"""Comprehensive Sprint 1 verification tests covering all 5 backend upgrades:
1. Auth unification, legacy + pbkdf2 password hashes, Citizen & Journalist registration, Admin journalist accreditation approval/rejection, and editor_only allowing both editor and admin.
2. Guest report claim PIN & contributor rights fields (safety_only, free_attribution, commercial_pool; full_name, handle, anonymous) + POST /api/v1/reports/claim.
3. Anti-collision journalist claim & 30-minute lock (/claim, /release, HTTP 409 Conflict for other non-admin users).
4. Automated AI image forensics (Pillow EXIF, 2D FFT screen Moiré check, C2PA/AI metadata signatures, Sightengine genai optional check) + mandatory human_visual_ai_check before publishing reports with images.
5. Instant flat-fee agency licensing ($5 standard / $15 24h exclusive, 70/30 contributor royalty split, MediaLicenseTransaction, clean media token, and SHA-256 hash-chained audit_log).
"""
from __future__ import annotations

import hashlib
import io
import os

import numpy as np
import pytest
from PIL import Image, PngImagePlugin
from sqlalchemy import select

from app import audit
from app.ai.images import analyze_image_forensics
from app.db import SessionLocal
from app.models import MediaLicenseTransaction, Report, User
from app.security import hash_password, verify_password
from tests.conftest import complete_checks, login, png_bytes, submit


def _make_camera_jpeg_with_exif() -> bytes:
    arr = np.zeros((160, 160, 3), dtype=np.uint8)
    for y in range(160):
        arr[y, :, 0] = int(y * 1.2) % 256
        arr[y, :, 1] = 110
        arr[y, :, 2] = 90
    img = Image.fromarray(arr, "RGB")
    exif = img.getexif()
    exif[271] = "Samsung"  # Make
    exif[272] = "SM-S918B"  # Model
    exif[306] = "2026:11:15 09:30:00"  # DateTime
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif.tobytes(), quality=90)
    return buf.getvalue()


def _make_screen_moire_png() -> bytes:
    """Create a synthetic image with a strong high-frequency periodic screen subpixel grid."""
    yy, xx = np.mgrid[0:256, 0:256]
    grid = (((xx % 4 == 0) | (yy % 4 == 0)).astype(np.uint8)) * 220 + 20
    rgb = np.stack([grid, grid, grid], axis=-1)
    img = Image.fromarray(rgb, "RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_ai_signature_png() -> bytes:
    img = Image.new("RGB", (200, 150), (80, 100, 120))
    meta = PngImagePlugin.PngInfo()
    meta.add_text("Software", "Midjourney v6.1 trainedAlgorithmicMedia")
    buf = io.BytesIO()
    img.save(buf, format="PNG", pnginfo=meta)
    return buf.getvalue()


# ---------- 1. Auth, Hashes, Citizen & Journalist Registration ----------
def test_password_hash_accepts_both_pbkdf2_and_legacy_hex():
    # Canonical pbkdf2$... hash
    canonical = hash_password("panzira_secret_2026")
    assert canonical.startswith("pbkdf2$")
    assert verify_password("panzira_secret_2026", canonical) is True
    assert verify_password("wrong", canonical) is False

    # Legacy hex(salt)$hex(key) 100k iterations hash
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", b"legacy_pass_2025", salt, 100_000)
    legacy = f"{salt.hex()}${dk.hex()}"
    assert verify_password("legacy_pass_2025", legacy) is True
    assert verify_password("wrong", legacy) is False


def test_citizen_registration_and_auto_claim_guest_report(client):
    guest = submit(client, desc="Deep pothole near Renkini bus terminus")
    ref = guest["id"]
    pin = guest["claim_pin"]
    assert len(pin) == 4 and pin.isdigit()

    reg = client.post(
        "/api/v1/auth/register/citizen",
        json={
            "email": "citizen1@panzira.org",
            "name": "Nomsa Dube",
            "password": "citizen_password_123",
            "handle": "@nomsa_byo",
            "phone": "+263771234567",
            "claim_reference": f"#{ref}",
            "claim_pin": pin,
            "license_tier": "commercial_pool",
            "attribution_mode": "handle",
        },
    )
    assert reg.status_code == 201, reg.text
    body = reg.json()
    assert body["user"]["role"] == "citizen"
    assert body["user"]["handle"] == "@nomsa_byo"
    assert body["user"]["verification_status"] == "verified"
    assert body["user"]["royalty_balance_usd"] == 0.0
    assert body["claimed_report"] == ref

    db = SessionLocal()
    r = db.get(Report, 1)
    assert r.contributor_id == body["user"]["id"]
    assert r.license_tier == "commercial_pool"
    assert r.attribution_mode == "handle"
    db.close()


def test_journalist_registration_pending_and_admin_approval(client, admin):
    reg = client.post(
        "/api/v1/auth/register/journalist",
        json={
            "email": "chronicle.reporter@zimpapers.co.zw",
            "name": "Buhle Ncube",
            "password": "journo_password_123",
            "media_house": "The Chronicle",
            "zmc_number": "ZMC-2026-8841",
            "press_card_url": "https://chronicle.co.zw/presscards/8841.pdf",
        },
    )
    assert reg.status_code == 201, reg.text
    uid = reg.json()["user"]["id"]
    assert reg.json()["user"]["verification_status"] == "pending_verification"

    # Cannot log in before admin approval
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": "chronicle.reporter@zimpapers.co.zw", "password": "journo_password_123"},
    )
    assert bad_login.status_code == 403

    # Admin lists pending applications
    apps = client.get("/api/v1/admin/journalist-applications", headers=admin)
    assert apps.status_code == 200
    assert any(a["id"] == uid and a["zmc_number"] == "ZMC-2026-8841" for a in apps.json())

    # Admin approves journalist
    dec = client.post(
        f"/api/v1/admin/journalist-applications/{uid}/decide",
        json={"decision": "approve", "reason": "Verified ZMC card"},
        headers=admin,
    )
    assert dec.status_code == 200
    assert dec.json()["verification_status"] == "verified"

    # Now login succeeds and newsroom endpoints work
    ok_login = client.post(
        "/api/v1/auth/login",
        json={"email": "chronicle.reporter@zimpapers.co.zw", "password": "journo_password_123"},
    )
    assert ok_login.status_code == 200
    token = ok_login.json()["accessToken"]
    sigs = client.get("/api/v1/signals", headers={"Authorization": f"Bearer {token}"})
    assert sigs.status_code == 200


def test_admin_can_verify_and_publish_alerts(client, admin, journo):
    ref = submit(client)["id"]
    complete_checks(client, journo, ref)
    res = client.post(f"/api/v1/signals/{ref}/verify", headers=admin)
    assert res.status_code == 200, res.text


# ---------- 2. Guest Report Claim PIN & Contributor Rights ----------
def test_claim_guest_report_endpoint(client):
    guest = submit(client, desc="Flooded low-level bridge near Waterford")
    ref = guest["id"]
    pin = guest["claim_pin"]

    reg = client.post(
        "/api/v1/auth/register/citizen",
        json={
            "email": "citizen2@panzira.org",
            "name": "Sipho Moyo",
            "password": "citizen_password_123",
        },
    )
    token = reg.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    # Wrong PIN rejected
    bad = client.post(
        "/api/v1/reports/claim",
        json={"reference": ref, "claim_pin": "9999" if pin != "9999" else "0000"},
        headers=headers,
    )
    assert bad.status_code == 400

    # Correct PIN claims and updates license_tier and attribution_mode
    ok = client.post(
        "/api/v1/reports/claim",
        json={
            "reference": ref,
            "claim_pin": pin,
            "license_tier": "commercial_pool",
            "attribution_mode": "full_name",
        },
        headers=headers,
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["license_tier"] == "commercial_pool"
    assert ok.json()["attribution_mode"] == "full_name"


# ---------- 3. Anti-Collision Journalist Claim & 30-Minute Lock ----------
def test_anti_collision_claim_lock_and_release(client, journo, editor, admin):
    ref = submit(client, desc="Broken traffic lights at Leopold Takawira and Samuel Parirenyatwa")["id"]

    # Journalist claims the signal
    c_res = client.post(f"/api/v1/signals/{ref}/claim", headers=journo)
    assert c_res.status_code == 200
    assert c_res.json()["claimed_by_name"] == "Tendai"
    assert c_res.json()["claim_locked_until"] is not None

    # Another user (editor) trying to toggle checklist, edit notes, or verify gets 409 Conflict
    chk_conflict = client.post(
        f"/api/v1/signals/{ref}/checklist",
        json={"item": "locationAndTime", "value": True},
        headers=editor,
    )
    assert chk_conflict.status_code == 409
    assert "Locked by Tendai until" in chk_conflict.json()["detail"]

    notes_conflict = client.put(
        f"/api/v1/signals/{ref}/notes",
        json={"notes": "Trying to edit while locked"},
        headers=editor,
    )
    assert notes_conflict.status_code == 409
    assert "Locked by Tendai until" in notes_conflict.json()["detail"]

    verify_conflict = client.post(f"/api/v1/signals/{ref}/verify", headers=editor)
    assert verify_conflict.status_code == 409
    assert "Locked by Tendai until" in verify_conflict.json()["detail"]

    # Admin can bypass the lock
    admin_notes = client.put(
        f"/api/v1/signals/{ref}/notes",
        json={"notes": "Admin override note"},
        headers=admin,
    )
    assert admin_notes.status_code == 200

    # Journalist releases the lock
    rel = client.post(f"/api/v1/signals/{ref}/release", headers=journo)
    assert rel.status_code == 200
    assert rel.json()["claimed_by_id"] is None

    # Now editor can toggle checklist without conflict
    ok_chk = client.post(
        f"/api/v1/signals/{ref}/checklist",
        json={"item": "locationAndTime", "value": True},
        headers=editor,
    )
    assert ok_chk.status_code == 200


# ---------- 4. Automated AI Image Forensics + Mandatory Human Visual Check ----------
def test_image_forensics_camera_moire_and_ai_signatures():
    cam_res = analyze_image_forensics(_make_camera_jpeg_with_exif())
    assert cam_res["ai_scan_verdict"] == "authentic_camera"
    assert cam_res["commercial_eligible"] is True
    assert cam_res["exif"]["Make"] == "Samsung"

    moire_res = analyze_image_forensics(_make_screen_moire_png())
    assert moire_res["ai_scan_verdict"] == "suspected_ai_or_screen"
    assert moire_res["commercial_eligible"] is False
    assert moire_res["fft_moire"]["screen_moire_detected"] is True

    ai_res = analyze_image_forensics(_make_ai_signature_png())
    assert ai_res["ai_scan_verdict"] == "suspected_ai_or_screen"
    assert ai_res["commercial_eligible"] is False
    assert "midjourney" in ai_res["matched_ai_signatures"]

    stripped_res = analyze_image_forensics(png_bytes((70, 90, 110)))
    assert stripped_res["ai_scan_verdict"] == "metadata_stripped_unverified"
    assert stripped_res["commercial_eligible"] is True


def test_mandatory_human_visual_ai_check_gate_for_image_reports(client, journo, editor):
    cam_bytes = _make_camera_jpeg_with_exif()
    sub = submit(client, desc="Sinkhole on Matopos Road near Hillside", photo=cam_bytes)
    ref = sub["id"]
    assert sub["ai_scan_verdict"] == "authentic_camera"
    assert sub["commercial_eligible"] is True

    complete_checks(client, journo, ref)

    # Attempt to publish without human_visual_ai_check -> 409 Conflict
    blocked = client.post(f"/api/v1/signals/{ref}/verify", headers=editor)
    assert blocked.status_code == 409
    assert "human_visual_ai_check" in blocked.json()["detail"] or "visually inspected" in blocked.json()["detail"]

    # Complete human visual AI check and publish -> 200 OK
    chk = client.post(
        f"/api/v1/signals/{ref}/visual-ai-check",
        json={"human_visual_ai_check": True},
        headers=journo,
    )
    assert chk.status_code == 200
    assert chk.json()["human_visual_ai_check"] is True

    published = client.post(f"/api/v1/signals/{ref}/verify", headers=editor)
    assert published.status_code == 200, published.text


# ---------- 5. Instant Flat-Fee Agency Licensing ($5 Standard / $15 Exclusive) ----------
def test_agency_media_licensing_standard_and_exclusive_locks(client, journo, editor):
    # 1. Submit report with authentic camera photo
    cam_bytes = _make_camera_jpeg_with_exif()
    sub = submit(client, desc="Overturned haulage truck on A5 near Plumtree turn-off", photo=cam_bytes)
    ref = sub["id"]
    pin = sub["claim_pin"]

    # 2. Citizen registers, claims report into commercial_pool
    cit = client.post(
        "/api/v1/auth/register/citizen",
        json={
            "email": "eyewitness@panzira.org",
            "name": "Tariro Moyo",
            "password": "citizen_password_123",
            "claim_reference": ref,
            "claim_pin": pin,
            "license_tier": "commercial_pool",
            "attribution_mode": "full_name",
        },
    ).json()
    citizen_id = cit["user"]["id"]

    # 3. Cannot license before human_visual_ai_check is True
    premature = client.post(
        f"/api/v1/signals/{ref}/license-media",
        json={"license_type": "standard_5", "media_house": "CITE ZW"},
        headers=journo,
    )
    assert premature.status_code == 409

    # 4. Complete human visual AI check
    client.post(f"/api/v1/signals/{ref}/visual-ai-check", json={"checked": True}, headers=journo)

    # 5. Purchase $5 Standard License -> credits +$3.50 (70%) to contributor, $1.50 platform fee
    std_res = client.post(
        f"/api/v1/signals/{ref}/license-media",
        json={"license_type": "standard_5", "media_house": "CITE ZW"},
        headers=journo,
    )
    assert std_res.status_code == 200, std_res.text
    std_data = std_res.json()
    assert std_data["gross_amount_usd"] == 5.0
    assert std_data["contributor_share_usd"] == 3.5
    assert std_data["platform_fee_usd"] == 1.5
    assert std_data["contributor_balance_usd"] == 3.5
    assert std_data["media_access_token"]

    # 6. Purchase $15 Exclusive 24h License by The Chronicle -> credits +$10.50 (total $14.00) and locks to The Chronicle
    excl_res = client.post(
        f"/api/v1/signals/{ref}/license-media",
        json={"license_type": "exclusive_15", "media_house": "The Chronicle"},
        headers=journo,
    )
    assert excl_res.status_code == 200, excl_res.text
    excl_data = excl_res.json()
    assert excl_data["gross_amount_usd"] == 15.0
    assert excl_data["contributor_share_usd"] == 10.5
    assert excl_data["platform_fee_usd"] == 4.5
    assert excl_data["contributor_balance_usd"] == 14.0
    assert excl_data["exclusive_license_holder"] == "The Chronicle"
    assert excl_data["exclusive_until"] is not None

    # 7. Another newsroom (ZBC News) is blocked by the active 24h exclusive lock
    blocked = client.post(
        f"/api/v1/signals/{ref}/license-media",
        json={"license_type": "standard_5", "media_house": "ZBC News"},
        headers=editor,
    )
    assert blocked.status_code == 409
    assert "The Chronicle" in blocked.json()["detail"]

    # 8. Verify SHA-256 hash-chained audit_log integrity and MediaLicenseTransaction rows
    db = SessionLocal()
    txs = db.execute(select(MediaLicenseTransaction).where(MediaLicenseTransaction.report_ref == ref)).scalars().all()
    assert len(txs) == 2
    u = db.get(User, citizen_id)
    assert u.royalty_balance_usd == 14.0
    chain = audit.verify_chain(db)
    assert chain["ok"] is True
    db.close()
