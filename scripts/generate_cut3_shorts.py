#!/usr/bin/env python3
"""Generate 3 Kling v3 Pro I2V shorts for Christmas Library Cut 3."""

from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path("/workspace")
SOURCE = ROOT / "source" / "cut3"
OUT = ROOT / "public" / "assets" / "christmas" / "instagram-reel-cut3"
LOG = ROOT / "generated" / "cut3" / "generation_log.json"

TOKEN = os.environ.get("REPLICATE_API_TOKEN") or ""
MODEL = "wan-video/wan-2.2-i2v-fast"
DURATION = 5

NEG = (
    "slideshow, Ken Burns, camera-only motion, fake parallax, morphing, warped architecture, "
    "melting objects, duplicated objects, extra limbs, extra fingers, bad hands, broken faces, "
    "changing faces, identity drift, mutated children, extra people, flickering geometry, "
    "AI shimmer, temporal instability, text mutation, watermark, muddy image, plastic textures, "
    "jerky camera, fast zoom, cartoon, uncanny valley, melting ice, warped skates"
)

CLIPS = [
    {
        "id": "clip_ice_nyc",
        "image": SOURCE / "nyc_girl_ice_skating_1080x1920.png",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas night in New York. Keep the young woman, face, hair, "
            "cream sweater, red scarf, white skirt, tights, and ice skates identical to the first frame. "
            "She glides smoothly forward on the outdoor ice, one natural skating stride, scarf drifting "
            "in cold air. Snow falls. Streetlights sparkle. Empire State Building stays sharp and stable. "
            "Very slow cinematic tracking with her. Ice reflections shift. No extra limbs, no face change. "
            f"Avoid: {NEG}."
        ),
        "safer": (
            "Subtle photoreal animation of this exact ice skater in New York. Soft snowfall, twinkling lights, "
            "gentle skate glide, scarf moving slightly, slow camera. Preserve face, body, and skyline. No morphing."
        ),
    },
    {
        "id": "clip_kids_sled",
        "image": SOURCE / "village_kids_sledding_1080x1920.png",
        "prompt": (
            "Photoreal cinematic 9:16 Alpine Christmas village. Keep the three children, sleds, golden retriever, "
            "houses, lake, and mountains identical to the first frame. The children slide a little farther down the "
            "snowy lane on their sleds with joyful motion. The dog trots beside them. Chimney smoke rises. "
            "Warm window lights twinkle. Natural snowfall. Sunset sky stays. Very slow camera push-in. "
            "Preserve faces and anatomy. No extra kids, no warped sleds. "
            f"Avoid: {NEG}."
        ),
        "safer": (
            "Subtle photoreal animation of this exact sledding scene. Gentle downhill sled motion, dog walking, "
            "snowfall, chimney smoke, twinkling lights, slow push-in. Keep faces and houses sharp. No morphing."
        ),
    },
    {
        "id": "clip_prague_square",
        "image": SOURCE / "prague_old_town_carousel_market_1080x1920.png",
        "prompt": (
            "Photoreal cinematic 9:16 Prague Christmas market at dusk. Keep Tyn Church, tree, carousel, stalls, "
            "and gingerbread identical to the first frame. The carousel rotates slowly. Distant people take a few "
            "slow steps. Snow falls. Market lights twinkle. Steam rises from cocoa. Candle lanterns flicker. "
            "Slow cinematic push past the cookies into the square. Keep architecture crisp. Minimal face detail on crowd. "
            f"Avoid: {NEG}."
        ),
        "safer": (
            "Subtle photoreal animation of this exact Prague Christmas square. Slow carousel rotation, snowfall, "
            "twinkling lights, steam, flickering lanterns, slow push-in. Keep church and tree stable. Minimal people motion."
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
            "User-Agent": "cursor-reel/cut3",
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
                print(f"  429 throttled, waiting {retry_after}s...", flush=True)
                time.sleep(retry_after)
                continue
            raise RuntimeError(f"{method} {url} -> {e.code} {err[:800]}") from e
    raise RuntimeError(f"{method} {url} still throttled after retries")


def upload_file(path: Path) -> str:
    boundary = "----CursorCut3"
    data = path.read_bytes()
    parts = [
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"content\"; filename=\"{path.name}\"\r\nContent-Type: image/png\r\n\r\n".encode(),
        data,
        f"\r\n--{boundary}--\r\n".encode(),
    ]
    req = urllib.request.Request(
        "https://api.replicate.com/v1/files",
        data=b"".join(parts),
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
                "image": image_url,
                "go_fast": True,
                "num_frames": 81,
                "resolution": "480p",
                "frames_per_second": 16,
                "interpolate_output": True,
                "sample_shift": 12,
            }
        },
    )


def poll(pred_id: str, timeout_s: int = 900) -> dict:
    start = time.time()
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
    req = urllib.request.Request(url, headers={"User-Agent": "cursor-reel/cut3"})
    with urllib.request.urlopen(req, timeout=180) as resp, dest.open("wb") as f:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            f.write(chunk)


def main() -> int:
    if not TOKEN:
        print("REPLICATE_API_TOKEN missing")
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    print("MODEL wan-video/wan-2.2-i2v-fast 480p ~5s ~$0.05/clip x3", flush=True)

    uploads = {}
    for clip in CLIPS:
        print(f"Uploading {clip['image'].name}...", flush=True)
        uploads[clip["id"]] = upload_file(clip["image"])

    log: dict = {"model": MODEL, "clips": []}
    for clip in CLIPS:
        print(f"Creating {clip['id']}...", flush=True)
        pred = create_prediction(uploads[clip["id"]], clip["prompt"])
        pred_id = str(pred.get("id"))
        print(f"  id={pred_id}", flush=True)
        done = poll(pred_id)
        regen = False
        if str(done.get("status")) != "succeeded":
            print(f"FAILED {clip['id']}: {done.get('error')}; safer regen", flush=True)
            pred2 = create_prediction(uploads[clip["id"]], clip["safer"])
            done = poll(str(pred2.get("id")))
            regen = True
            if str(done.get("status")) != "succeeded":
                raise RuntimeError(f"{clip['id']} failed twice: {done.get('error')}")
        url = output_url(done.get("output"))
        if not url:
            raise RuntimeError(f"{clip['id']} missing output")
        dest = OUT / f"{clip['id']}_raw.mp4"
        download(url, dest)
        entry = {
            "id": clip["id"],
            "prediction_id": done.get("id"),
            "file": str(dest),
            "metrics": done.get("metrics"),
            "regen": regen,
        }
        log["clips"].append(entry)
        LOG.write_text(json.dumps(log, indent=2))
        print(json.dumps(entry, indent=2)[:800], flush=True)
        time.sleep(8)
    print("All cut3 shorts generated.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
