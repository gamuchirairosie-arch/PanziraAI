import hashlib
import hmac
import json

from sqlalchemy import select

from app.db import SessionLocal
from app.integrations import africastalking as at
from app.integrations import meta
from app.models import Consent, Outbox, Report, SourceRegistration
from tests.conftest import submit

PHONE = "+263772000111"


# ---------- USSD ----------
def ussd(client, text, session="S1", phone=PHONE):
    r = client.post("/webhooks/africastalking/ussd", data={"sessionId": session, "phoneNumber": phone,
                                                          "serviceCode": "*123#", "text": text})
    assert r.status_code == 200
    return r.text


def test_ussd_full_report_flow_and_limits(client, journo, sent):
    steps = ["", "1", "1*1", "1*1*1", "1*1*1*Plumtree turn-off", "1*1*1*Plumtree turn-off*1"]
    outs = [ussd(client, s) for s in steps]
    assert outs[0].startswith("CON") and "Report a hazard" in outs[0]
    assert all(o.startswith("CON") for o in outs[:-1]) and outs[-1].startswith("END")
    assert all(len(o) <= 182 for o in outs), [len(o) for o in outs]
    assert "PZ-SIG-0001" in outs[-1]
    s = client.get("/api/v1/signals/PZ-SIG-0001", headers=journo).json()
    assert s["sourceChannelLabel"] == "USSD report" and s["categoryKey"] == "potholes"
    assert s["corridor"].startswith("A5") and s["workflowStatus"] == "lead"
    assert any(ch == "sms" and "PZ-SIG-0001" in body for ch, _, body in sent.sent)  # SMS receipt


def test_ussd_is_idempotent_and_cancel_creates_nothing(client):
    ussd(client, "1*2*4*0*1", session="S9"); ussd(client, "1*2*4*0*1", session="S9")
    ussd(client, "1*3*2*0*2", session="S10")
    db = SessionLocal()
    assert len(db.execute(select(Report)).scalars().all()) == 1
    db.close()


def test_ussd_other_area_and_invalid_choices(client):
    assert ussd(client, "1*4*5").startswith("CON") and "Type the road" in ussd(client, "1*4*5")
    assert ussd(client, "1*9").startswith("END")
    assert ussd(client, "7").startswith("END")


def test_ussd_status_only_for_owner(client):
    ussd(client, "1*1*1*0*1", session="A")
    mine = ussd(client, "2*PZ-SIG-0001", session="C")
    other = ussd(client, "2*PZ-SIG-0001", session="D", phone="+263773999888")
    assert "PZ-SIG-0001" in mine and "not found" in other.lower()


def test_ussd_language_switch(client):
    assert "Ndebele" in ussd(client, "3") or "Language" in ussd(client, "3")
    ussd(client, "3*2")
    assert "Ripoti" in ussd(client, "")   # Shona menu


def test_ussd_webhook_key_enforced(client, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "at_webhook_secret", "s3cret")
    r = client.post("/webhooks/africastalking/ussd", data={"sessionId": "x", "phoneNumber": PHONE, "text": ""})
    assert r.status_code == 403
    r = client.post("/webhooks/africastalking/ussd?key=s3cret", data={"sessionId": "x", "phoneNumber": PHONE, "text": ""})
    assert r.status_code == 200


# ---------- SMS ----------
def test_sms_parser():
    p = at.parse_sms("CRASH Plumtree road Gwanda 2 vehicles")
    assert p["command"] == "report" and p["category"] == "collisions"
    assert at.parse_sms("pothole A5 near the turn-off")["category"] == "potholes"
    assert at.parse_sms("Streetlights out at ZESA roundabout")["category"] is None  # AI classifies
    assert at.parse_sms("STATUS PZ-SIG-0042") == {"command": "status", "ref_id": 42}
    assert at.parse_sms("stop")["command"] == "stop" and at.parse_sms("")["command"] == "help"
    assert at.parse_sms("CRASH")["command"] == "help"  # keyword without details


def sms(client, text, frm=PHONE, mid="m1"):
    return client.post("/webhooks/africastalking/sms", data={"from": frm, "to": "12345", "text": text, "id": mid})


def test_sms_report_reply_and_idempotency(client, journo, sent):
    assert sms(client, "CRASH Plumtree road Gwanda 2 vehicles", mid="a1").status_code == 200
    sms(client, "CRASH Plumtree road Gwanda 2 vehicles", mid="a1")  # provider retry
    sigs = client.get("/api/v1/signals", headers=journo).json()
    assert len(sigs) == 1 and sigs[0]["categoryKey"] == "collisions" and sigs[0]["sourceChannelLabel"] == "SMS report"
    assert "PZ-SIG-0001" in sent.sent[0][2]


