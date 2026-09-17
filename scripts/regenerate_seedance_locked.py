#!/usr/bin/env python3
"""Regenerate locked-camera 1080p I2V clips with Seedance 1 Pro (first=last frame)."""

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
TOKEN = os.environ.get("REPLICATE_API_TOKEN") or ""
MODEL = "bytedance/seedance-1-pro"
DURATION = 5
NEG_HINT = (
    "heavy snowfall, dense snow, blizzard, aggressive camera move, zoom, handheld shake, "
    "morphing, warped architecture, extra limbs, mutated animals, text mutation, watermark, "
    "soft focus, motion blur, oversharpening, busy particle effects"
)

CLIPS = [
    {
        "id": "clip_01_train_raw",
        "image": SOURCE / "alpine_valley_polar_express_at_christmas_1080x1920.png",
        "prompt": (
            "Locked tripod camera. Photoreal. Preserve the exact original photograph, razor-sharp detail. "
            "The white Christmas train stays in place on the rails. Tiny locomotive steam only. "
            "Very sparse gentle snowflakes. Lantern flames flicker softly. Cabin lights shimmer slightly. "
            "No camera move, no zoom, no orbit. Keep train, rails, mountains, and station perfectly stable."
        ),
    },
    {
        "id": "clip_02_santa_raw",
        "image": SOURCE / "santa_s_moonlit_christmas_sleigh_ride_1080x1920.png",
        "prompt": (
            "Locked tripod camera. Photoreal. Preserve Santa's face, beard, hands, coat, sleigh, and reindeer exactly. "
            "Santa breathes; fur trim moves in a faint breeze. One reindeer ear twitches. Lanterns flicker. "
            "Very sparse snow. No head turn, no walk, no camera move, no zoom. Keep anatomy perfect."
        ),
    },
    {
        "id": "clip_03_market_raw",
        "image": SOURCE / "snowy_christmas_market_by_the_cathedral_1080x1920.png",
        "prompt": (
            "Locked tripod camera. Photoreal. Keep cathedral and architecture perfectly sharp and unchanged. "
            "Carousel rotates very slowly. Candle flames flicker. Faint steam from hot chocolate. "
            "Very sparse snow. Distant people stay almost still. No camera dolly, no zoom."
        ),
    },
    {
        "id": "clip_04_chalet_raw",
        "image": SOURCE / "snowy_christmas_chalet_at_twilight_1080x1920.png",
        "prompt": (
            "Locked tripod camera. Photoreal. Keep doors, windows, roof, stairs unchanged and sharp. "
            "Chimney smoke rises slowly. Lanterns flicker. Christmas lights twinkle faintly. "
            "Very sparse snow. Tiny tree-branch movement. No camera push-in, no zoom."
        ),
    },
    {
        "id": "clip_05_cozy_raw",
        "image": SOURCE / "cozy_christmas_reading_nook_by_snowy_village_1080x1920.png",
        "prompt": (
            "Locked tripod camera. Photoreal. Keep cat, mug, book, blankets, and village perfectly stable. "
            "Cat breathes only. Candle flames flicker. Faint hot-chocolate steam. Water reflections drift slowly. "
            "Very sparse snow outside. No camera push-in, no zoom, cat does not walk."
        ),
    },
]


def api(method: str, url: str, data: dict | None = None, timeout: int = 180) -> dict:
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
    for _ in range(8):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            if e.code == 429:
                retry_after = 12
                try:
                    retry_after = int(json.loads(err).get("retry_after") or 12) + 2
                except Exception:
                    pass
                print(f"  429 waiting {retry_after}s", flush=True)
                time.sleep(retry_after)
                continue
            raise RuntimeError(f"{method} {url} -> {e.code} {err[:800]}") from e
    raise RuntimeError("still throttled")


def upload_file(path: Path) -> str:
    boundary = "----CursorReelBoundary"
    data = path.read_bytes()
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"content\"; filename=\"{path.name}\"\r\nContent-Type: image/png\r\n\r\n".encode()
        + data
        + f"\r\n--{boundary}--\r\n".encode()
    )
    req = urllib.request.Request(
        "https://api.replicate.com/v1/files",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "cursor-reel/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        payload = json.loads(resp.read().decode())
    url = (payload.get("urls") or {}).get("get")
    if not url:
        raise RuntimeError(f"upload missing url: {payload}")
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


def poll(pred_id: str, timeout_s: int = 900) -> dict:
    start = time.time()
    while time.time() - start < timeout_s:
        current = api("GET", f"https://api.replicate.com/v1/predictions/{pred_id}")
        status = str(current.get("status"))
        print(f"  {pred_id} {status}", flush=True)
        if status in {"succeeded", "failed", "canceled"}:
            return current
        time.sleep(8)
    raise TimeoutError(pred_id)


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "cursor-reel/1.0"})
    with urllib.request.urlopen(req, timeout=180) as resp, dest.open("wb") as f:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            f.write(chunk)


def ffprobe_wh(path: Path) -> tuple[int, int]:
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
            "csv=p=0",
            str(path),
        ]
    )
    w, h = raw.decode().strip().split(",")
    return int(w), int(h)


def main() -> int:
    if not TOKEN:
        print("missing REPLICATE_API_TOKEN", file=sys.stderr)
        return 1
    print("MODEL SELECTED: bytedance/seedance-1-pro")
    print("RESOLUTION: 1080p, camera_fixed=true, fps=24")
    print("DURATION PER CLIP: 5 seconds")
    print("ESTIMATED COST PER CLIP: ~$0.15–$0.50 (Seedance 1 Pro 1080p 5s)")
    print("ESTIMATED TOTAL COST: ~$0.75–$2.50", flush=True)

    uploads = {}
    for clip in CLIPS:
        print(f"Uploading {clip['image'].name}", flush=True)
        uploads[clip["id"]] = upload_file(clip["image"])

    created = []
    for clip in CLIPS:
        print(f"Creating {clip['id']}", flush=True)
        pred = api(
            "POST",
            f"https://api.replicate.com/v1/models/{MODEL}/predictions",
            {
                "input": {
                    "prompt": clip["prompt"] + " Negative: " + NEG_HINT,
                    "image": uploads[clip["id"]],
                    "last_frame_image": uploads[clip["id"]],
                    "duration": DURATION,
                    "resolution": "1080p",
                    "fps": 24,
                    "camera_fixed": True,
                    "aspect_ratio": "9:16",
                }
            },
        )
        print("  id", pred.get("id"), pred.get("status"), flush=True)
        created.append((clip, pred))
        time.sleep(12)

    log = {"model": MODEL, "clips": []}
    for clip, pred in created:
        done = poll(str(pred.get("id")))
        if str(done.get("status")) != "succeeded":
            raise RuntimeError(f"{clip['id']} failed: {done.get('error')}")
        url = output_url(done.get("output"))
        if not url:
            raise RuntimeError(f"{clip['id']} no output")
        dest = GENERATED / f"{clip['id']}_seedance.mp4"
        download(url, dest)
        w, h = ffprobe_wh(dest)
        print(f"DOWNLOADED {dest.name} {w}x{h}", flush=True)
        log["clips"].append(
            {
                "id": clip["id"],
                "prediction_id": done.get("id"),
                "file": str(dest),
                "width": w,
                "height": h,
                "metrics": done.get("metrics"),
                "output_url": url,
            }
        )
        (GENERATED / "generation_log_seedance.json").write_text(json.dumps(log, indent=2))
        if w != 1080 or h != 1920:
            print(f"WARN {clip['id']} is {w}x{h}, export step will upscale to 1080x1920", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
