import sqlite3
import shutil
from pathlib import Path

db_path = Path("panzira.db")
bak_path = Path("panzira.db.bak")

# Create reproducible backup
shutil.copy2(db_path, bak_path)
print(f"[*] Backup created successfully at: {bak_path.resolve()}")

con = sqlite3.connect(db_path)
cur = con.cursor()

tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print(f"[*] Total tables in database: {len(tables)}")

key_tables = [
    "users",
    "signal_reports",
    "verified_public_alerts",
    "corridor_watches",
    "working_briefs",
    "audit_logs",
    "reports",
]

for t in key_tables:
    if t in tables:
        count = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"  - {t}: {count} records preserved")

users = cur.execute("SELECT id, email, full_name, role, is_active FROM users").fetchall()
print("[*] Preserved user accounts:")
for u in users:
    print(f"  - ID {u[0]}: {u[1]} ({u[2]}, Role: {u[3]}, Active: {bool(u[4])})")

con.close()

