"""Evidence files live outside any web-served directory and are only readable through
authenticated endpoints. File names are random; originals are never exposed publicly."""
import os
import secrets
from pathlib import Path

from .config import get_settings


def _root() -> Path:
    p = Path(get_settings().evidence_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def save_bytes(data: bytes, suffix: str) -> str:
    name = f"{secrets.token_hex(16)}{suffix}"
    path = _root() / name[:2]
    path.mkdir(exist_ok=True)
    full = path / name
    full.write_bytes(data)
    os.chmod(full, 0o600)
    return str(full)


def read_bytes(path: str) -> bytes:
    root = _root().resolve()
    full = Path(path).resolve()
    if root not in full.parents:  # path traversal guard
        raise PermissionError("Invalid evidence path")
    return full.read_bytes()
