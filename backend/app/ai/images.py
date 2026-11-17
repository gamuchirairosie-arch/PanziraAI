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
import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol

import httpx
import numpy as np
from PIL import ExifTags, Image, ImageFilter, ImageOps

from ..config import get_settings

Image.MAX_IMAGE_PIXELS = 40_000_000
ALLOWED_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
AI_METADATA_SIGNATURES = (
    "openai",
    "midjourney",
    "dall-e",
    "dalle",
    "stable diffusion",
    "stablediffusion",
    "firefly",
    "trainedalgorithmicmedia",
)


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


def _extract_forensic_exif(img: Image.Image) -> dict:
    """Extract Camera EXIF (Make, Model, DateTimeOriginal, Software) and embedded text chunks."""
    out: dict = {
        "Make": None,
        "Model": None,
        "DateTimeOriginal": None,
        "Software": None,
        "has_camera_exif": False,
        "raw_metadata_text": "",
    }
    meta_blobs: list[str] = []
    try:
        for k, v in (img.info or {}).items():
            if isinstance(v, (str, bytes)):
                txt = v.decode("utf-8", errors="ignore") if isinstance(v, bytes) else v
                meta_blobs.append(f"{k}:{txt}")
        exif = img.getexif()
        if exif:
            tags = {ExifTags.TAGS.get(k, k): v for k, v in exif.items()}
            sub = exif.get_ifd(0x8769) if hasattr(exif, "get_ifd") else {}
            for k, v in sub.items():
                tags[ExifTags.TAGS.get(k, k)] = v
            make = str(tags.get("Make") or "").strip() or None
            model = str(tags.get("Model") or "").strip() or None
            dt_orig = str(tags.get("DateTimeOriginal") or tags.get("DateTime") or "").strip() or None
            software = str(tags.get("Software") or "").strip() or None
            out["Make"] = make
            out["Model"] = model
            out["DateTimeOriginal"] = dt_orig
            out["Software"] = software
            out["has_camera_exif"] = bool(make or model)
            for k, v in tags.items():
                if isinstance(v, (str, bytes)):
                    txt = v.decode("utf-8", errors="ignore") if isinstance(v, bytes) else v
                    meta_blobs.append(f"{k}:{txt}")
    except Exception:
        pass
    out["raw_metadata_text"] = " ".join(meta_blobs)
    return out


def _fft_screen_moire_check(img: Image.Image) -> dict:
    """Run a NumPy 2D FFT high-frequency grid/Moiré analysis to detect screen recapture."""
    gray = np.asarray(img.convert("L").resize((256, 256), Image.Resampling.BILINEAR), dtype=np.float64)
    if float(gray.std()) < 1e-3:
        return {
            "screen_moire_detected": False,
            "high_freq_energy_ratio": 0.0,
            "spectral_peak_ratio": 0.0,
        }
    centered = gray - gray.mean()
    fft2 = np.fft.fftshift(np.fft.fft2(centered))
    mag = np.abs(fft2)
    h, w = mag.shape
    cy, cx = h // 2, w // 2
    yy, xx = np.ogrid[:h, :w]
    radius = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2)

    non_dc = radius >= 1.0
    hf_mask = (radius >= 24.0) & (radius <= 122.0)
    total_energy = float((mag[non_dc] ** 2).sum()) + 1e-9
    hf_energy = float((mag[hf_mask] ** 2).sum())
    hf_ratio = round(hf_energy / total_energy, 4)

    hf_vals = mag[hf_mask]
    peak_ratio = round(float(hf_vals.max() / (hf_vals.mean() + 1e-6)), 2) if hf_vals.size else 0.0
    moire_detected = bool(peak_ratio >= 25.0 and hf_ratio >= 0.18)
    return {
        "screen_moire_detected": moire_detected,
        "high_freq_energy_ratio": hf_ratio,
        "spectral_peak_ratio": peak_ratio,
    }


def _check_sightengine_genai(image_bytes: bytes) -> dict | None:
    """Query Sightengine genai model when SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET are configured."""
    s = get_settings()
    api_user = (os.getenv("SIGHTENGINE_API_USER") or getattr(s, "sightengine_api_user", "") or "").strip()
    api_secret = (os.getenv("SIGHTENGINE_API_SECRET") or getattr(s, "sightengine_api_secret", "") or "").strip()
    if not (api_user and api_secret):
        return None
    try:
        resp = httpx.post(
            "https://api.sightengine.com/1.0/check.json",
            data={"models": "genai", "api_user": api_user, "api_secret": api_secret},
            files={"media": ("upload.jpg", image_bytes, "image/jpeg")},
            timeout=5.0,
        )
        if resp.status_code == 200:
            payload = resp.json()
            score = float((payload.get("type") or {}).get("ai_generated", 0.0))
            return {"used": True, "ai_generated_score": score, "flagged": score >= 0.5}
    except Exception:
        pass
    return None


