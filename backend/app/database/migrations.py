"""Panzira AI - Safe Schema Migration Script
Ensures reproducible schema upgrades without data loss or dropping tables.
Run with:
    python -m app.database.migrations
"""

import sqlite3
import os
import shutil
from pathlib import Path
from datetime import datetime

def run_migrations(db_path: str = "panzira.db"):
    db_file = Path(db_path)
    if not db_file.exists():
        print(f"[!] Database {db_path} does not exist yet. Nothing to migrate.")
        return

    # Create timestamped safety backup before applying migrations
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = db_file.parent / f"{db_file.stem}_pre_migration_{ts}.db"
    shutil.copy2(db_file, backup_file)
    print(f"[*] Created pre-migration backup at: {backup_file.name}")

    con = sqlite3.connect(db_file)
    cur = con.cursor()

    # 1. Inspect and migrate 'users' table
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    if cur.fetchone():
        user_cols = [r[1] for r in cur.execute("PRAGMA table_info(users)").fetchall()]
        print(f"[*] Current users columns: {user_cols}")

        user_migrations = [
            ("password_hash", "ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"),
            ("name", "ALTER TABLE users ADD COLUMN name VARCHAR(255)"),
            ("can_view_graphic", "ALTER TABLE users ADD COLUMN can_view_graphic BOOLEAN DEFAULT 0"),
            ("active", "ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT 1"),
            ("failed_logins", "ALTER TABLE users ADD COLUMN failed_logins INTEGER DEFAULT 0"),
            ("locked_until", "ALTER TABLE users ADD COLUMN locked_until DATETIME"),
        ]

        for col, sql in user_migrations:
            if col not in user_cols:
                print(f"  + Applying migration: Adding '{col}' to users")
                cur.execute(sql)

        # Backfill synonyms
        cur.execute("UPDATE users SET password_hash = hashed_password WHERE password_hash IS NULL AND hashed_password IS NOT NULL")
        cur.execute("UPDATE users SET hashed_password = password_hash WHERE hashed_password IS NULL AND password_hash IS NOT NULL")
        cur.execute("UPDATE users SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL")
        cur.execute("UPDATE users SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL")
        cur.execute("UPDATE users SET active = is_active WHERE active IS NULL AND is_active IS NOT NULL")
        cur.execute("UPDATE users SET is_active = active WHERE is_active IS NULL AND active IS NOT NULL")

    con.commit()
    con.close()
    print("[*] All migrations applied successfully and safely.")

if __name__ == "__main__":
    run_migrations()

