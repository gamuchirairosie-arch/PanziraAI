"""Tests for Verification Workflow & Human Editor Gate

Verifies the central invariant:
Received → AI Extracted → Corroboration → Editor Approval → Public Alert
AI must NEVER automatically publish road-safety warnings.
Verification requires 4/4 checklist completion and human editor role.
"""

import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal, Base, engine
from app.database.seed import seed_database
from app.database.models import SignalReport, VerifiedPublicAlert, User


class TestVerificationGate(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        seed_database(db)
        db.close()
        cls.client = TestClient(app)

    def setUp(self):
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        seed_database(db)
        db.close()

    def login_user(self, email: str, password: str) -> str:
        res = self.client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(res.status_code, 200)
        return res.json()["access_token"]

    def create_test_lead(self, sig_id: str) -> str:
        """Helper to create an unverified lead for test isolation."""
        db = SessionLocal()
        # Remove any existing alert and signal for this id
        pub = db.query(VerifiedPublicAlert).filter(VerifiedPublicAlert.sourceSignalId == sig_id).first()
        if pub:
            db.delete(pub)
        existing = db.query(SignalReport).filter(SignalReport.id == sig_id).first()
        if existing:
            db.delete(existing)
        db.commit()

        sig = SignalReport(
            id=sig_id,
            investigationCode="ROADS-TEST",
            sourceChannelLabel="Citizen web",
            sourceChannelShort="Citizen web (opt-in)",
            workflowStatus="lead",
            pipelineStage=2,
            monitorStatusLabel="Unverified lead",
            reportedDateTime="27 Jan 2025, 12:00",
            title="Test Pothole Lead",
            corridor="A5 · Bulawayo–Plumtree",
            roadArea="A5 Plumtree Road",
            landmark="Test turn-off",
            categoryKey="potholes",
            categoryLabel="Road surface damage",
            originalLanguage="English",
            originalQuote="Test hazard description",
            checklist={
                "locationAndTime": False,
                "mediaAndDate": False,
                "independentSource": False,
                "hazardStillPresent": False,
            },
            timeline=[],
            mapCoords={"xPct": 25.0, "yPct": 65.0},
        )
        db.add(sig)
        db.commit()
        db.close()
        return sig_id

    def test_ai_intake_does_not_publish(self):
        """Citizen report intake creates Stage 2 lead and NEVER creates a public alert."""
        db = SessionLocal()
        initial_alert_count = db.query(VerifiedPublicAlert).count()
        db.close()

        payload = {
            "categoryKey": "potholes",
            "categoryLabel": "Road surface damage",
            "roadArea": "A5 Bulawayo–Plumtree Road",
            "landmark": "Near Bellevue Turn-off",
            "description": "Large potholes damaging rims on the outbound lane.",
            "reportedDateTime": "27 Jan 2025, 10:15",
            "language": "English",
            "photoType": "none",
        }

        res = self.client.post("/api/public/submit", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Invariant checks:
        self.assertEqual(data["workflowStatus"], "lead")
        self.assertEqual(data["pipelineStage"], 2)
        self.assertIn("insufficient to publish", data["aiConfidenceNote"])

        # Check public alert count did NOT increase
        db = SessionLocal()
        new_alert_count = db.query(VerifiedPublicAlert).count()
        db.close()
        self.assertEqual(new_alert_count, initial_alert_count)

    def test_editor_gate_enforces_checklist(self):
        """Verifying without 4/4 checks must fail with HTTP 400."""
        sig_id = self.create_test_lead("PZ-TEST-GATE-01")
        editor_token = self.login_user("rudo.moyo@panzira.org", "panzira_editor_2025")
        headers = {"Authorization": f"Bearer {editor_token}"}

        # Attempt verification with 0/4 checks
        res = self.client.post(f"/api/newsroom/signals/{sig_id}/verify", headers=headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Complete all 4 independent verification checks", res.json()["detail"])

    def test_journalist_cannot_verify(self):
        """Journalist role lacks permission to verify signals (requires editor)."""
        sig_id = self.create_test_lead("PZ-TEST-GATE-02")
        journalist_token = self.login_user("tinashe.ndlovu@panzira.org", "panzira_journalist_2025")
        headers = {"Authorization": f"Bearer {journalist_token}"}

        res = self.client.post(f"/api/newsroom/signals/{sig_id}/verify", headers=headers)
        self.assertEqual(res.status_code, 403)

    def test_successful_editor_approval(self):
        """When an editor completes all 4 checks, verification succeeds and broadcasts public alert."""
        sig_id = self.create_test_lead("PZ-TEST-GATE-03")
        editor_token = self.login_user("rudo.moyo@panzira.org", "panzira_editor_2025")
        headers = {"Authorization": f"Bearer {editor_token}"}

        # Toggle all 4 checks
        checks = ["locationAndTime", "mediaAndDate", "independentSource", "hazardStillPresent"]
        for c in checks:
            toggle_res = self.client.post(
                f"/api/newsroom/signals/{sig_id}/checklist",
                json={"field": c},
                headers=headers
            )
            self.assertEqual(toggle_res.status_code, 200)

        # Now approve
        verify_res = self.client.post(f"/api/newsroom/signals/{sig_id}/verify", headers=headers)
        self.assertEqual(verify_res.status_code, 200)
        verified_data = verify_res.json()
        self.assertEqual(verified_data["workflowStatus"], "verified")
        self.assertEqual(verified_data["pipelineStage"], 4)

        # Check that it appears on the public alerts API
        pub_res = self.client.get("/api/public/alerts")
        self.assertEqual(pub_res.status_code, 200)
        alerts = pub_res.json()
        matching = [a for a in alerts if a["sourceSignalId"] == sig_id]
        self.assertEqual(len(matching), 1)


if __name__ == "__main__":
    unittest.main()
