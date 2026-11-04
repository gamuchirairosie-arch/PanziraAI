from sqlalchemy import select

from app.db import SessionLocal
from app.models import PublicAlert, Report
from tests.conftest import complete_checks, submit


def test_new_report_is_processed_but_never_public(client, editor):
    rec = submit(client)
    ref = rec["id"]
    sig = client.get(f"/api/v1/signals/{ref}", headers=editor).json()
    assert sig["status"] == "ai_extracted"
    assert sig["aiConfidenceNote"].endswith("insufficient to publish")
    assert sig["aiHazardType"] == "Road surface damage"
    assert client.get("/api/v1/public/alerts").json() == []


def test_requires_auth_and_roles(client, journo, editor):
    ref = submit(client)["id"]
    assert client.get(f"/api/v1/signals/{ref}").status_code == 401
    assert client.post(f"/api/v1/signals/{ref}/verify", headers=journo).status_code == 403
    assert client.post(f"/api/v1/signals/{ref}/reject", headers=journo).status_code == 403
    assert client.post(f"/api/v1/signals/{ref}/verify").status_code == 401


def test_cannot_publish_before_checks(client, editor):
    ref = submit(client)["id"]
    r = client.post(f"/api/v1/signals/{ref}/verify", headers=editor)
    assert r.status_code == 409


def test_full_path_to_public_alert(client, editor, journo):
    ref = submit(client)["id"]
    sig = complete_checks(client, journo, ref)
    assert sig["status"] == "editor_approval"
    # journalist completed the checks but still cannot publish
    assert client.post(f"/api/v1/signals/{ref}/verify", headers=journo).status_code == 403
    r = client.post(f"/api/v1/signals/{ref}/verify", headers=editor)
    assert r.status_code == 200, r.text
    alerts = client.get("/api/v1/public/alerts").json()
    assert len(alerts) == 1
    assert "Rudo Moyo" in alerts[0]["sourceAttribution"]
    stats = client.get("/api/v1/stats", headers=editor).json()
    assert stats["autoPublishedByAiCount"] == 0 and stats["approvedAlertsCount"] == 1


def test_unticking_a_check_pulls_back_from_approval(client, journo):
    ref = submit(client)["id"]
    complete_checks(client, journo, ref)
    r = client.post(f"/api/v1/signals/{ref}/checklist", json={"item": "independentSource", "value": False}, headers=journo)
    assert r.json()["status"] == "corroboration"


def test_non_english_needs_human_translation_review(client, editor, journo):
    ref = submit(client, desc="Pane gomba paA5 pedyo nePlumtree turn-off. Mota dziri kutsauka nzira.", language="Shona")["id"]
    sig = client.get(f"/api/v1/signals/{ref}", headers=journo).json()
    assert sig["originalLanguage"] == "Shona" and sig["translationReviewed"] is False
    assert sig["draftEnglishTranslation"]
    complete_checks(client, journo, ref)
    assert client.post(f"/api/v1/signals/{ref}/verify", headers=editor).status_code == 409
    client.post(f"/api/v1/signals/{ref}/translation/review",
                json={"english": "There is a deep pothole on the A5 near the Plumtree turn-off."}, headers=journo)
    assert client.post(f"/api/v1/signals/{ref}/verify", headers=editor).status_code == 200


def test_four_eyes_rule(client, editor, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "require_four_eyes", True)
    ref = submit(client)["id"]
    complete_checks(client, editor, ref)
    assert client.post(f"/api/v1/signals/{ref}/verify", headers=editor).status_code == 409


def test_system_actor_can_never_publish():
    from fastapi import HTTPException
    import pytest
    from app import workflow
    from app.security import Actor
    db = SessionLocal()
    from tests.conftest import submit  # noqa
    # forge a report at the approval stage and try to publish as system
    r = Report(channel="web", visibility="opt-in", status="editor_approval", chk_location_time=True, chk_media_date=True,
               chk_independent=True, chk_still_present=True, text_original="x")
    db.add(r); db.flush()
    with pytest.raises(HTTPException) as e:
        workflow.publish(db, r, Actor.system())
    assert e.value.status_code == 403
    assert db.execute(select(PublicAlert)).first() is None
    db.close()


def test_reject_and_reopen_and_withdraw(client, editor, journo):
    ref = submit(client)["id"]
    assert client.post(f"/api/v1/signals/{ref}/reject", json={"note": "no corroboration"}, headers=editor).json()["status"] == "rejected"
    assert client.post(f"/api/v1/signals/{ref}/reopen", headers=editor).json()["status"] == "ai_extracted"
    complete_checks(client, journo, ref)
    code = client.post(f"/api/v1/signals/{ref}/verify", headers=editor).json()["alertId"]
    assert client.post(f"/api/v1/alerts/{code}/withdraw", json={"reason": "hazard repaired"}, headers=journo).status_code == 403
    assert client.post(f"/api/v1/alerts/{code}/withdraw", json={"reason": "hazard repaired"}, headers=editor).status_code == 200
    assert client.get("/api/v1/public/alerts").json() == []
