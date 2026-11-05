"""Fail when a change introduces or modifies database or evidence artifacts.

The existing tracked backup is intentionally not removed by this script. History cleanup
requires a coordinated incident response. This guard prevents the risk from growing.
"""

from __future__ import annotations

import argparse
import pathlib
import subprocess
import sys


BLOCKED_SUFFIXES = (".db", ".db.bak", ".sqlite", ".sqlite3", ".sqlite.bak", ".sqlite3.bak")
BLOCKED_PREFIXES = ("data/evidence/", "backend/data/evidence/")


def changed_files(base: str, head: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=AM", base, head],
        check=True,
        capture_output=True,
        text=True,
    )
    return [line.strip().replace("\\", "/") for line in result.stdout.splitlines() if line.strip()]


def is_blocked(path: str) -> bool:
    lower = path.lower()
    return lower.endswith(BLOCKED_SUFFIXES) or lower.startswith(BLOCKED_PREFIXES)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("base")
    parser.add_argument("head")
    args = parser.parse_args()

    blocked = [path for path in changed_files(args.base, args.head) if is_blocked(path)]
    if blocked:
        print("Database or evidence artifacts must not be added or modified:")
        for path in blocked:
            print(f"- {path}")
        return 1

    print("No new or modified database/evidence artifacts detected.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
