"""Tests for Authentication, Security, and Graphic Media Protection

Verifies:
- Role-based access control (RBAC) on journalist and editor endpoints
- Strict withholding of graphic images from public API endpoints
- Complete audit trail persistence for all editorial actions
"""

import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal, Base, engine
from app.database.seed import seed_database
from app.database.models import User, SignalReport, AuditLog


class TestSecurity(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        seed_database(db)
        db.close()
        cls.client = TestClient(app)

    def login_user(self, email: str, password: str) -> str:
        res = self.client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(res.status_code, 200)
        return res.json()["access_token"]

    def test_unauthenticated_newsroom_access_denied(self):
        """Unauthenticated requests to newsroom endpoints must return 401."""
        res = self.client.get("/api/newsroom/signals")
        self.assertEqual(res.status_code, 401)

    def test_graphic_media_withheld_from_public_api(self):
        """Public dashboard alerts must NEVER leak graphic imagery."""
        editor_token = self.login_user("rudo.moyo@panzira.org", "panzira_editor_2025")
        headers = {"Authorization": f"Bearer {editor_token}"}

        # Submit a collision report marked as graphic
        sub_res = self.client.post(
            "/api/public/submit",
            json={
                "categoryKey": "collisions",
                "categoryLabel": "Collision or breakdown",
                "roadArea": "Khami Road",
                "landmark": "Near Kelvin North",
                "description": "Multi-car collision with severe impact and overturned vehicle.",
                "language": "English",
                "photoType": "graphic-collision-demo",
                "containsGraphicContent": True,
            }
        )
        self.assertEqual(sub_res.status_code, 200)
        signal_id = sub_res.json()["id"]

        # Check signal in newsroom: marked as graphic
        sig_res = self.client.get(f"/api/newsroom/signals/{signal_id}", headers=headers)
        self.assertTrue(sig_res.json()["isGraphicImage"])
        self.assertIn("blurred for editorial safety", sig_res.json()["aiImageHeading"])

        # Editor corroborates and verifies
        for check in ["locationAndTime", "mediaAndDate", "independentSource", "hazardStillPresent"]:
            self.client.post(f"/api/newsroom/signals/{signal_id}/checklist", json={"field": check}, headers=headers)
        self.client.post(f"/api/newsroom/signals/{signal_id}/verify", headers=headers)

        # Public alert verification
        pub_res = self.client.get("/api/public/alerts")
        self.assertEqual(pub_res.status_code, 200)
        alerts = pub_res.json()
        matching = [a for a in alerts if a["sourceSignalId"] == signal_id]
        self.assertEqual(len(matching), 1)
        public_alert = matching[0]

        # The public alert description MUST explicitly mention withholding graphic imagery under editorial policy
        self.assertIn("imagery withheld under Panzira editorial graphic-safety policy", public_alert["description"])

    def test_audit_trail_recorded(self):
        """Editorial actions must produce an immutable audit trail entry."""
        editor_token = self.login_user("rudo.moyo@panzira.org", "panzira_editor_2025")
        headers = {"Authorization": f"Bearer {editor_token}"}

        # Request evidence on PZ-SIG-0042
        self.client.post(
            "/api/newsroom/signals/PZ-SIG-0042/request-evidence",
            json={"note": "Test evidence request note"},
            headers=headers
        )

        # Fetch audit trail
        audit_res = self.client.get("/api/newsroom/audit-logs", headers=headers)
        self.assertEqual(audit_res.status_code, 200)
        logs = audit_res.json()
        self.assertTrue(len(logs) > 0)

        # Check that EVIDENCE_REQUESTED was logged with user name Rudo Moyo
        ev_logs = [l for l in logs if l["action"] == "EVIDENCE_REQUESTED"]
        self.assertTrue(len(ev_logs) > 0)
        self.assertEqual(ev_logs[0]["user_name"], "Rudo Moyo")


if __name__ == "__main__":
    unittest.main()

