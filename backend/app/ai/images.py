"""Image analysis: integrity, provenance signals, perceptual hash, and a graphic-content screen.

* EXIF / GPS / timestamp extraction for corroboration (absent EXIF is normal for WhatsApp images).
* 64-bit DCT perceptual hash so re-posted or recompressed copies of the same photo can be linked.
* Graphic screen: colour-statistics heuristic (blood-red + skin-tone coverage). This is a coarse,
  conservative filter, NOT a vision model. It is behind the `GraphicScorer` interface so a trained
  model can replace it without touching the pipeline. Anything uncertain is routed to restricted review.
"""
from __future__ import annotations

import hashlib
import io
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

import numpy as np
from PIL import ExifTags, Image, ImageFilter, ImageOps

Image.MAX_IMAGE_PIXELS = 40_000_000
ALLOWED_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}


class ImageRejected(ValueError):
    pass


def _dct_matrix(n: int) -> np.ndarray:
    k = np.arange(n)[:, None]
    i = np.arange(n)[None, :]
    m = np.cos(np.pi * (2 * i + 1) * k / (2 * n)) * np.sqrt(2 / n)
    m[0] /= np.sqrt(2)
    return m


_DCT32 = _dct_matrix(32)


def phash(img: Image.Image) -> str:
    g = img.convert("L").resize((32, 32), Image.Resampling.LANCZOS)
    a = np.asarray(g, dtype=np.float64)
    d = _DCT32 @ a @ _DCT32.T
    low = d[:8, :8].flatten()
    med = np.median(low[1:])
    bits = (low > med).astype(np.uint8)
    return f"{int(''.join(map(str, bits)), 2):016x}"


def hamming(h1: str, h2: str) -> int:
    return bin(int(h1, 16) ^ int(h2, 16)).count("1")


def _gps_to_deg(vals, ref) -> float | None:
    try:
        d, m, s = [float(x) for x in vals]
        deg = d + m / 60 + s / 3600
        return -deg if ref in ("S", "W") else deg
    except Exception:
        return None


def read_exif(img: Image.Image) -> dict:
    out: dict = {"has_exif": False}
    try:
        exif = img.getexif()
    except Exception:
        return out
    if not exif:
        return out
    tags = {ExifTags.TAGS.get(k, k): v for k, v in exif.items()}
    sub = exif.get_ifd(0x8769) if hasattr(exif, "get_ifd") else {}
    for k, v in sub.items():
        tags[ExifTags.TAGS.get(k, k)] = v
    dt = tags.get("DateTimeOriginal") or tags.get("DateTime")
    if dt:
        try:
            out["captured_at"] = datetime.strptime(str(dt), "%Y:%m:%d %H:%M:%S").isoformat()
        except ValueError:
            pass
    if tags.get("Make") or tags.get("Model"):
        out["device"] = f"{tags.get('Make', '')} {tags.get('Model', '')}".strip()
    try:
        gps = exif.get_ifd(0x8825)
        if gps:
            lat = _gps_to_deg(gps.get(2), gps.get(1))
            lng = _gps_to_deg(gps.get(4), gps.get(3))
            if lat is not None and lng is not None:
                out["gps"] = {"lat": round(lat, 6), "lng": round(lng, 6)}
    except Exception:
        pass
    out["has_exif"] = bool(out.keys() - {"has_exif"})
    return out


# ---------------- graphic screen ----------------
class GraphicScorer(Protocol):
    name: str

    def score(self, img: Image.Image) -> tuple[float, list[str]]: ...


class ColourHeuristicScorer:
    """Coarse screen: share of blood-like red and skin-tone pixels, weighted toward red."""
    name = "colour-heuristic-v1"

    def score(self, img: Image.Image) -> tuple[float, list[str]]:
        small = img.convert("RGB").resize((96, 96))
        hsv = np.asarray(small.convert("HSV"), dtype=np.float32) / 255.0
        h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
        red = ((h < 0.03) | (h > 0.96)) & (s > 0.55) & (v > 0.15) & (v < 0.75)
        ycc = np.asarray(small.convert("YCbCr"), dtype=np.float32)
        skin = (ycc[..., 1] > 85) & (ycc[..., 1] < 125) & (ycc[..., 2] > 140) & (ycc[..., 2] < 175) & (v > 0.25)
        red_r, skin_r = float(red.mean()), float(skin.mean())
        score = min(1.0, 3.2 * red_r + 0.45 * skin_r * (1.0 if red_r > 0.01 else 0.3))
        reasons = []
        if red_r > 0.06:
            reasons.append(f"large dark-red area ({red_r:.0%} of image)")
        if skin_r > 0.25 and red_r > 0.01:
            reasons.append(f"skin-tone area with red regions ({skin_r:.0%} / {red_r:.0%})")
        return round(score, 3), reasons


_scorer: GraphicScorer = ColourHeuristicScorer()


def set_graphic_scorer(s: GraphicScorer) -> None:
    global _scorer
    _scorer = s


def blur_preview(img: Image.Image, max_side: int = 480) -> bytes:
    im = ImageOps.exif_transpose(img).convert("RGB")
    im.thumbnail((max_side, max_side))
    radius = max(8, max(im.size) // 14)
    im = im.filter(ImageFilter.GaussianBlur(radius))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=40)  # re-encode: drops EXIF and original detail
    return buf.getvalue()


@dataclass
class ImageAnalysis:
    mime: str
    width: int
    height: int
    size_bytes: int
    sha256: str
    phash: str
    exif: dict
    graphic_score: float
    graphic_reasons: list[str]
    sharpness: float
    scorer: str

    def as_dict(self) -> dict:
        return self.__dict__.copy()


def analyze_image(data: bytes, max_bytes: int) -> tuple[ImageAnalysis, Image.Image]:
    if len(data) > max_bytes:
        raise ImageRejected(f"Image exceeds {max_bytes // (1024 * 1024)} MB limit")
    try:
        probe = Image.open(io.BytesIO(data))
        fmt = probe.format
        probe.verify()
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception:
        raise ImageRejected("File is not a readable image")
    if fmt not in ALLOWED_FORMATS:
        raise ImageRejected("Only JPEG, PNG or WebP images are accepted")
    gray = np.asarray(img.convert("L").resize((128, 128)), dtype=np.float64)
    lap = gray[1:-1, 1:-1] * 4 - gray[:-2, 1:-1] - gray[2:, 1:-1] - gray[1:-1, :-2] - gray[1:-1, 2:]
    score, reasons = _scorer.score(img)
    return ImageAnalysis(
        mime=ALLOWED_FORMATS[fmt], width=img.width, height=img.height, size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(), phash=phash(img), exif=read_exif(img),
        graphic_score=score, graphic_reasons=reasons, sharpness=round(float(lap.var()), 1),
        scorer=_scorer.name,
    ), img
