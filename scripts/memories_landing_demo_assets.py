#!/usr/bin/env python3
"""Generate Memories landing demo stills + short Kling I2V clips via Higgsfield.

Fictional / consenting-person styled demonstration only — never a real deceased likeness.
Outputs land in public/assets/memories/ for the /memories landing before/after UI.

Usage:
  HF_CREDENTIALS=key:secret python3 scripts/memories_landing_demo_assets.py
  python3 scripts/memories_landing_demo_assets.py --phase images|videos|all
"""

from __future__ import annotations

import argparse
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
VIDEO_MODEL = "kling-video/v3.0/pro/image-to-video"
DURATION = 5
BATCH_ID = "memories-landing-demo-20261013"

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
OUT = ROOT / "public/assets/memories"
STILLS = OUT / "stills"
CLIPS = OUT / "clips"
POSTERS = OUT / "posters"
QC = OUT / "qc"
MANIFEST = OUT / "generation_manifest.json"

VISUAL_SUFFIX = (
    " Photorealistic cinematic photograph, natural film grain, warm emotional lighting, "
    "authentic family memory atmosphere. Realistic anatomy, hands, faces, skin, proportions. "
    "NOT illustration, cartoon, plastic AI skin, excessive bokeh, readable text, logos, watermarks, "
    "modern smartphones as focus, horror, grief-manipulation, funerals, or cemetery scenes."
)

NEGATIVE = (
    " Do not morph faces. No duplicated people, no extra limbs, no melting objects, no random text. "
    "Subtle cinematic motion only. Preserve composition from the first frame. Silent demonstration."
)

SCENES = [
    {
        "id": "hero_family_table",
        "role": "hero",
        "aspect": "4:3",
        "label": "Sunday dinner",
        "still_name": "demo-before.jpg",
        "clip_name": "demo-after.mp4",
        "poster_name": "demo-after-poster.jpg",
        "image": (
            "Fictional demonstration still for a memory product marketing page. Warm indoor family "
            "dinner table in late afternoon light. An older couple and adult children smiling naturally "
            "around a wooden table with simple homemade food, ceramic plates, soft window light, "
            "gentle shadows. Authentic candid photograph feel, European home interior, 1990s-2000s, "
            "emotional but calm — no grief messaging. Horizontal 4:3 composition."
        ),
        "motion": (
            "Photoreal cinematic 4:3 family dinner photograph comes alive for five seconds. "
            "Preserve every person, plate, table, and window light exactly as framed. "
            "People make tiny natural movements — soft smiles, a hand reaching for a glass. "
            "Curtain breathes slightly. Warm light stays consistent. Very slow gentle push-in. "
            "No face morphing. Fictional demo only."
        ),
        "scale": "1440:1080",
    },
    {
        "id": "gallery_garden",
        "role": "gallery",
        "aspect": "4:5",
        "label": "Garden afternoon",
        "still_name": "gallery-1.jpg",
        "clip_name": "gallery-1.mp4",
        "poster_name": "gallery-1-poster.jpg",
        "image": (
            "Fictional demonstration still. Two consenting adults sitting on a garden bench under "
            "dappled late-summer sunlight, soft laughter, wildflowers in foreground, vintage summer "
            "clothing, photoreal candid portrait, vertical 4:5, warm nostalgic tone."
        ),
        "motion": (
            "This exact garden photograph comes alive for five seconds. Leaves sway gently, light "
            "flickers through trees, people shift subtly with natural micro-movements. Preserve faces "
            "and composition. Slow subtle push-in. No morphing."
        ),
        "scale": "1080:1350",
    },
    {
        "id": "gallery_living_room",
        "role": "gallery",
        "aspect": "4:5",
        "label": "Quiet afternoon",
        "still_name": "gallery-2.jpg",
        "clip_name": "gallery-2.mp4",
        "poster_name": "gallery-2-poster.jpg",
        "image": (
            "Fictional demonstration still. Cozy living room with an older person reading beside a "
            "window while afternoon light falls across a worn armchair and a photo album on a side table. "
            "Calm intimate atmosphere, photoreal, vertical 4:5, warm amber tones."
        ),
        "motion": (
            "This exact living-room photograph comes alive for five seconds. Soft curtain motion, "
            "subtle page turn, warm window light stays stable. Preserve the person and room. "
            "Very slow dolly. No face morph."
        ),
        "scale": "1080:1350",
    },
    {
        "id": "gallery_celebration",
        "role": "gallery",
        "aspect": "4:5",
        "label": "Celebration night",
        "still_name": "gallery-3.jpg",
        "clip_name": "gallery-3.mp4",
        "poster_name": "gallery-3-poster.jpg",
        "image": (
            "Fictional demonstration still. Multi-generation family toasting with glasses at a candlelit "
            "table during a birthday celebration. Soft bokeh candle flames, joyful but tasteful expressions, "
            "photoreal candid, vertical 4:5, rich warm color."
        ),
        "motion": (
            "This exact celebration photograph comes alive for five seconds. Candle flames flicker, "
            "glasses raise slightly, natural smiles. Preserve faces and table layout. Slow push-in. "
            "No duplicated people, no morphing."
        ),
        "scale": "1080:1350",
    },
]


