#!/usr/bin/env python3
"""Generate 5 Kling v3 I2V clips from Christmas stills, then assemble a 1080x1920 Reel."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path("/workspace")
SOURCE = ROOT / "source"
GENERATED = ROOT / "generated"
FINAL = ROOT / "final"
LOG = ROOT / "generated" / "generation_log.json"

TOKEN = os.environ.get("REPLICATE_API_TOKEN") or ""
MODEL = "kwaivgi/kling-v3-video"
DURATION = 5
MODE = "pro"

NEG = (
    "slideshow, Ken Burns, camera-only motion, fake parallax, morphing, warped architecture, "
    "melting objects, duplicated objects, extra limbs, extra fingers, bad hands, broken faces, "
    "changing faces, mutated animals, duplicated antlers, deformed train, bending railway, "
    "flickering geometry, AI shimmer, temporal instability, text mutation, random letters, "
    "watermark, overexposure, excessive bloom, muddy image, soft output, extreme motion blur, "
    "plastic textures, oversharpening, jerky camera, fast zoom, cartoon, uncanny valley, "
    "distorted windows, melting snow, identity drift, deformed reindeer"
)

CLIPS = [
    {
        "id": "clip_01_train_raw",
        "image": SOURCE / "alpine_valley_polar_express_at_christmas_1080x1920.png",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas movie opening. The white luxury Polar Express "
            "locomotive stays exactly as in the first frame: same design, rails, station, mountains. "
            "The train eases slowly forward along the tracks toward camera with smooth mechanical motion. "
            "Soft steam drifts from the locomotive. Natural snowfall. Cabin windows shimmer with warm light. "
            "Lantern flames flicker. Gold reflections travel across polished metal. "
            "Very slow cinematic camera push-in with a tiny side drift. Keep geometry sharp. "
            "Do not change train shape, wheels, windows, or signage. Subdue any text rather than distort it."
        ),
        "safer": (
            "Subtle photoreal image-to-video of this exact Christmas train station. Gentle snowfall, "
            "soft locomotive steam, flickering lanterns, warm window glow. Very slow camera push-in. "
            "Train remains sharp and undistorted. Minimal subject change."
        ),
    },
    {
        "id": "clip_02_santa_raw",
        "image": SOURCE / "santa_s_moonlit_christmas_sleigh_ride_1080x1920.png",
        "prompt": (
            "Photoreal luxury Christmas film. Keep Santa's face, beard, hands, clothing, sleigh, and "
            "reindeer anatomy identical to the first frame. Santa makes one subtle natural movement: "
            "a slight turn toward camera with a kind expression. Fur trim shifts in a cold breeze. "
            "One reindeer gently turns its head; both reindeer breathe, with faint cold breath. "
            "Lantern flames flicker. Snow falls naturally. Sleigh ribbons and wreath move slightly. "
            "Warm lights sparkle. Very slow cinematic camera move. No extra fingers, no mutated antlers, "
            "no cartoon look, no uncanny face change."
        ),
        "safer": (
            "Subtle photoreal animation of this exact Santa and reindeer. Soft snowfall, flickering lanterns, "
            "fur moving in a breeze, one reindeer ear/head twitch, Santa breathing. Extremely slow camera. "
            "Preserve face, hands, beard, sleigh, and reindeer anatomy. No morphing."
        ),
    },
    {
        "id": "clip_03_market_raw",
        "image": SOURCE / "snowy_christmas_market_by_the_cathedral_1080x1920.png",
        "prompt": (
            "Photoreal European Christmas market brought to life. Architecture and cathedral stay structurally "
            "identical to the first frame. Gentle snowfall. The carousel rotates slowly. Warm market lights "
            "sparkle. Candle lanterns flicker. Distant people take a few slow steps only if they stay sharp. "
            "Steam rises from hot chocolate. Subtle reflections on wet cobblestones. Slow cinematic forward "
            "glide down the street. Prioritize carousel, snow, steam, and lighting over crowd motion. "
            "Keep the cathedral stable and crisp."
        ),
        "safer": (
            "Subtle photoreal animation of this exact Christmas market. Snowfall, slow carousel rotation, "
            "flickering candles, steam, twinkling lights, slow forward camera glide. Keep architecture sharp. "
            "Minimal people motion. No morphing cathedral."
        ),
    },
    {
        "id": "clip_04_chalet_raw",
        "image": SOURCE / "snowy_christmas_chalet_at_twilight_1080x1920.png",
        "prompt": (
            "Photoreal high-end winter resort commercial. Keep doors, windows, roof, stairs, and railings "
            "identical to the first frame. Natural snowfall with clear snow texture. Outdoor Christmas lights "
            "twinkle. Candle lanterns flicker. Chimney smoke rises. Tree branches sway slightly in a cold breeze. "
            "Warm interior lights breathe gently. Slow cinematic push toward the entrance. Luxury, real, sharp."
        ),
        "safer": (
            "Subtle photoreal animation of this exact luxury chalet. Snowfall, twinkling lights, flickering "
            "lanterns, chimney smoke, slight tree movement, slow push-in. Do not distort architecture."
        ),
    },
    {
        "id": "clip_05_cozy_raw",
        "image": SOURCE / "cozy_christmas_reading_nook_by_snowy_village_1080x1920.png",
        "prompt": (
            "Photoreal emotional Christmas Eve close. Keep cat anatomy, mug shape, book, blankets, and village "
            "architecture identical to the first frame. Snow falls outside. Distant village lights shimmer. "
            "River reflections drift. Candle flames flicker. Christmas lights twinkle. Hot chocolate steam rises. "
            "The cat breathes softly and may blink once. Extremely slow cinematic push-in. Warm, safe, nostalgic. "
            "The cat must not walk or stand up."
        ),
        "safer": (
            "Subtle photoreal animation of this exact cozy window scene. Snow outside, candle flicker, steam "
            "from mug, cat breathing only, twinkling lights, slow push-in. Do not move the cat's body. "
            "Keep mug, book, and village stable."
        ),
    },
]


def api(method: str, url: str, data: dict | None = None, timeout: int = 120) -> dict:
    body = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "cursor-reel/1.0",
        },
    )
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            if e.code == 429:
                retry_after = 12
                try:
                    payload = json.loads(err)
                    retry_after = int(payload.get("retry_after") or 12) + 2
                except Exception:
                    pass
                print(f"  429 throttled, waiting {retry_after}s...", flush=True)
                time.sleep(retry_after)
                continue
            raise RuntimeError(f"{method} {url} -> {e.code} {err[:800]}") from e
    raise RuntimeError(f"{method} {url} still throttled after retries")


def upload_file(path: Path) -> str:
    boundary = "----CursorReelBoundary"
    data = path.read_bytes()
    parts = []
    parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"content\"; filename=\"{path.name}\"\r\nContent-Type: image/png\r\n\r\n".encode())
    parts.append(data)
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    body = b"".join(parts)
    req = urllib.request.Request(
        "https://api.replicate.com/v1/files",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        payload = json.loads(resp.read().decode())
    url = (payload.get("urls") or {}).get("get")
    if not url:
        raise RuntimeError(f"file upload missing url: {payload}")
    return url


def output_url(output) -> str | None:
    if isinstance(output, str) and output.startswith("http"):
        return output
    if isinstance(output, list):
        for item in output:
            if isinstance(item, str) and item.startswith("http"):
                return item
            if isinstance(item, dict) and isinstance(item.get("url"), str):
                return item["url"]
    if isinstance(output, dict) and isinstance(output.get("url"), str):
        return output["url"]
    return None


def create_prediction(image_url: str, prompt: str) -> dict:
    return api(
        "POST",
        f"https://api.replicate.com/v1/models/{MODEL}/predictions",
        {
            "input": {
                "prompt": prompt,
                "start_image": image_url,
                "mode": MODE,
                "duration": DURATION,
                "generate_audio": False,
                "negative_prompt": NEG,
            }
        },
    )


def poll(pred_id: str, timeout_s: int = 900) -> dict:
    start = time.time()
    current: dict = {"id": pred_id, "status": "starting"}
    while time.time() - start < timeout_s:
        current = api("GET", f"https://api.replicate.com/v1/predictions/{pred_id}")
        status = str(current.get("status"))
        print(f"  {pred_id} {status}", flush=True)
        if status in {"succeeded", "failed", "canceled"}:
            return current
        time.sleep(8)
    raise TimeoutError(f"prediction {pred_id} timed out")


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "cursor-reel/1.0"})
    with urllib.request.urlopen(req, timeout=180) as resp, dest.open("wb") as f:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            f.write(chunk)


def ffprobe(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,avg_frame_rate,duration",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(path),
        ]
    )
    return json.loads(raw)


def estimate_cost(pred: dict) -> float | None:
    metrics = pred.get("metrics") or {}
    for key in ("cost", "predict_cost", "total_cost"):
        if key in metrics:
            try:
                return float(metrics[key])
            except (TypeError, ValueError):
                pass
    logs = str(pred.get("logs") or "")
    # Kling official-ish: leave None if unknown
    return None


def main() -> int:
    if not TOKEN:
        print("REPLICATE_API_TOKEN missing", file=sys.stderr)
        return 1
    GENERATED.mkdir(parents=True, exist_ok=True)
    FINAL.mkdir(parents=True, exist_ok=True)

    print("MODEL SELECTED: kwaivgi/kling-v3-video (mode=pro, generate_audio=false)")
    print("RESOLUTION: native 1080p (source image 1080x1920, 9:16)")
    print("DURATION PER CLIP: 5 seconds (edit will keep strongest ~2.5s)")
    print("ESTIMATED COST PER CLIP: ~$0.35–$0.70 (Kling 3 Pro 1080p ~5s)")
    print("ESTIMATED TOTAL COST: ~$1.75–$3.50 for 5 clips; up to ~$4.20 with 1 regen")
    print("Budget is reasonable — continuing generation.", flush=True)

    uploads = {}
    for clip in CLIPS:
        print(f"Uploading {clip['image'].name}...", flush=True)
        uploads[clip["id"]] = upload_file(clip["image"])
        print(f"  -> {uploads[clip['id']]}", flush=True)

    existing = {
        "clip_01_train_raw": os.environ.get("EXISTING_PRED_CLIP_01"),
    }
    preds = []
    for clip in CLIPS:
        existing_id = existing.get(clip["id"])
        if existing_id:
            print(f"Resuming {clip['id']} as {existing_id}", flush=True)
            pred = {"id": existing_id, "status": "starting"}
        else:
            print(f"Creating {clip['id']}...", flush=True)
            pred = create_prediction(uploads[clip["id"]], clip["prompt"])
            print(f"  id={pred.get('id')} status={pred.get('status')}", flush=True)
            time.sleep(12)
        preds.append({"clip": clip, "pred": pred, "regen": False})

    log = {
        "model": MODEL,
        "mode": MODE,
        "duration": DURATION,
        "clips": [],
    }

    for item in preds:
        clip = item["clip"]
        pred = item["pred"]
        pred_id = str(pred.get("id"))
        print(f"Polling {clip['id']} {pred_id}...", flush=True)
        done = poll(pred_id)
        if str(done.get("status")) != "succeeded":
            print(f"FAILED {clip['id']}: {done.get('error')}", flush=True)
            print("Regenerating once with safer prompt...", flush=True)
            pred2 = create_prediction(uploads[clip["id"]], clip["safer"])
            done = poll(str(pred2.get("id")))
            item["regen"] = True
            if str(done.get("status")) != "succeeded":
                raise RuntimeError(f"{clip['id']} failed twice: {done.get('error')}")
        url = output_url(done.get("output"))
        if not url:
            raise RuntimeError(f"{clip['id']} missing output: {done.get('output')}")
        dest = GENERATED / f"{clip['id']}.mp4"
        print(f"Downloading {url} -> {dest}", flush=True)
        download(url, dest)
        probe = ffprobe(dest)
        cost = estimate_cost(done)
        entry = {
            "id": clip["id"],
            "prediction_id": done.get("id"),
            "status": done.get("status"),
            "output_url": url,
            "file": str(dest),
            "probe": probe,
            "metrics": done.get("metrics"),
            "cost": cost,
            "regen": item["regen"],
            "error": done.get("error"),
        }
        log["clips"].append(entry)
        LOG.write_text(json.dumps(log, indent=2))
        print(json.dumps(entry, indent=2)[:1200], flush=True)

    print("All clips generated.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