def analyze_image_forensics(image_bytes: bytes) -> dict:
    """Automatic forensic scan run whenever an image is uploaded.

    1. Extracts Camera EXIF (Make, Model, DateTimeOriginal) via Pillow.
    2. Runs a NumPy 2D FFT high-frequency grid/Moiré check for laptop/phone screen recapture.
    3. Checks optional Sightengine `genai` API if SIGHTENGINE_API_USER & SIGHTENGINE_API_SECRET are set,
       otherwise combines C2PA/IPTC AI metadata signatures + aspect/compression heuristics.
    4. Returns structured JSON with `ai_scan_verdict`, `ai_scan_summary`, and `commercial_eligible`.
    """
    img = Image.open(io.BytesIO(image_bytes))
    img.load()
    fmt = (img.format or "UNKNOWN").upper()
    width, height = img.size

    exif_info = _extract_forensic_exif(img)
    fft_info = _fft_screen_moire_check(img)
    sightengine_info = _check_sightengine_genai(image_bytes)

    # Scan raw header/trailer bytes + EXIF/info strings for C2PA / IPTC / generator signatures
    raw_lower = image_bytes[:65536].decode("latin-1", errors="ignore").lower()
    if len(image_bytes) > 65536:
        raw_lower += " " + image_bytes[-32768:].decode("latin-1", errors="ignore").lower()
    combined_meta = f"{exif_info['raw_metadata_text'].lower()} {raw_lower}"
    matched_signatures = [sig for sig in AI_METADATA_SIGNATURES if sig in combined_meta]

    # Aspect / compression heuristic (typical unedited square 1024x1024 AI PNG output without camera EXIF)
    bytes_per_pixel = len(image_bytes) / max(1, width * height)
    synthetic_aspect_heuristic = bool(
        not exif_info["has_camera_exif"]
        and (width, height) in ((1024, 1024), (1024, 1792), (1792, 1024), (1344, 768), (768, 1344))
        and fmt in ("PNG", "WEBP")
        and bytes_per_pixel > 0.35
    )

    sightengine_flagged = bool(sightengine_info and sightengine_info.get("flagged"))
    ai_or_screen_flagged = bool(
        matched_signatures
        or sightengine_flagged
        or fft_info["screen_moire_detected"]
        or synthetic_aspect_heuristic
    )

    if ai_or_screen_flagged:
        verdict = "suspected_ai_or_screen"
        commercial_eligible = False
        reasons: list[str] = []
        if matched_signatures:
            reasons.append(f"AI/C2PA metadata signature detected ({', '.join(matched_signatures)})")
        if sightengine_flagged and sightengine_info:
            reasons.append(f"Sightengine GenAI detector score {sightengine_info['ai_generated_score']:.0%}")
        if fft_info["screen_moire_detected"]:
            reasons.append(
                f"2D FFT high-frequency screen/Moiré grid detected (peak ratio {fft_info['spectral_peak_ratio']})"
            )
        if synthetic_aspect_heuristic:
            reasons.append(f"Synthetic {width}x{height} {fmt} aspect/compression profile without camera EXIF")
        summary = "Suspected AI or screen recapture: " + "; ".join(reasons) + ". Blocked from commercial agency pool."
    elif exif_info["has_camera_exif"]:
        verdict = "authentic_camera"
        commercial_eligible = True
        device = " ".join(x for x in (exif_info["Make"], exif_info["Model"]) if x).strip()
        ts_note = f" captured {exif_info['DateTimeOriginal']}" if exif_info["DateTimeOriginal"] else ""
        summary = (
            f"Authentic camera EXIF verified ({device}{ts_note}). "
            "No AI or screen-recapture artifacts detected; human visual confirmation still required."
        )
    else:
        verdict = "metadata_stripped_unverified"
        commercial_eligible = True
        summary = (
            "Camera EXIF stripped (typical for messaging uploads). "
            "No AI metadata signatures or screen Moiré grid detected; requires mandatory human visual inspection."
        )

    return {
        "ai_scan_verdict": verdict,
        "ai_scan_summary": summary,
        "commercial_eligible": commercial_eligible,
        "exif": {
            "Make": exif_info["Make"],
            "Model": exif_info["Model"],
            "DateTimeOriginal": exif_info["DateTimeOriginal"],
            "Software": exif_info["Software"],
            "has_camera_exif": exif_info["has_camera_exif"],
        },
        "fft_moire": fft_info,
        "matched_ai_signatures": matched_signatures,
        "synthetic_aspect_heuristic": synthetic_aspect_heuristic,
        "sightengine": sightengine_info or {"used": False},
    }


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
    forensics: dict = field(default_factory=dict)

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
    forensics = analyze_image_forensics(data)
    return ImageAnalysis(
        mime=ALLOWED_FORMATS[fmt], width=img.width, height=img.height, size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(), phash=phash(img), exif=read_exif(img),
        graphic_score=score, graphic_reasons=reasons, sharpness=round(float(lap.var()), 1),
        scorer=_scorer.name, forensics=forensics,
    ), img