def read_credentials() -> tuple[str, str]:
    combined = (os.environ.get("HF_CREDENTIALS") or os.environ.get("HF_KEY") or "").strip()
    if ":" not in combined:
        raise SystemExit("BLOCKED: HF_CREDENTIALS missing (keyId:secret)")
    kid, sec = combined.split(":", 1)
    if not kid.strip() or not sec.strip():
        raise SystemExit("BLOCKED: HF_CREDENTIALS malformed")
    return kid.strip(), sec.strip()


def auth_header() -> str:
    kid, sec = read_credentials()
    return f"Key {kid}:{sec}"


def hf_request(method: str, path: str, data: dict | None = None, timeout: int = 180) -> dict:
    url = path if path.startswith("http") else f"{HIGGSFIELD_API_BASE}{path}"
    body = None if data is None else json.dumps(data).encode()
    headers = {
        "Authorization": auth_header(),
        "Accept": "application/json",
        "User-Agent": "tdg-memories-landing/higgsfield",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {url} -> {e.code} {e.read().decode()[:600]}") from e


def poll_job(request_id: str, timeout_s: int = 1200) -> dict:
    start = time.time()
    while time.time() - start < timeout_s:
        cur = hf_request("GET", f"/requests/{request_id}/status")
        status = str(cur.get("status") or "")
        print(f"  poll {request_id} {status}", flush=True)
        if status.lower() in {"completed", "succeeded", "failed", "error", "cancelled", "canceled", "nsfw"}:
            return cur
        time.sleep(6)
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
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-memories-landing/higgsfield"})
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


def scale_image(src: Path, dest: Path, wh: str) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    w, h = wh.split(":")
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-vf",
            f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}",
            "-frames:v",
            "1",
            "-q:v",
            "2",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def probe_video(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-show_entries",
            "format=duration,size",
            "-of",
            "json",
            str(path),
        ]
    )
    data = json.loads(raw)
    stream = (data.get("streams") or [{}])[0]
    fmt = data.get("format") or {}
    return {
        "duration": float(fmt.get("duration") or 0),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
    }


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {
        "batch_id": BATCH_ID,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "images": [],
        "clips": [],
        "costs": {"image_usd": 0.0, "video_usd": 0.0, "total_usd": 0.0},
        "disclaimer": "Fictional / consenting-person styled demo assets for Memories landing. Not customer photos. Not recordings of deceased persons.",
    }


def save_manifest(m: dict) -> None:
    m["updated_at"] = datetime.now(timezone.utc).isoformat()
    m["costs"]["total_usd"] = float(m["costs"].get("image_usd") or 0) + float(m["costs"].get("video_usd") or 0)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(m, indent=2) + "\n")


def phase_images(m: dict) -> None:
    for scene in SCENES:
        dest = STILLS / scene["still_name"]
        # Also publish flat aliases used by landing for hero/gallery.
        alias = OUT / scene["still_name"]
        existing = next((r for r in m.get("images", []) if r.get("id") == scene["id"] and r.get("ok")), None)
        if existing and dest.exists() and dest.stat().st_size > 80_000:
            print(f"SKIP image {scene['id']}", flush=True)
            if not alias.exists():
                subprocess.check_call(["cp", "-f", str(dest), str(alias)])
            continue
        prompt = scene["image"] + VISUAL_SUFFIX
        print(f"IMAGE {scene['id']} aspect={scene['aspect']}", flush=True)
        est = hf_request("POST", f"/estimate/{IMAGE_MODEL}", {"prompt": prompt, "aspect_ratio": scene["aspect"]})
        m["costs"]["image_usd"] += float(est.get("usd") or 0)
        sub = hf_request("POST", f"/{IMAGE_MODEL}", {"prompt": prompt, "aspect_ratio": scene["aspect"]})
        req_id = str(sub.get("request_id") or "")
        if not req_id:
            raise RuntimeError(f"image submit failed {scene['id']}")
        done = poll_job(req_id)
        if str(done.get("status")).lower() not in {"completed", "succeeded"}:
            raise RuntimeError(f"image failed {scene['id']}: {done.get('status')}")
        url = image_url_from(done)
        if not url:
            raise RuntimeError(f"image url missing {scene['id']}")
        raw = QC / f"{scene['id']}_raw.jpg"
        download(url, raw)
        scale_image(raw, dest, scene["scale"])
        subprocess.check_call(["cp", "-f", str(dest), str(alias)])
        row = {
            "id": scene["id"],
            "role": scene["role"],
            "label": scene["label"],
            "still": str(dest.relative_to(ROOT)),
            "public_alias": str(alias.relative_to(ROOT)),
            "image_job_id": req_id,
            "image_cost_usd": float(est.get("usd") or 0),
            "ok": True,
            "bytes": dest.stat().st_size,
        }
        m["images"] = [r for r in m.get("images", []) if r.get("id") != scene["id"]] + [row]
        save_manifest(m)
        print(f"  OK {dest} ({dest.stat().st_size} bytes)", flush=True)


