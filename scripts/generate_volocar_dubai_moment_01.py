#!/usr/bin/env python3
"""VoloCar Dubai Moment 01 — Super Car Night (single test).

One Recraft still (16:9) if no source on disk, then one Kling 3.0 Pro I2V (8s, silent).
Credentials: HF_CREDENTIALS or Mozas VPS app.env via scripts/_load_hf_credentials.sh.
Does not modify VoloCar app or publish assets.
"""

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
VIDEO_MODEL = "kling-video/v3.0/pro/image-to-video"
DURATION = 8
BUDGET_USD = 2.5

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
OUT = ROOT / "source" / "volocar" / "dubai-moment-01"
MASTERS = ROOT / "generated" / "volocar" / "dubai-moment-01"
MANIFEST = MASTERS / "generation_manifest.json"

STILL_NAME = "dubai_moment_01_super_car_night_master.jpg"
I2V_STILL_NAME = "dubai_moment_01_super_car_night_1920x1080.jpg"
VIDEO_NAME = "dubai_moment_01_super_car_night_8s.mp4"

STILL_PROMPT = (
    "Ultra photorealistic 16:9 cinematic photograph, real-world night in Downtown Dubai, blue hour transitioning to night. "
    "A Lamborghini Huracán EVO Spyder convertible driving on a real multi-lane city road with gentle motion blur on the asphalt, "
    "not parked. Burj Khalifa and surrounding towers visible in depth with realistic scale — city feels alive with sparse traffic, "
    "streetlights, warm hotel and restaurant light, believable reflections on the car body. "
    "Three-quarter rear or tracking angle: experience and Dubai first, car integrated in the moment. "
    "Natural color, subtle grain, imperfect real photography — not CGI, not cyberpunk teal-orange, not glossy AI car poster, "
    "not empty streets, no text, no logos, no watermark, no people posing at camera."
)

I2V_PROMPT = (
    "Photoreal cinematic 16:9 night in Downtown Dubai. This exact photograph comes alive for eight seconds — do not redesign the scene. "
    "Preserve the Lamborghini Huracán EVO Spyder, paint color, wheels, body lines, Burj Khalifa and Downtown skyline, road markings, "
    "lane layout, surrounding cars, streetlights, building architecture, and camera perspective exactly as in the first frame. "
    "The car continues at a believable urban speed on a real multi-lane road — not parked as a poster shot. "
    "Wheels rotate correctly with road speed. Gentle forward motion with natural suspension. "
    "Very slow, stabilized camera drift alongside or behind the car (no drone dive, no orbit, no whip pan, no zoom punch). "
    "Background parallax: distant towers, traffic, and streetlights move subtly. Headlight and taillight streaks behave physically. "
    "Reflections on the bodywork and windshield shift naturally with motion. Warm hotel and restaurant light stays soft and real. "
    "If people appear, they remain anonymous and small with minimal natural movement only. "
    "No text, logos, captions, watermarks, UI, or graphics. No scene cuts. "
    "Do not morph the vehicle, melt buildings, warp wheels, duplicate vehicles, or add aggressive cinematic effects."
)

NEGATIVE_SUFFIX = (
    " Do not morph faces, vehicles, buildings, or road geometry. No invented text or logos. "
    "Subtle physically believable motion only."
)


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
        "User-Agent": "tdg-volocar-dubai-moment-01/higgsfield",
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


def parse_usd(body: dict) -> float:
    usd = float(body.get("usd"))
    if not (usd >= 0):
        raise RuntimeError(f"estimate missing usd: {body!r}")
    return usd


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


def video_url_from_status(body: dict) -> str | None:
    video = body.get("video")
    if isinstance(video, dict) and isinstance(video.get("url"), str):
        return video["url"]
    if isinstance(body.get("video_url"), str):
        return body["video_url"]
    return None


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-volocar-dubai-moment-01/higgsfield"})
    with urllib.request.urlopen(req, timeout=300) as resp, dest.open("wb") as f:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            f.write(chunk)


def upload_image(path: Path) -> str:
    ctype = "image/jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else "image/png"
    meta = hf_json("POST", "/files/generate-upload-url", {"content_type": ctype})
    upload_url = str(meta.get("upload_url") or "")
    public_url = str(meta.get("public_url") or "")
    if not upload_url or not public_url:
        raise RuntimeError("upload meta missing")
    headers = dict(meta.get("upload_headers") or {"Content-Type": ctype})
    data = path.read_bytes()
    req = urllib.request.Request(upload_url, data=data, method="PUT", headers=headers)
    with urllib.request.urlopen(req, timeout=180) as resp:
        resp.read()
    return public_url


