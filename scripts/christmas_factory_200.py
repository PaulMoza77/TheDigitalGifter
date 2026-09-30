#!/usr/bin/env python3
"""Christmas Factory 200 — concurrent Recraft stills + Kling 5s I2V.

Art direction is baked into every prompt. No per-image vision QA.
Resumable. Does not touch completed Europe-1990s assets.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))
from christmas_factory_200_matrix import BUCKETS, build_scenes  # noqa: E402

HIGGSFIELD_API_BASE = "https://api.higgsfield.ai"
IMAGE_MODEL = "recraft/v4.1/pro/text-to-image"
VIDEO_MODEL = "kling-video/v3.0/pro/image-to-video"
DURATION = 5
BATCH_ID = "christmas-factory-200-alive-20260930"
WORKERS = int(os.environ.get("TDG_FACTORY_WORKERS") or 6)
TARGET = int(os.environ.get("TDG_FACTORY_TARGET") or 200)

OUT = ROOT / "generated/christmas-factory-200"
STILLS = OUT / "stills"
MASTERS = OUT / "masters"
POSTERS = OUT / "posters"
MANIFEST = OUT / "generation_manifest.json"

IMAGE_SUFFIX = (
    " I CAN'T WAIT FOR CHRISTMAS. Photorealistic, bright, warm, alive, magical. "
    "Premium Christmas movie × childhood memory × holiday commercial × real life. "
    "Several practical Christmas lights: golden fairy lights, tree lights, warm windows, fireplace, candles, street decorations, storefront glow. "
    "Night stays luminous. No crushed blacks. Colors: warm gold, creamy white, clean bright snow, Christmas red, rich evergreen, warm wood, soft winter blue, healthy skin. "
    "Three layers: foreground flakes/bokeh lights, midground emotional action, background Christmas world. "
    "Vertical 9:16 photoreal MOMENT, not a location plate. Natural happiness, not poses. "
    "No gloomy gray desaturated low-key fashion-editorial, no plastic skin, no logos, no readable text."
)
MOTION_SUFFIX = (
    " SUBJECT ACTION + ENVIRONMENT ACTION + CAMERA ACTION. People and the world move. "
    "Snow at several depths, lights shimmer, fire/steam/walking/reflections as applicable. "
    "Gentle forward tracking only. Complete the still. No frozen humans, no zoom-only, no morphing."
)

_lock = threading.Lock()


def try_load_hf() -> None:
    if (os.environ.get("HF_CREDENTIALS") or "").strip():
        return
    loader = ROOT / "scripts/_load_hf_credentials.sh"
    if loader.exists():
        proc = subprocess.run(["bash", str(loader)], capture_output=True, text=True, check=False)
        val = (proc.stdout or "").strip()
        if val and ":" in val:
            os.environ["HF_CREDENTIALS"] = val


def auth_header() -> str:
    try_load_hf()
    combined = (os.environ.get("HF_CREDENTIALS") or "").strip()
    if ":" not in combined:
        raise SystemExit("BLOCKED: Higgsfield credentials missing")
    kid, sec = combined.split(":", 1)
    return f"Key {kid.strip()}:{sec.strip()}"


def hf_request(method: str, path: str, data: dict | None = None, timeout: int = 180) -> dict:
    url = path if path.startswith("http") else f"{HIGGSFIELD_API_BASE}{path}"
    body = None if data is None else json.dumps(data).encode()
    headers = {"Authorization": auth_header(), "Accept": "application/json", "User-Agent": "tdg-christmas-factory-200"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {url} -> {e.code} {e.read().decode()[:400]}") from e


def poll_job(request_id: str, timeout_s: int = 1800) -> dict:
    start = time.time()
    while time.time() - start < timeout_s:
        cur = hf_request("GET", f"/requests/{request_id}/status")
        status = str(cur.get("status") or "").lower()
        if status in {"completed", "succeeded", "failed", "error", "cancelled", "canceled", "nsfw"}:
            return cur
        time.sleep(5)
    raise TimeoutError(request_id)


def image_url_from(body: dict) -> str | None:
    for img in body.get("images") or []:
        if isinstance(img, dict) and img.get("url"):
            return str(img["url"])
        if isinstance(img, str) and img.startswith("http"):
            return img
    if body.get("image_url"):
        return str(body["image_url"])
    return None


def video_url_from(body: dict) -> str | None:
    vid = body.get("video")
    if isinstance(vid, dict) and vid.get("url"):
        return str(vid["url"])
    if body.get("video_url"):
        return str(body["video_url"])
    return None


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-christmas-factory-200"})
    with urllib.request.urlopen(req, timeout=180) as resp, dest.open("wb") as f:
        while True:
            chunk = resp.read(256 * 1024)
            if not chunk:
                break
            f.write(chunk)


def upload_image(path: Path) -> str:
    ctype = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    meta = hf_request("POST", "/files/generate-upload-url", {"content_type": ctype})
    upload_url, public_url = meta.get("upload_url"), meta.get("public_url")
    if not upload_url or not public_url:
        raise RuntimeError("upload url missing")
    headers = dict(meta.get("upload_headers") or {"Content-Type": ctype})
    req = urllib.request.Request(str(upload_url), data=path.read_bytes(), method="PUT", headers=headers)
    with urllib.request.urlopen(req, timeout=180) as resp:
        resp.read()
    return str(public_url)


def empty_manifest(scenes: list[dict]) -> dict:
    return {
        "batch_id": BATCH_ID,
        "campaign": "christmas_factory_200_alive",
        "art_direction": "I CAN'T WAIT FOR CHRISTMAS — bright, warm, alive, magical, photoreal",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "models": {"image": IMAGE_MODEL, "video": VIDEO_MODEL},
        "distribution": BUCKETS,
        "costs": {"image_usd": 0.0, "video_usd": 0.0, "total_usd": 0.0},
        "target": TARGET,
        "clips": [
            {
                **scene,
                "status": "pending",
                "still": str((STILLS / f"{scene['id']}.jpg").relative_to(ROOT)),
                "master": str((MASTERS / f"{scene['id']}.mp4").relative_to(ROOT)),
            }
            for scene in scenes[:TARGET]
        ],
    }


def load_manifest(scenes: list[dict]) -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return empty_manifest(scenes)


def save_manifest(m: dict) -> None:
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    tmp = MANIFEST.with_suffix(".tmp")
    tmp.write_text(json.dumps(m, indent=2) + "\n")
    tmp.replace(MANIFEST)


def clip_done(row: dict) -> bool:
    master = ROOT / row["master"]
    if not master.exists() or master.stat().st_size < 200_000:
        return False
    return row.get("status") == "video_ready"


def generate_one(m: dict, row: dict) -> dict:
    cid = row["id"]
    still = ROOT / row["still"]
    master = ROOT / row["master"]
    if clip_done(row) and master.exists():
        return {"id": cid, "skipped": True}

    image_prompt = row["image_core"] + IMAGE_SUFFIX
    motion_prompt = row["motion_core"] + MOTION_SUFFIX
    image_usd = 0.0
    video_usd = 0.0

    if not still.exists() or still.stat().st_size < 80_000:
        print(f"IMAGE {cid}", flush=True)
        est = hf_request("POST", f"/estimate/{IMAGE_MODEL}", {"prompt": image_prompt, "aspect_ratio": "9:16"})
        image_usd = float(est.get("usd") or 0)
        sub = hf_request("POST", f"/{IMAGE_MODEL}", {"prompt": image_prompt, "aspect_ratio": "9:16"})
        req_id = str(sub.get("request_id") or "")
        if not req_id:
            raise RuntimeError(f"image submit failed {cid}")
        done = poll_job(req_id)
        if str(done.get("status")).lower() not in {"completed", "succeeded"}:
            raise RuntimeError(f"image failed {cid} {done.get('status')}")
        url = image_url_from(done)
        if not url:
            raise RuntimeError(f"image url missing {cid}")
        download(url, still)
        row["image_job_id"] = req_id
        row["image_cost_usd"] = image_usd
        row["status"] = "image_ready"
        with _lock:
            m["costs"]["image_usd"] += image_usd
            save_manifest(m)
    else:
        row["status"] = row.get("status") or "image_ready"

    if master.exists() and master.stat().st_size > 200_000:
        row["status"] = "video_ready"
        return {"id": cid, "resumed_video": True}

    print(f"VIDEO {cid}", flush=True)
    public = upload_image(still)
    vest = hf_request(
        "POST",
        f"/estimate/{VIDEO_MODEL}",
        {"image_url": public, "prompt": motion_prompt, "duration": DURATION, "sound": "off"},
    )
    video_usd = float(vest.get("usd") or 0)
    vsub = hf_request(
        "POST",
        f"/{VIDEO_MODEL}",
        {"image_url": public, "prompt": motion_prompt, "duration": DURATION, "sound": "off"},
    )
    vid = str(vsub.get("request_id") or "")
    if not vid:
        raise RuntimeError(f"video submit failed {cid}")
    vdone = poll_job(vid, timeout_s=1800)
    if str(vdone.get("status")).lower() not in {"completed", "succeeded"}:
        raise RuntimeError(f"video failed {cid}")
    vurl = video_url_from(vdone)
    if not vurl:
        raise RuntimeError(f"video url missing {cid}")
    download(vurl, master)
    POSTERS.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", "0.4", "-i", str(master), "-frames:v", "1", "-q:v", "3", str(POSTERS / f"{cid}.jpg")],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    row["video_job_id"] = vid
    row["video_cost_usd"] = video_usd
    row["status"] = "video_ready"
    with _lock:
        m["costs"]["video_usd"] += video_usd
        m["costs"]["total_usd"] = m["costs"]["image_usd"] + m["costs"]["video_usd"]
        for i, existing in enumerate(m["clips"]):
            if existing.get("id") == cid:
                m["clips"][i] = {**existing, **row}
                break
        save_manifest(m)
    print(f"OK {cid}", flush=True)
    return {"id": cid, "ok": True}


def progress(m: dict) -> tuple[int, int]:
    done = sum(1 for c in m["clips"] if c.get("status") == "video_ready")
    return done, len(m["clips"])


def main() -> int:
    for d in (OUT, STILLS, MASTERS, POSTERS):
        d.mkdir(parents=True, exist_ok=True)
    scenes = build_scenes()
    m = load_manifest(scenes)
    if len(m.get("clips") or []) < TARGET:
        m = empty_manifest(scenes)
        save_manifest(m)
    done, total = progress(m)
    print(f"FACTORY {BATCH_ID} resume {done}/{total} workers={WORKERS}", flush=True)
    try_load_hf()
    auth_header()
    pending = [c for c in m["clips"] if not clip_done(c)]
    if not pending:
        print("ALL_CLIPS_READY", flush=True)
        return 0

    errors = []
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(generate_one, m, row): row["id"] for row in pending}
        for fut in as_completed(futs):
            cid = futs[fut]
            try:
                fut.result()
            except Exception as e:
                errors.append((cid, str(e)[:300]))
                print(f"ERR {cid} {e}", flush=True)
                with _lock:
                    for row in m["clips"]:
                        if row["id"] == cid:
                            row["last_error"] = str(e)[:300]
                    save_manifest(m)
    done, total = progress(m)
    print(json.dumps({"done": done, "total": total, "errors": errors[:20], "costs": m["costs"]}), flush=True)
    return 0 if done == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
