"""Create tables, demo staff accounts and sample reports (mirrors the frontend's demo scenario).

    python -m scripts.seed                # creates users + sample reports
    python -m scripts.seed --users-only   # just staff accounts
Demo passwords are printed once; change them before any real deployment.
"""
import argparse
import secrets

from sqlalchemy import select

from app.ai.pipeline import process_report
from app.db import Base, SessionLocal, engine
from app.intake import create_report
from app.models import Role, User
from app.security import Actor, hash_password

SAMPLES = [
    dict(channel="facebook_page", text="Streetlights and approach markings at the ZESA roundabout on Five Avenue are out again after last night's storm. Drivers braking late at the circle.",
         source_url="https://example.org/demo-authorized-public-feed/bulawayo-zesa-roundabout", source_account="Demo civic page (Bulawayo)"),
    dict(channel="whatsapp", text="Pane gomba paA5 pedyo nePlumtree turn-off. Mota dziri kutsauka nzira.", source_ref="seed:wa:1"),
    dict(channel="sms", text="POTHOLE A5 Plumtree road near the turn-off, very deep", source_ref="seed:sms:1"),
    dict(channel="web", text="Deep potholes along Khami Road near Mzilikazi, tyres getting damaged", category_key="potholes",
         road_area="Khami Road", landmark="Mzilikazi turn-off", source_ref="seed:web:1"),
    dict(channel="ussd", text="Flooding on Lobengula St and 12th Ave, cars stuck in water", category_key="flooding",
         road_area="Lobengula St & 12th Ave", source_ref="seed:ussd:1"),
]


def main(users_only: bool) -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    creds = {}
    for email, name, role, gfx in [("editor@panzira.local", "Rudo Moyo", Role.EDITOR, True),
                                   ("journalist@panzira.local", "Tendai Ncube", Role.JOURNALIST, False),
                                   ("admin@panzira.local", "Desk Admin", Role.ADMIN, False)]:
        if not db.execute(select(User).where(User.email == email)).scalar_one_or_none():
            pw = secrets.token_urlsafe(12)
            db.add(User(email=email, name=name, role=role, password_hash=hash_password(pw), can_view_graphic=gfx))
            creds[email] = pw
    db.commit()
    if creds:
        print("Created accounts (shown once):")
        for e, p in creds.items():
            print(f"  {e}  {p}")
    if not users_only:
        ids = []
        for s in SAMPLES:
            r, _, created = create_report(db, actor=Actor.system("system:seed"), **s)
            if created:
                ids.append(r.id)
        db.commit()
        for i in ids:
            process_report(db, i)
        print(f"Seeded {len(ids)} sample reports.")
    db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--users-only", action="store_true")
    main(ap.parse_args().users_only)
