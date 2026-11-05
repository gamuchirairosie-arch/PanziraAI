from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.db import SessionLocal
from app.integrations import rss_collector, telegram
from app.intake import get_consent, record_consent
from app.models import Report, RSSSource


def test_telegram_webhook_requires_secret(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "telegram_webhook_secret", "secret-value")
    update = {"update_id": 123, "message": {"message_id": 1}}
    denied = client.post("/api/v1/webhooks/telegram", json=update)
    assert denied.status_code == 403
    accepted = client.post("/api/v1/webhooks/telegram", json=update,
                           headers={"X-Telegram-Bot-Api-Secret-Token": "secret-value"})
    assert accepted.status_code == 200


def test_telegram_requires_consent_and_is_idempotent(sent):
    db = SessionLocal()
    user_id, chat_id = 987654321, 987654321
    prompt = {"update_id": 1, "message": {"message_id": 1, "chat": {"id": chat_id, "type": "private"},
              "from": {"id": user_id}, "text": "Hello"}}
    assert telegram.handle_update(db, prompt) is None
    assert get_consent(db, str(user_id), "telegram") is None

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
    assert any(channel == "telegram" for channel, _, _ in sent.sent)
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
