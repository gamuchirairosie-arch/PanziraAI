"""Tests for WhatsApp, Social Collector, and SMS/USSD Integrations

Verifies:
- Citizen-initiated opt-in WhatsApp ingestion
- Strict refusal of unauthorized private WhatsApp scraping
- Permitted public social feed collection with provenance recording
- SMS and USSD intake
"""

import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal, Base, engine
from app.database.seed import seed_database
from app.database.models import SignalReport, AuditLog


class TestIntegrations(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        seed_database(db)
        db.close()
        cls.client = TestClient(app)

    def test_whatsapp_webhook_verification(self):
        """Meta webhook challenge verification."""
        res = self.client.get(
            "/api/integrations/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=panzira_whatsapp_optin_token_2025&hub.challenge=test_challenge_123"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.text, "test_challenge_123")

    def test_whatsapp_optin_ingestion(self):
        """Opt-in citizen WhatsApp submission is ingested as an unverified lead."""
        payload = {
            "from_number": "+263772123456",
            "message_body": "Pane gomba guru paA5 pedyo neBellevue. Mota dziri kuroverana.",
            "user_consented_opt_in": True,
        }
        res = self.client.post("/api/integrations/whatsapp/webhook", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["sourceChannelLabel"], "Opt-in WhatsApp")
        self.assertEqual(data["workflowStatus"], "lead")
        self.assertEqual(data["originalLanguage"], "Shona")
        self.assertIn("pothole", data["draftEnglishTranslation"].lower())
        self.assertNotIn("+263772123456", data["sourceProvenanceNote"])  # Pseudonymized for privacy!

    def test_refuse_unauthorized_whatsapp_scraping(self):
        """Private group message without opt-in consent must be strictly refused."""
        payload = {
            "from_number": "+263772999999",
            "message_body": "Forwarded from private group: road closed",
            "user_consented_opt_in": False,
        }
        res = self.client.post("/api/integrations/whatsapp/webhook", json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Opt-in consent missing", res.json()["detail"])

    def test_permitted_social_post_ingestion(self):
        """Ingests authorized civic page post with full provenance."""
        payload = {
            "platform": "facebook",
            "page_name": "City of Bulawayo Engineering Desk",
            "post_url": "https://facebook.com/cityofbulawayo/posts/849204820",
            "post_text": "Public Notice: Khami Road bridge has high standing water. Drainage clearing crews on site.",
            "published_timestamp": "27 Jan 2025, 11:00",
            "has_explicit_permission": True,
        }
        res = self.client.post("/api/integrations/social/public-feed", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["sourceChannelLabel"], "Public Facebook page")
        self.assertEqual(data["visibility"], "public")
        self.assertEqual(data["categoryKey"], "flooding")
        self.assertEqual(data["evidenceLink"], "https://facebook.com/cityofbulawayo/posts/849204820")

    def test_sms_intake(self):
        """Low-bandwidth SMS intake."""
        payload = {
            "sender_phone": "+263712345678",
            "body": "POTHOLE A5 Plumtree Road near turnoff deep hole",
        }
        res = self.client.post("/api/integrations/sms/inbound", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["sourceChannelLabel"], "Low-bandwidth SMS")
        self.assertEqual(data["categoryKey"], "potholes")


if __name__ == "__main__":
    unittest.main()

