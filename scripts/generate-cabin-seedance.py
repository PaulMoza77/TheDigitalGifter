#!/usr/bin/env python3
"""Generate a photoreal 5s Christmas cabin loop via Replicate Seedance.

Uses curl for Replicate HTTP (urllib can hit Cloudflare 1010 from some agents).
Requires: REPLICATE_API_TOKEN
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = ROOT / "public/christmas/cabin-hero-seedance-source.jpg"
FALLBACK_SRC = ROOT / "public/christmas/cabin-hero-1920.jpg"
OUT = ROOT / "public/christmas/cabin-hero-loop.mp4"
OUT720 = ROOT / "public/christmas/cabin-hero-loop-720.mp4"
MODEL = os.environ.get("CHRISTMAS_VIDEO_MODEL", "bytedance/seedance-1-pro-fast")
UA = "Mozilla/5.0 (compatible; TDG-CabinLoop/1.0)"

PROMPT = (
    "Ultra-realistic living photograph of this exact Christmas mountain cabin interior. "
    "Camera completely fixed, no pan, no zoom, no Ken Burns. "
    "Through the panoramic windows: gentle continuous snowfall over snowy pines and mountains, "
    "outdoor deck fire pit flames flickering naturally. "
    "Indoor stone fireplace: realistic dancing orange flames and soft rising embers. "
    "Coffee-table and mantel candle flames flicker subtly. "
    "Warm fairy lights on the Christmas tree and mantel garland twinkle softly and feel alive. "
    "Preserve exact room layout, furniture, and composition. "
    "No text, no UI, no people, no morphing, cinematic HDR, seamless 5-second loop feel."
)


def token() -> str:
    t = (os.environ.get("REPLICATE_API_TOKEN") or "").strip()
    if not t:
        raise SystemExit("REPLICATE_API_TOKEN is required")
    return t


def curl_json(args: list[str]) -> dict:
    raw = subprocess.check_output(args, text=True)
    return json.loads(raw)


def upload_file(path: Path) -> str:
    data = curl_json(
        [
            "curl",
            "-fsS",
            "-X",
            "POST",
            "https://api.replicate.com/v1/files",
            "-H",
            f"Authorization: Bearer {token()}",
            "-H",
            f"User-Agent: {UA}",
            "-F",
            f"content=@{path};type=image/jpeg",
        ]
    )
    url = (data.get("urls") or {}).get("get") or data.get("url") or ""
    if not url:
        raise SystemExit(f"File upload failed: {data}")
    return str(url)


def output_url(pred: dict) -> str:
    out = pred.get("output")
    if isinstance(out, str) and out.startswith("http"):
        return out
    if isinstance(out, list):
        for item in out:
            if isinstance(item, str) and item.startswith("http"):
                return item
    if isinstance(out, dict) and isinstance(out.get("url"), str):
        return out["url"]
    return ""


def encode_variants(src: Path) -> None:
    tmp = src.with_suffix(".norm.mp4")
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-movflags",
            "+faststart",
            "-an",
            str(tmp),
        ]
    )
    tmp.replace(src)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-vf",
            "scale=1280:720",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "medium",
            "-crf",
            "20",
            "-movflags",
            "+faststart",
            "-an",
            str(OUT720),
        ]
    )


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.exists():
        src = FALLBACK_SRC
    if not src.exists():
        raise SystemExit(f"Missing source image: {src}")

    print(f"source={src} size={src.stat().st_size}", flush=True)
    image_url = upload_file(src)
    print(f"uploaded={image_url}", flush=True)

    payload = {
        "input": {
            "prompt": PROMPT,
            "image": image_url,
            "duration": 5,
            "resolution": "1080p",
            "camera_fixed": True,
            "fps": 24,
        }
    }
    print(f"creating model={MODEL}", flush=True)
    pred = curl_json(
        [
            "curl",
            "-fsS",
            "-X",
            "POST",
            f"https://api.replicate.com/v1/models/{MODEL}/predictions",
            "-H",
            f"Authorization: Bearer {token()}",
            "-H",
            "Content-Type: application/json",
            "-H",
            f"User-Agent: {UA}",
            "-H",
            "Prefer: wait",
            "-d",
            json.dumps(payload),
        ]
    )
    pred_id = pred.get("id", "")
    status = pred.get("status", "")
    print(f"prediction={pred_id} status={status}", flush=True)

    for i in range(120):
        if status in {"succeeded", "failed", "canceled"}:
            break
        time.sleep(3)
        pred = curl_json(
            [
                "curl",
                "-fsS",
                f"https://api.replicate.com/v1/predictions/{pred_id}",
                "-H",
                f"Authorization: Bearer {token()}",
                "-H",
                f"User-Agent: {UA}",
            ]
        )
        status = pred.get("status", "")
        print(f"poll[{i}] status={status}", flush=True)

    if status != "succeeded":
        raise SystemExit(f"Seedance failed: {json.dumps(pred)[:2000]}")

    url = output_url(pred)
    if not url:
        raise SystemExit(f"No output URL: {pred}")
    print(f"downloading {url}", flush=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["curl", "-fsSL", "-H", f"User-Agent: {UA}", "-o", str(OUT), url]
    )
    encode_variants(OUT)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes) and {OUT720}", flush=True)


if __name__ == "__main__":
    main()