def test_sms_stop_removes_contact(client):
    sms(client, "YES", mid="y"); sms(client, "POTHOLE Khami Road Mzilikazi", mid="r1")
    db = SessionLocal()
    assert db.execute(select(Report)).scalars().first().contact_enc is not None
    db.close()
    sms(client, "STOP", mid="s")
    db = SessionLocal()
    assert db.execute(select(Report)).scalars().first().contact_enc is None
    db.close()


def test_sms_rate_limit(client, sent):
    for i in range(12):
        sms(client, f"POTHOLE Khami Road number {i}", mid=f"x{i}")
    db = SessionLocal()
    assert len(db.execute(select(Report)).scalars().all()) == 10
    db.close()


# ---------- WhatsApp ----------
def wa_payload(frm, mid, text=None, mtype="text", **extra):
    msg = {"from": frm, "id": mid, "timestamp": "1767000000", "type": mtype}
    if text is not None:
        msg["text"] = {"body": text}
    msg.update(extra)
    return {"entry": [{"changes": [{"value": {"messages": [msg]}}]}]}


def post_wa(client, payload, secret=None):
    raw = json.dumps(payload).encode()
    headers = {"content-type": "application/json"}
    if secret:
        headers["x-hub-signature-256"] = "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return client.post("/webhooks/whatsapp", content=raw, headers=headers)


def test_whatsapp_requires_opt_in_before_anything_is_stored(client, sent):
    post_wa(client, wa_payload("263772000222", "w1", "Pane gomba paA5 pedyo nePlumtree turn-off"))
    db = SessionLocal()
    assert db.execute(select(Report)).first() is None          # nothing stored before consent
    db.close()
    assert "YES" in sent.sent[-1][2]
    post_wa(client, wa_payload("263772000222", "w2", "YES"))
    post_wa(client, wa_payload("263772000222", "w3", "Pane gomba paA5 pedyo nePlumtree turn-off. Mota dziri kutsauka nzira."))
    post_wa(client, wa_payload("263772000222", "w3", "Pane gomba paA5 pedyo nePlumtree turn-off. Mota dziri kutsauka nzira."))  # retry
    db = SessionLocal()
    reps = db.execute(select(Report)).scalars().all()
    assert len(reps) == 1 and reps[0].channel == "whatsapp" and reps[0].language == "sn"
    assert reps[0].contact_enc and "263772000222" not in (reps[0].contributor_hash or "")
    db.close()
    assert "PZ-SIG-0001" in sent.sent[-1][2]


def test_whatsapp_stop_revokes_and_erases_contact(client, sent):
    for mid, txt in (("a", "YES"), ("b", "pothole on Khami Road near Mzilikazi"), ("c", "STOP")):
        post_wa(client, wa_payload("263772000333", mid, txt))
    db = SessionLocal()
    assert db.execute(select(Report)).scalars().first().contact_enc is None
    assert db.execute(select(Consent)).scalars().first().revoked_at is not None
    db.close()
    post_wa(client, wa_payload("263772000333", "d", "another pothole at Khami Road"))   # consent gone -> prompt again
    db = SessionLocal()
    assert len(db.execute(select(Report)).scalars().all()) == 1
    db.close()


def test_whatsapp_signature_enforced(client, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "wa_app_secret", "appsecret")
    p = wa_payload("263772000444", "z1", "hello")
    assert post_wa(client, p).status_code == 403
    assert post_wa(client, p, secret="wrong").status_code == 403
    assert post_wa(client, p, secret="appsecret").status_code == 200


