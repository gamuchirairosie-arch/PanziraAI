import io
import os
import tempfile

import pytest

_tmp = tempfile.mkdtemp()
os.environ.update({
    "DATABASE_URL": f"sqlite:///{_tmp}/test.db", "EVIDENCE_DIR": f"{_tmp}/evidence", "SECRET_KEY": "test-secret",
    "PHONE_HASH_PEPPER": "test-pepper", "ENV": "dev", "AT_WEBHOOK_SECRET": "", "WA_APP_SECRET": "",
    "FIELD_ENCRYPTION_KEY": "ZmDfcTF7_60GrrY167zsiPd67pEvs0aGOv2oasOM1Pg=",
})

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.database.session import Base as DbBase  # noqa: E402
from app.integrations.messenger import Messenger, set_messenger  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Role, User  # noqa: E402
import app.security as _sec  # noqa: E402
_sec._ITER = 1000  # fast hashing in tests only
from app.security import hash_password, limiter  # noqa: E402


class CaptureMessenger(Messenger):
    def __init__(self):
        self.sent = []

    def send(self, db, channel, to, body, reply_markup=None):
        self.sent.append((channel, to, body))
        return "captured"


import sqlalchemy as sa

@pytest.fixture
def fresh():
    with engine.connect() as conn:
        conn.execute(sa.text("PRAGMA foreign_keys=OFF"))
        Base.metadata.drop_all(conn)
        DbBase.metadata.drop_all(conn)
        Base.metadata.create_all(conn)
        DbBase.metadata.create_all(conn)
        conn.execute(sa.text("PRAGMA foreign_keys=ON"))
        conn.commit()
    limiter.reset()
    cap = CaptureMessenger()
    set_messenger(cap)
    db = SessionLocal()
    for email, name, role, gfx in [("editor@t.local", "Rudo Moyo", Role.EDITOR, True),
                                   ("editor2@t.local", "Second Editor", Role.EDITOR, False),
                                   ("journo@t.local", "Tendai", Role.JOURNALIST, False),
                                   ("admin@t.local", "Admin", Role.ADMIN, False)]:
        db.add(User(email=email, name=name, role=role, password_hash=hash_password("correct-horse-1"),
                    can_view_graphic=gfx))
    db.commit()
    db.close()
    yield cap


@pytest.fixture
def client(fresh):
    with TestClient(app) as c:
        yield c


@pytest.fixture
def sent(fresh):
    return fresh


def login(client, email):
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "correct-horse-1"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['accessToken']}"}


@pytest.fixture
def editor(client):
    return login(client, "editor@t.local")


@pytest.fixture
def editor2(client):
    return login(client, "editor2@t.local")


@pytest.fixture
def journo(client):
    return login(client, "journo@t.local")


@pytest.fixture
def admin(client):
    return login(client, "admin@t.local")


def png_bytes(color=(120, 120, 120), size=(160, 120)) -> bytes:
    b = io.BytesIO()
    Image.new("RGB", size, color).save(b, "PNG")
    return b.getvalue()


def submit(client, desc="Deep pothole on the A5 near the Plumtree turn-off, cars swerving", **extra):
    data = {"description": desc, **extra}
    files = {}
    if "photo" in data:
        files["photo"] = ("p.png", data.pop("photo"), "image/png")
    r = client.post("/api/v1/reports", data=data, files=files or None)
    assert r.status_code == 201, r.text
    return r.json()


def complete_checks(client, hdr, ref):
    for item in ("locationAndTime", "mediaAndDate", "independentSource", "hazardStillPresent"):
        r = client.post(f"/api/v1/signals/{ref}/checklist", json={"item": item, "value": True}, headers=hdr)
        assert r.status_code == 200, r.text
    return r.json()
