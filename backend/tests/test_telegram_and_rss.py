from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.db import SessionLocal
from app.integrations import rss_collector, telegram
from app.integrations.messenger import Messenger
from app.intake import get_consent, record_consent
from app.models import Outbox, PublicAlert, Report, RSSSource, TelegramDraft, TelegramUpdate


def test_telegram_webhook_requires_secret(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "telegram_webhook_secret", "secret-value")
    update = {"update_id": 123, "message": {"message_id": 1}}
    denied = client.post("/api/v1/webhooks/telegram", json=update)
    assert denied.status_code == 403
    accepted = client.post("/api/v1/webhooks/telegram", json=update,
                           headers={"X-Telegram-Bot-Api-Secret-Token": "secret-value"})
    assert accepted.status_code == 200


def test_telegram_webhook_distinguishes_missing_configuration(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "telegram_webhook_secret", "")
    response = client.post("/api/v1/webhooks/telegram", json={"update_id": 123})
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]


def test_telegram_requires_consent_and_is_idempotent(sent):
    db = SessionLocal()
    user_id, chat_id = 987654321, 987654321
    prompt = {"update_id": 1, "message": {"message_id": 1, "chat": {"id": chat_id, "type": "private"},
              "from": {"id": user_id}, "text": "Hello"}}
    assert telegram.handle_update(db, prompt) is None
    assert telegram.handle_update(db, prompt) is None
    assert get_consent(db, str(user_id), "telegram") is None
    assert len(sent.sent) == 1  # a retried update does not repeat the consent prompt

    record_consent(db, str(user_id), "telegram", "en", allow_followup=True)
    report_update = {"update_id": 2, "message": {"message_id": 2, "chat": {"id": chat_id, "type": "private"},
                     "from": {"id": user_id}, "text": "Deep pothole on Khami Road near Mzilikazi, cars swerving",
                     "location": {"latitude": -20.15, "longitude": 28.58}}}
    rid = telegram.handle_update(db, report_update, fetch_photo=lambda _: None)
    db.commit()
    report = db.get(Report, rid)
    assert report.channel == "telegram"
    assert report.visibility == "opt-in"
    assert report.source_ref == "telegram:987654321:2"
    assert report.gps_reported is True
    assert telegram.handle_update(db, report_update, fetch_photo=lambda _: None) is None
    assert len(db.execute(select(Report)).scalars().all()) == 1
    assert len(db.execute(select(TelegramUpdate)).scalars().all()) == 2
    assert any(channel == "telegram" for channel, _, _ in sent.sent)
    db.close()


def test_duplicate_webhook_delivery_has_no_duplicate_reply(client, sent, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "telegram_webhook_secret", "fictional-secret")
    update = {"update_id": 8181, "message": {"message_id": 4,
              "chat": {"id": 555100, "type": "private"}, "from": {"id": 555100},
              "text": "Hello"}}
    headers = {"X-Telegram-Bot-Api-Secret-Token": "fictional-secret"}
    assert client.post("/api/v1/webhooks/telegram", json=update, headers=headers).status_code == 200
    assert client.post("/api/v1/webhooks/telegram", json=update, headers=headers).status_code == 200
    assert len(sent.sent) == 1


def test_telegram_lead_is_visible_to_journalist_and_never_public(client, sent):
    from app.ai.pipeline import process_report

    db = SessionLocal()
    user_id = 777001
    next_update = 9900

    def answer(text=None, *, location=None):
        nonlocal next_update
        next_update += 1
        message = {"message_id": next_update, "chat": {"id": user_id, "type": "private"},
                   "from": {"id": user_id}}
        if text is not None:
            message["text"] = text
        if location is not None:
            message["location"] = location
        return telegram.handle_update(db, {"update_id": next_update, "message": message},
                                      fetch_photo=lambda _: None)

    assert answer("/start report") is None
    assert get_consent(db, str(user_id), "telegram") is None
    assert answer("YES") is None
    assert db.execute(select(TelegramDraft)).scalars().one().state == "category"
    assert answer("1") is None
    assert answer("A5 Bulawayo-Plumtree Road") is None
    assert answer("Bellevue turn-off") is None
    assert answer("NOW") is None
    assert answer("Deep pothole across the outbound lane; vehicles are swerving") is None
    assert answer(location={"latitude": -20.151, "longitude": 28.579}) is None
    report_id = answer("SUBMIT")
    db.commit()
    report = db.get(Report, report_id)
    assert report.category_key == "potholes"
    assert report.road_area == "A5 Bulawayo-Plumtree Road"
    assert report.landmark == "Bellevue turn-off"
    assert report.gps_reported is True
    assert report.source_ref.startswith("telegram:draft:")
    assert db.execute(select(TelegramDraft)).scalars().all() == []
    process_report(db, report_id)
    db.close()

    # The current frontend signs in through the original /api auth route, then
    # merges Telegram leads from the v1 inbox. Exercise that exact token path.
    login = client.post("/api/auth/login", json={
        "email": "tinashe.ndlovu@panzira.org", "password": "panzira_journalist_2025",
    })
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.get("/api/v1/signals?channel=telegram", headers=headers)
    assert response.status_code == 200, response.text
    lead = response.json()[0]
    assert lead["sourceChannelLabel"] == "Opt-in Telegram"
    assert lead["roadArea"] == "A5 Bulawayo-Plumtree Road"
    assert lead["landmark"] == "Bellevue turn-off"
    assert lead["visibility"] == "opt-in"
    assert lead["workflowStatus"] == "lead"
    assert all(value is False for value in lead["checklist"].values())

    db = SessionLocal()
    assert db.execute(select(PublicAlert)).scalars().all() == []
    db.close()