def phase_videos(m: dict) -> None:
    for scene in SCENES:
        still = STILLS / scene["still_name"]
        dest = CLIPS / scene["clip_name"]
        alias = OUT / scene["clip_name"]
        poster = POSTERS / scene["poster_name"]
        poster_alias = OUT / scene["poster_name"]
        if dest.exists():
            pr = probe_video(dest)
            if 4.2 <= pr["duration"] <= 7.5 and pr["size"] > 150_000:
                print(f"SKIP video {scene['id']}", flush=True)
                if not alias.exists():
                    subprocess.check_call(["cp", "-f", str(dest), str(alias)])
                continue
        if not still.exists():
            raise RuntimeError(f"missing still {still}")
        motion = scene["motion"] + NEGATIVE
        public = upload_image(still)
        last_err = ""
        ok_row = None
        for attempt in range(1, 4):
            print(f"VIDEO {scene['id']} attempt {attempt}", flush=True)
            try:
                est = hf_request(
                    "POST",
                    f"/estimate/{VIDEO_MODEL}",
                    {"image_url": public, "prompt": motion, "duration": DURATION, "sound": "off"},
                )
                m["costs"]["video_usd"] += float(est.get("usd") or 0)
                sub = hf_request(
                    "POST",
                    f"/{VIDEO_MODEL}",
                    {"image_url": public, "prompt": motion, "duration": DURATION, "sound": "off"},
                )
                req_id = str(sub.get("request_id") or "")
                done = poll_job(req_id, timeout_s=1800)
                if str(done.get("status")).lower() not in {"completed", "succeeded"}:
                    last_err = f"status={done.get('status')}"
                    continue
                vurl = video_url_from(done)
                if not vurl:
                    last_err = "video url missing"
                    continue
                download(vurl, dest)
                pr = probe_video(dest)
                if pr["duration"] < 4.0 or pr["size"] < 120_000:
                    last_err = f"clip qc fail {pr}"
                    continue
                poster.parent.mkdir(parents=True, exist_ok=True)
                subprocess.check_call(
                    ["ffmpeg", "-y", "-ss", "0.5", "-i", str(dest), "-frames:v", "1", "-q:v", "3", str(poster)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                subprocess.check_call(["cp", "-f", str(dest), str(alias)])
                subprocess.check_call(["cp", "-f", str(poster), str(poster_alias)])
                ok_row = {
                    "id": scene["id"],
                    "role": scene["role"],
                    "label": scene["label"],
                    "clip": str(dest.relative_to(ROOT)),
                    "public_alias": str(alias.relative_to(ROOT)),
                    "poster": str(poster.relative_to(ROOT)),
                    "video_job_id": req_id,
                    "video_cost_usd": float(est.get("usd") or 0),
                    "probe": pr,
                    "attempt": attempt,
                    "ok": True,
                }
                break
            except Exception as exc:  # noqa: BLE001 — retry provider flakiness
                last_err = str(exc)[:240]
                print(f"  attempt error: {last_err}", flush=True)
                time.sleep(3)
        if not ok_row:
            raise RuntimeError(f"video failed {scene['id']}: {last_err}")
        m["clips"] = [r for r in m.get("clips", []) if r.get("id") != scene["id"]] + [ok_row]
        save_manifest(m)
        print(f"  CLIP OK {scene['id']} {ok_row['probe']['duration']:.2f}s", flush=True)


def write_asset_index(m: dict) -> None:
    index = {
        "batch_id": BATCH_ID,
        "disclaimer": m.get("disclaimer"),
        "hero": {
            "before": "/assets/memories/demo-before.jpg",
            "afterVideo": "/assets/memories/demo-after.mp4",
            "afterPoster": "/assets/memories/demo-after-poster.jpg",
            "label": "Sunday dinner",
        },
        "gallery": [
            {
                "id": s["id"],
                "label": s["label"],
                "still": f"/assets/memories/{s['still_name']}",
                "video": f"/assets/memories/{s['clip_name']}",
                "poster": f"/assets/memories/{s['poster_name']}",
            }
            for s in SCENES
            if s["role"] == "gallery"
        ],
        "costs": m.get("costs"),
    }
    (OUT / "demo-assets.json").write_text(json.dumps(index, indent=2) + "\n")
    print("WROTE", OUT / "demo-assets.json", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=["images", "videos", "all"], default="all")
    args = parser.parse_args()
    read_credentials()
    for d in (OUT, STILLS, CLIPS, POSTERS, QC):
        d.mkdir(parents=True, exist_ok=True)
    m = load_manifest()
    if args.phase in {"images", "all"}:
        phase_images(m)
    if args.phase in {"videos", "all"}:
        phase_videos(m)
    write_asset_index(m)
    print(json.dumps({"status": "ok", "costs": m["costs"], "images": len(m["images"]), "clips": len(m["clips"])}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
