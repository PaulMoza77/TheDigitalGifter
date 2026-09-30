#!/usr/bin/env python3
"""Generate VoloCar Dubai Moments stills 02–06 (16:9 Recraft). Does not touch 01."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HIGGSFIELD_API_BASE = "https://api.higgsfield.ai"
IMAGE_MODEL = "recraft/v4.1/pro/text-to-image"
BUDGET_USD = 3.0
MAX_RETRIES_PER_CONCEPT = 1

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
MASTERS = ROOT / "public" / "assets" / "volocar" / "dubai-moments" / "masters"
MANIFEST = ROOT / "public" / "assets" / "volocar" / "dubai-moments" / "generation_manifest.json"

CONCEPTS = [
    {
        "id": "02_volocar_dubai_moments_girls_night",
        "sequence": 2,
        "concept": "Girls' Night",
        "filename": "02_volocar_dubai_moments_girls_night.jpg",
        "prompt": (
            "Ultra photorealistic 16:9 cinematic photograph, blue hour into night on a recognisable premium Dubai "
            "boulevard with Downtown towers and warm street life visible. A red Ford Mustang convertible with roof down "
            "drives naturally; four adult female friends seated correctly — driver looking at the road, passengers "
            "interacting candidly (one may hold hair in wind, one laughing toward a friend). Not fashion models, not "
            "posing at camera, no arms raised in unison, no champagne, no nightclub cliché. Camera feels like an "
            "exceptional real photo from another moving car or roadside — slight motion, natural depth. Correct Mustang "
            "geometry, windshield, steering wheel, four occupants only. Natural skin, hands, fingers, eyes. No text, "
            "logos, watermark."
        ),
    },
    {
        "id": "03_volocar_dubai_moments_the_arrival",
        "sequence": 3,
        "concept": "The Arrival",
        "filename": "03_volocar_dubai_moments_the_arrival.jpg",
        "prompt": (
            "Ultra photorealistic 16:9 evening photograph at the entrance of a luxurious believable Dubai hotel. "
            "Contemporary Rolls-Royce just arrived; professional valet opens rear passenger door; stylish adult woman "
            "naturally stepping out, adult partner nearby; optional staff in background. Observed documentary feeling, "
            "warm architectural lighting, subtle activity. No red carpet, paparazzi, champagne, keys to camera, or staged "
            "wealth clichés. Correct door geometry, hands, feet, faces, vehicle proportions. No text or logos."
        ),
    },
    {
        "id": "04_volocar_dubai_moments_morning_escape",
        "sequence": 4,
        "concept": "Morning Escape",
        "filename": "04_volocar_dubai_moments_morning_escape.jpg",
        "prompt": (
            "Ultra photorealistic 16:9 sunrise photograph, early Dubai morning. Beautiful convertible supercar on an open "
            "road toward desert; distant city skyline plausible on horizon. Vehicle smaller in frame — space, sky, and road "
            "are heroes. Warm low sunlight, long natural shadows, quiet atmosphere. Gentle cruising speed, no drift, "
            "no smoke, no ad-style giant car fill. Experience of freedom before the city wakes. No text or watermark."
        ),
    },
    {
        "id": "05_volocar_dubai_moments_marina_night",
        "sequence": 5,
        "concept": "Marina Night",
        "filename": "05_volocar_dubai_moments_marina_night.jpg",
        "prompt": (
            "Ultra photorealistic 16:9 night photograph, Dubai Marina / JBR. Elegant luxury grand-tourer convertible "
            "(Bentley Continental GT class feeling, not Lamborghini). Yachts, water reflections, restaurants, architecture, "
            "a few pedestrians — active but not chaotic. Car moving through or arriving naturally; no woman posing beside "
            "static car, no empty fake marina, no cyberpunk neon. Sophisticated dinner-out mood. No text or logos."
        ),
    },
    {
        "id": "06_volocar_dubai_moments_arrival_dubai",
        "sequence": 6,
        "concept": "Arrival in Dubai",
        "filename": "06_volocar_dubai_moments_arrival_dubai.jpg",
        "prompt": (
            "Ultra photorealistic 16:9 photograph, start of a Dubai trip at a plausible premium airport curbside / "
            "arrivals area (DXB-associated but physically sensible). Traveller with tasteful luggage approaches a waiting "
            "luxury SUV; driver/host assists with bags naturally. Distant aircraft or terminal architecture ok; NOT on "
            "taxiway or apron. No handshake, no key presentation, no looking at camera, no private-jet cliché unless "
            "physically plausible. Effortless premium service mood. No text or watermark."
        ),
    },
]


def try_load_hf_from_mozas_vps() -> None:
    if (os.environ.get("HF_CREDENTIALS") or "").strip():
        return
    loader = ROOT / "scripts" / "_load_hf_credentials.sh"
    if not (os.environ.get("MOZAS_SSH_HOST") and os.environ.get("MOZAS_SSH_PRIVATE_KEY") and loader.exists()):
        return
    proc = subprocess.run(["bash", str(loader)], capture_output=True, text=True, check=False)
    val = (proc.stdout or "").strip()
    if proc.returncode == 0 and val and ":" in val:
        os.environ["HF_CREDENTIALS"] = val


def auth_header() -> str:
    try_load_hf_from_mozas_vps()
    combined = (os.environ.get("HF_CREDENTIALS") or "").strip()
    if ":" not in combined:
        print("BLOCKED: Higgsfield credentials missing.", file=sys.stderr)
        raise SystemExit(2)
    key_id, secret = combined.split(":", 1)
    return f"Key {key_id.strip()}:{secret.strip()}"


def hf_json(method: str, path: str, body: dict | None = None, timeout: int = 180) -> dict:
    url = f"{HIGGSFIELD_API_BASE}{path}"
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "Authorization": auth_header(),
        "Accept": "application/json",
        "User-Agent": "tdg-volocar-dubai-moments-stills/higgsfield",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"{method} {path} -> {e.code} {err[:800]}") from e


def poll_request(request_id: str, max_attempts: int = 90, sleep_s: float = 4.0) -> dict:
    for _ in range(max_attempts):
        body = hf_json("GET", f"/requests/{request_id}/status")
        status = str(body.get("status") or "").lower()
        if status in {"completed", "succeeded", "success"}:
            return body
        if status in {"failed", "error", "cancelled"}:
            raise RuntimeError(f"job {request_id} failed: {body}")
        time.sleep(sleep_s)
    raise TimeoutError(f"job {request_id} timed out")


def image_url_from_status(body: dict) -> str | None:
    images = body.get("images")
    if isinstance(images, list):
        for item in images:
            if isinstance(item, dict) and isinstance(item.get("url"), str):
                return item["url"]
            if isinstance(item, str) and item.startswith("http"):
                return item
    if isinstance(body.get("image_url"), str):
        return body["image_url"]
    return None


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-volocar-dubai-moments-stills/higgsfield"})
    with urllib.request.urlopen(req, timeout=300) as resp, dest.open("wb") as f:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            f.write(chunk)


def image_dimensions(path: Path) -> tuple[int, int]:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0:s=x",
            str(path),
        ]
    )
    w, h = raw.decode().strip().split("x")
    return int(w), int(h)


def generate_one(concept: dict, attempt: int) -> dict:
    dest = MASTERS / concept["filename"]
    est = float(hf_json("POST", f"/estimate/{IMAGE_MODEL}", {"prompt": concept["prompt"], "aspect_ratio": "16:9"})["usd"])
    print(f"  estimate ${est:.4f} attempt={attempt}", flush=True)
    sub = hf_json("POST", f"/{IMAGE_MODEL}", {"prompt": concept["prompt"], "aspect_ratio": "16:9"})
    request_id = str(sub.get("request_id") or "")
    if not request_id:
        raise RuntimeError(f"submit failed: {sub}")
    done = poll_request(request_id)
    url = image_url_from_status(done)
    if not url:
        raise RuntimeError("missing image url")
    download(url, dest)
    w, h = image_dimensions(dest)
    ratio = round(w / h, 4) if h else 0
    return {
        "id": concept["id"],
        "sequence_number": concept["sequence"],
        "concept": concept["concept"],
        "path": str(dest),
        "filename": concept["filename"],
        "model": IMAGE_MODEL,
        "job_id": request_id,
        "generation_cost_usd": est,
        "attempt": attempt,
        "width": w,
        "height": h,
        "aspect_ratio": "16:9",
        "aspect_ratio_actual": ratio,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "provider": "higgsfield",
        "asset_type": "product_ui_image",
        "project": "volocar",
        "collection": "dubai_moments",
        "qc_status": "pending_human",
        "approved": False,
    }


def main() -> int:
    auth_header()
    MASTERS.mkdir(parents=True, exist_ok=True)

    manifest: dict = {"concepts": [], "total_new_usd": 0.0, "retries": 0}
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text())

    total = 0.0
    for concept in CONCEPTS:
        dest = MASTERS / concept["filename"]
        if dest.exists() and dest.stat().st_size > 100_000:
            print(f"SKIP existing {concept['id']}", flush=True)
            continue
        print(f"GENERATE {concept['id']}", flush=True)
        entry = None
        for attempt in range(1 + MAX_RETRIES_PER_CONCEPT):
            try:
                if total >= BUDGET_USD:
                    raise SystemExit(f"STOP budget ${BUDGET_USD:.2f}")
                entry = generate_one(concept, attempt + 1)
                total += entry["generation_cost_usd"]
                if attempt > 0:
                    manifest["retries"] = int(manifest.get("retries") or 0) + 1
                w, h = entry["width"], entry["height"]
                if h and abs(w / h - 16 / 9) > 0.08:
                    raise RuntimeError(f"bad aspect {w}x{h}")
                break
            except Exception as exc:
                print(f"  FAIL attempt {attempt + 1}: {exc}", flush=True)
                if attempt >= MAX_RETRIES_PER_CONCEPT:
                    entry = {
                        "id": concept["id"],
                        "concept": concept["concept"],
                        "status": "FAILED",
                        "error": str(exc)[:500],
                    }
                else:
                    manifest["retries"] = int(manifest.get("retries") or 0) + 1
        if entry:
            manifest["concepts"] = [c for c in manifest.get("concepts", []) if c.get("id") != concept["id"]]
            manifest["concepts"].append(entry)

    manifest["total_new_usd"] = round(total, 4)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"DONE total_new_usd=${total:.4f} manifest={MANIFEST}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