def ensure_1920x1080(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-vf",
            "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080",
            "-q:v",
            "2",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def ffprobe(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,codec_name,r_frame_rate",
            "-show_entries",
            "format=duration,size,bit_rate",
            "-of",
            "json",
            str(path),
        ]
    )
    data = json.loads(raw)
    stream = (data.get("streams") or [{}])[0]
    fmt = data.get("format") or {}
    return {
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "duration": float(fmt.get("duration") or 0),
        "codec": stream.get("codec_name"),
        "size": int(fmt.get("size") or 0),
    }


def main() -> int:
    auth_header()
    OUT.mkdir(parents=True, exist_ok=True)
    MASTERS.mkdir(parents=True, exist_ok=True)

    still_path = OUT / STILL_NAME
    i2v_path = OUT / I2V_STILL_NAME
    video_path = MASTERS / VIDEO_NAME

    manifest: dict = {
        "concept": "VoloCar Dubai Moment 01 — Super Car Night",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "provider": "higgsfield",
        "steps": [],
        "total_usd": 0.0,
    }

    total_usd = 0.0

    if still_path.exists() and still_path.stat().st_size > 50_000:
        print(f"REUSE still {still_path}", flush=True)
        still_entry = {"step": "still", "reused": True, "path": str(still_path)}
    else:
        est = parse_usd(hf_json("POST", f"/estimate/{IMAGE_MODEL}", {"prompt": STILL_PROMPT, "aspect_ratio": "16:9"}))
        print(f"STILL ESTIMATE ${est:.4f}", flush=True)
        if total_usd + est > BUDGET_USD:
            raise SystemExit(f"STOP: still estimate ${est:.4f} exceeds budget ${BUDGET_USD:.2f}")
        sub = hf_json("POST", f"/{IMAGE_MODEL}", {"prompt": STILL_PROMPT, "aspect_ratio": "16:9"})
        request_id = str(sub.get("request_id") or "")
        if not request_id:
            raise RuntimeError(f"still submit failed: {sub}")
        done = poll_request(request_id)
        url = image_url_from_status(done)
        if not url:
            raise RuntimeError("still missing url")
        download(url, still_path)
        still_entry = {
            "step": "still",
            "model": IMAGE_MODEL,
            "job_id": request_id,
            "path": str(still_path),
            "generation_cost_usd": est,
            "credits": done.get("credits"),
        }
        total_usd += est
        print(f"STILL OK {still_path} ${est:.4f}", flush=True)

    manifest["steps"].append(still_entry)

    if not i2v_path.exists() or i2v_path.stat().st_size < 50_000:
        ensure_1920x1080(still_path, i2v_path)
        print(f"I2V crop {i2v_path}", flush=True)

    if video_path.exists() and video_path.stat().st_size > 500_000:
        print(f"REUSE video {video_path}", flush=True)
        manifest["steps"].append({"step": "video", "reused": True, "path": str(video_path)})
    else:
        public_url = upload_image(i2v_path)
        prompt = I2V_PROMPT + NEGATIVE_SUFFIX
        est_v = parse_usd(
            hf_json(
                "POST",
                f"/estimate/{VIDEO_MODEL}",
                {"image_url": public_url, "prompt": prompt, "duration": DURATION, "sound": "off"},
            )
        )
        print(f"VIDEO ESTIMATE ${est_v:.4f} duration={DURATION}s", flush=True)
        if total_usd + est_v > BUDGET_USD:
            raise SystemExit(f"STOP: video estimate ${total_usd + est_v:.4f} exceeds budget ${BUDGET_USD:.2f}")
        sub_v = hf_json(
            "POST",
            f"/{VIDEO_MODEL}",
            {"image_url": public_url, "prompt": prompt, "duration": DURATION, "sound": "off"},
        )
        vid_id = str(sub_v.get("request_id") or "")
        if not vid_id:
            raise RuntimeError(f"video submit failed: {sub_v}")
        done_v = poll_request(vid_id, max_attempts=120, sleep_s=5.0)
        vurl = video_url_from_status(done_v)
        if not vurl:
            raise RuntimeError("video missing url")
        download(vurl, video_path)
        probe = ffprobe(video_path)
        video_entry = {
            "step": "video",
            "model": VIDEO_MODEL,
            "job_id": vid_id,
            "source_image": str(i2v_path),
            "hf_upload_url": public_url,
            "path": str(video_path),
            "generation_cost_usd": est_v,
            "credits": done_v.get("credits"),
            "probe": probe,
        }
        total_usd += est_v
        manifest["steps"].append(video_entry)
        print(f"VIDEO OK {video_path} ${est_v:.4f} probe={probe}", flush=True)

    manifest["total_usd"] = round(total_usd, 4)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"DONE total_usd=${total_usd:.4f} manifest={MANIFEST}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