def test_whatsapp_verify_handshake(client, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "wa_verify_token", "vt")
    ok = client.get("/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "vt", "hub.challenge": "777"})
    assert ok.status_code == 200 and ok.text == "777"
    assert client.get("/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "no", "hub.challenge": "1"}).status_code == 403


def test_whatsapp_image_is_attached_and_analysed(client, journo, monkeypatch):
    from app.integrations import whatsapp as wa
    from tests.conftest import png_bytes
    red = png_bytes((130, 10, 10))
    orig = wa.handle_message
    # the webhook calls handle_message(db, m); inject a fake media downloader (no network in tests)
    monkeypatch.setattr(wa, "handle_message", lambda db, m: orig(db, m, fetch_media=lambda media_id: red))
    post_wa(client, wa_payload("263772000555", "q1", "YES"))
    post_wa(client, wa_payload("263772000555", "q2", mtype="image", image={"id": "M1", "caption": "crash at Hillside junction"}))
    s = client.get("/api/v1/signals/PZ-SIG-0001", headers=journo).json()
    assert s["photoType"] == "custom-upload" and s["isGraphicImage"] is True


# ---------- social (official APIs only) ----------
def test_social_ingest_filters_unrelated_and_dedupes(client, admin, journo, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "meta_graph_token", "tok")
    client.post("/api/v1/sources", json={"platform": "facebook_page", "account_id": "999", "display_name": "Demo civic page",
                                         "basis": "Page admin granted access via Meta"}, headers=admin)
    from datetime import datetime, timezone
    items = [
        meta.IngestItem("facebook_page", "999", "Demo civic page", "p1", "Streetlights out at the ZESA roundabout on Five Avenue",
                        "https://facebook.com/x/posts/1", datetime(2026, 11, 3, 9, 42, tzinfo=timezone.utc)),
        meta.IngestItem("facebook_page", "999", "Demo civic page", "p2", "Happy birthday to our chairperson! Join us on Saturday", None, None),
    ]
    fetchers = {"facebook_page": lambda src, limit=25: items}
    db = SessionLocal()
    from app.security import Actor
    res1 = meta.poll_registered_sources(db, Actor.system("system:social-ingest"), fetchers); db.commit()
    res2 = meta.poll_registered_sources(db, Actor.system("system:social-ingest"), fetchers); db.commit()
    assert res1["sources"][0]["kept"] == 1 and res1["sources"][0]["skipped_unrelated"] == 1
    assert res2["sources"][0]["kept"] == 0 and res2["sources"][0]["duplicates"] == 1
    r = db.execute(select(Report)).scalar_one()
    assert r.channel == "facebook_page" and r.source_url and r.source_posted_at and r.source_account == "Demo civic page"
    assert r.visibility == "public"
    db.close()
    from app.ai.pipeline import process_report
    db = SessionLocal(); process_report(db, 1); db.close()
    s = client.get("/api/v1/signals/PZ-SIG-0001", headers=journo).json()
    assert s["workflowStatus"] == "lead" and s["monitorStatusLabel"] == "Needs corroboration"
    assert client.get("/api/v1/public/alerts").json() == []     # social leads are never auto-published


def test_unregistered_sources_are_not_polled(client):
    db = SessionLocal()
    from app.config import get_settings
    get_settings().meta_graph_token = "tok"
    from app.security import Actor
    res = meta.poll_registered_sources(db, Actor.system(), {"facebook_page": lambda s, limit=25: 1 / 0})
    assert res["sources"] == []
    get_settings().meta_graph_token = ""
    db.close()


def test_public_link_ingest(client, journo):
    r = client.post("/api/v1/ingest/public-link", json={"url": "https://www.facebook.com/somepage/posts/123",
                                                       "text": "Flooding at the bridge on Khami Road"}, headers=journo)
    assert r.status_code == 201 and r.json()["created"] is True
    assert client.post("/api/v1/ingest/public-link", json={"url": "https://evil.example.com/x"}, headers=journo).status_code == 422
    assert client.post("/api/v1/ingest/public-link", json={"url": "https://www.facebook.com/somepage/posts/123"}).status_code == 401


# ---------- corridors ----------
def test_corridor_scores_independent_clusters_not_raw_counts(client, journo):
    for d in ("Deep pothole on the A5 near Plumtree turn-off", "Big pothole along the A5 by the Plumtree turn-off"):
        submit(client, desc=d)
    c = {x["id"]: x for x in client.get("/api/v1/corridors", headers=journo).json()}
    assert c["A5"]["clusterCount"] == 2
    assert c["A5"]["independentSources"] <= 2 and c["A5"]["verifiedAlerts"] == 0
    assert "Do not reroute" in c["A5"]["fleetConfidenceLine"] or c["A5"]["scoreNumeric"] is None


# ---------- briefs ----------
def test_brief_scaffold_and_optimistic_locking(client, journo):
    ref = submit(client)["id"]
    b = client.post(f"/api/v1/briefs/from-signal/{ref}", headers=journo).json()
    assert b["investigationId"] == "ROADS-0001" and "not an established fact" in b["lead"]
    body = {**b, "title": "Edited title", "baseVersion": b["version"]}
    ok = client.put(f"/api/v1/briefs/{b['investigationId']}", json=body, headers=journo)
    assert ok.status_code == 200 and ok.json()["version"] == b["version"] + 1
    stale = client.put(f"/api/v1/briefs/{b['investigationId']}", json=body, headers=journo)
    assert stale.status_code == 409