def test_telegram_photo_provider_failure_keeps_text_lead(sent):
    db = SessionLocal()
    user_id = 777002
    record_consent(db, str(user_id), "telegram", "en", allow_followup=True)
    update = {"update_id": 9902, "message": {"message_id": 10,
              "chat": {"id": user_id, "type": "private"}, "from": {"id": user_id},
              "caption": "Flooding across Luveve Road", "photo": [{"file_id": "fictional-photo"}]}}

    def provider_failure(_):
        raise RuntimeError("fictional provider outage")

    report_id = telegram.handle_update(db, update, fetch_photo=provider_failure)
    db.commit()
    report = db.get(Report, report_id)
    assert report is not None
    assert report.text_original == "Flooding across Luveve Road"
    assert any("unverified lead" in body for _, _, body in sent.sent)
    db.close()


def test_telegram_provider_rejection_is_recorded_as_failed(sent, monkeypatch):
    from app.config import get_settings
    from app.integrations import messenger

    class RejectedResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"ok": False, "description": "fictional rejection"}

    monkeypatch.setattr(get_settings(), "telegram_bot_token", "fictional-token")
    monkeypatch.setattr(messenger.httpx, "post", lambda *args, **kwargs: RejectedResponse())
    db = SessionLocal()
    assert Messenger().send(db, "telegram", "555123", "fictional reply") == "failed"
    db.commit()
    row = db.execute(select(Outbox).where(Outbox.channel == "telegram")).scalars().one()
    assert row.status == "failed"
    db.close()


def test_stop_revokes_telegram_consent_and_blocks_new_report(sent):
    db = SessionLocal()
    user_id = 777003
    record_consent(db, str(user_id), "telegram", "en", allow_followup=True)
    start = {"update_id": 9902, "message": {"message_id": 10,
             "chat": {"id": user_id, "type": "private"}, "from": {"id": user_id}, "text": "/report"}}
    assert telegram.handle_update(db, start) is None
    assert db.execute(select(TelegramDraft)).scalars().one().state == "category"
    stop = {"update_id": 9903, "message": {"message_id": 11,
            "chat": {"id": user_id, "type": "private"}, "from": {"id": user_id}, "text": "/stop"}}
    assert telegram.handle_update(db, stop) is None
    db.commit()
    assert get_consent(db, str(user_id), "telegram") is None
    assert db.execute(select(TelegramDraft)).scalars().all() == []

    after_stop = {"update_id": 9904, "message": {"message_id": 12,
                  "chat": {"id": user_id, "type": "private"}, "from": {"id": user_id},
                  "text": "Pothole after stop"}}
    assert telegram.handle_update(db, after_stop) is None
    db.commit()
    assert db.execute(select(Report)).scalars().all() == []
    db.close()


def test_telegram_group_messages_are_ignored(sent):
    db = SessionLocal()
    update = {"update_id": 1, "message": {"message_id": 1, "chat": {"id": -100, "type": "group"},
              "from": {"id": 4}, "text": "YES"}}
    assert telegram.handle_update(db, update) is None
    assert db.execute(select(Report)).scalars().all() == []
    db.close()


def test_rss_parser_extracts_attributed_fields():
    xml = b'''<?xml version="1.0"?><rss version="2.0"><channel><item>
      <title>Road closure after crash on A5</title><link>https://bulawayo24.com/story/1</link>
      <description><![CDATA[Traffic affected near Plumtree turn-off.]]></description>
      <guid>story-1</guid><pubDate>Tue, 04 Nov 2025 10:00:00 GMT</pubDate>
    </item></channel></rss>'''
    items = rss_collector.parse_feed(xml)
    assert len(items) == 1
    assert items[0]["title"] == "Road closure after crash on A5"
    assert items[0]["url"] == "https://bulawayo24.com/story/1"
    assert items[0]["ref"] == "story-1"
    assert items[0]["published_at"].tzinfo is not None


def test_rss_feed_url_requires_https_and_approved_host(monkeypatch):
    monkeypatch.setattr(rss_collector.socket, "getaddrinfo", lambda *a, **k: [
        (None, None, None, None, ("1.1.1.1", 443)),
    ])
    url, domain = rss_collector.validate_feed_url("https://feeds.bulawayo24.com/news.xml")
    assert url.startswith("https://") and domain == "feeds.bulawayo24.com"
    with pytest.raises(ValueError):
        rss_collector.validate_feed_url("http://bulawayo24.com/feed")
    with pytest.raises(ValueError):
        rss_collector.validate_feed_url("https://example.com/feed")


def test_editor_can_register_only_allowlisted_feed(client, editor, monkeypatch):
    monkeypatch.setattr(rss_collector.socket, "getaddrinfo", lambda *a, **k: [
        (None, None, None, None, ("1.1.1.1", 443)),
    ])
    response = client.post("/api/v1/news-sources", headers=editor, json={
        "name": "Bulawayo24", "feedUrl": "https://bulawayo24.com/feed.xml",
        "basis": "Publisher-provided public RSS feed", "pollIntervalMinutes": 15,
    })
    assert response.status_code == 201, response.text
    source = response.json()
    assert source["publisherDomain"] == "bulawayo24.com"
    assert source["active"] is True
    rows = client.get("/api/v1/news-sources", headers=editor).json()
    assert len(rows) == 1
    duplicate = client.post("/api/v1/news-sources", headers=editor, json={
        "name": "Duplicate", "feedUrl": "https://bulawayo24.com/feed.xml",
        "basis": "Publisher-provided public RSS feed",
    })
    assert duplicate.status_code == 409
