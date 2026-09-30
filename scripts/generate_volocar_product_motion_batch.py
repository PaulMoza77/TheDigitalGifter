#!/usr/bin/env python3
"""VoloCar Product Motion batch — four 16:9 × 5s silent masters (Higgsfield Recraft + Kling 3 Pro I2V).

Credentials: HF_CREDENTIALS or scripts/_load_hf_credentials.sh. Never print secrets.
"""

from __future__ import annotations

import json
import os
import shutil
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
BUDGET_USD = 24.0
MAX_IMAGE_RETRIES = 1
MAX_VIDEO_RETRIES = 1

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
MASTERS = ROOT / "public" / "assets" / "volocar" / "product-motion" / "masters"
POSTERS = ROOT / "public" / "assets" / "volocar" / "product-motion" / "posters"
QC = ROOT / "generated" / "volocar" / "product-motion" / "qc"
MANIFEST = ROOT / "public" / "assets" / "volocar" / "product-motion" / "generation_manifest.json"

DUBAI_ARRIVAL = (
    ROOT / "public" / "assets" / "volocar" / "dubai-moments" / "masters"
    / "06_volocar_dubai_moments_arrival_dubai.jpg"
)

NEGATIVE = (
    " Do not morph faces, hands, vehicles, glass, or architecture. No invented text, numbers, logos, captions, "
    "watermarks, UI, badges, or readable signage. Subtle physically believable motion only. Preserve first-frame composition."
)

CONCEPTS = [
    {
        "seq": "01",
        "id": "01_volocar_zero_deposit",
        "source_filename": "01_volocar_zero_deposit_source.jpg",
        "video_filename": "01_volocar_zero_deposit_5s.mp4",
        "reuse_source": None,
        "image_prompt": (
            "Premium abstract product visualization, 16:9 landscape, deep charcoal near-black environment. "
            "A beautiful smoked-glass abstract object inspired by premium bank-card proportions floating elegantly in space — "
            "NOT a usable payment card: no numbers, no name, no bank logo, no chip text, no Visa Mastercard branding, "
            "no currency, no words, no fake writing. Materials: smoked glass, subtle translucent layers, precision-machined edges, "
            "restrained metallic detail, premium reflections. Thin controlled warm orange light reflection visible on the glass. "
            "Apple product-film restraint, luxury automotive material design, extremely minimal, crop-safe centered composition. "
            "No particles explosion, no giant zero, no shattering, no money, no credit-card advertisement look."
        ),
        "video_prompt": (
            "Premium abstract 16:9 product film on deep charcoal background. This exact frame comes alive for five seconds. "
            "Preserve the smoked-glass abstract object shape, edges, and environment exactly. A thin controlled warm-orange "
            "light reflection travels slowly and precisely across and through the glass; as it passes, the glass becomes "
            "slightly clearer and lighter, less visually heavy — financial friction disappearing as a metaphor. "
            "Motion very slow, precise, luxurious, minimal. Camera movement almost imperceptible. "
            "No text, numbers, logos, UI, particles storm, shattering, or morphing geometry."
            + NEGATIVE
        ),
    },
    {
        "seq": "02",
        "id": "02_volocar_monthly",
        "source_filename": "02_volocar_monthly_source.jpg",
        "video_filename": "02_volocar_monthly_5s.mp4",
        "reuse_source": None,
        "image_prompt": (
            "Ultra photorealistic 16:9 cinematic photograph. ONE composition: a contemporary premium attainable vehicle "
            "(Mercedes GLC / BMW X5 / Tesla Model Y class premium SUV or premium EV sedan) naturally parked outside a "
            "beautiful modern residential environment — upscale apartment or villa driveway, tasteful landscaping. "
            "Early morning soft light as the starting mood; vehicle is the hero but not filling entire frame — crop-safe center. "
            "Realistic geometry, natural shadows, believable architecture. No calendar, clocks, numbers, text, logos, watermark. "
            "No supercar, no montage panels, single unified scene only."
        ),
        "video_prompt": (
            "Photoreal cinematic 16:9. This exact photograph comes alive for five seconds — single continuous shot, same camera position. "
            "Preserve the exact same vehicle: same color, wheels, trim, body lines, position on driveway — it must NOT morph or move dramatically. "
            "Time passes elegantly around the car: early morning soft cool light transitions through daylight to warm evening early night. "
            "Sun direction and natural shadows shift believably; ambient lighting changes; subtle background life; building windows gradually "
            "gain warm interior lights. No racing clouds, no montage cuts, no calendar, no clocks, no text. Vehicle stays perfectly stable."
            + NEGATIVE
        ),
    },
    {
        "seq": "03",
        "id": "03_volocar_airport_delivery",
        "source_filename": "03_volocar_airport_delivery_source.jpg",
        "video_filename": "03_volocar_airport_delivery_5s.mp4",
        "reuse_source": str(DUBAI_ARRIVAL),
        "image_prompt": None,
        "video_prompt": (
            "Photoreal cinematic 16:9 airport terminal curbside pickup zone. This exact photograph comes alive for five seconds. "
            "Preserve terminal architecture, premium SUV, traveller, suitcase, host, door geometry, and curbside layout exactly. "
            "Subtle camera drift or gentle rack-focus reveal toward the waiting vehicle. Professional host beside the vehicle naturally "
            "holds the open door; traveller continues a natural step toward the car. No handshake, no key handover, no loading montage, "
            "no traveller entering and driving away. People look realistic — stable hands, fingers, faces. No posing at camera. "
            "No readable airport text or airline branding appearing."
            + NEGATIVE
        ),
    },
    {
        "seq": "04",
        "id": "04_volocar_supercars",
        "source_filename": "04_volocar_supercars_source.jpg",
        "video_filename": "04_volocar_supercars_5s.mp4",
        "reuse_source": None,
        "image_prompt": (
            "Ultra photorealistic 16:9 cinematic photograph, Palm Jumeirah Dubai coastal road, golden hour approaching early evening. "
            "Green Lamborghini Huracán EVO Spyder convertible, roof down, driving naturally on a believable road with warm sunlight, "
            "realistic sea and sky, premium Dubai hospitality architecture — Palm Jumeirah hotel environment plausible. "
            "Burj Al Arab only if geographically plausible in distant background; realism over landmark checklist. "
            "Restrained wide composition: car not filling entire frame, environment breathes. Natural traffic ok. "
            "No drifting, smoke, speed ramp, empty impossible road, black studio background, cyberpunk grade, no text or logos."
        ),
        "video_prompt": (
            "Photoreal cinematic 16:9 Palm Jumeirah Dubai golden hour. This exact photograph comes alive for five seconds. "
            "Preserve green Lamborghini Huracán EVO Spyder paint, wheels, body, roof-down state, road, sea, sky, and architecture exactly. "
            "Beautiful restrained tracking shot, slightly wider than traditional car commercial; Dubai environment breathes. "
            "Car drives at natural believable speed — no drift, no smoke, no aggressive acceleration, no orbit, no fake lens flare. "
            "Natural reflections, warm sunlight, realistic parallax. Car must not morph or duplicate."
            + NEGATIVE
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
    url = f"{HIGGSFIELD_API_BASE}{path}" if not path.startswith("http") else path
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "Authorization": auth_header(),
        "Accept": "application/json",
        "User-Agent": "tdg-volocar-product-motion/higgsfield",
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


def poll_request(request_id: str, max_attempts: int = 150, sleep_s: float = 5.0) -> dict:
    for _ in range(max_attempts):
        body = hf_json("GET", f"/requests/{request_id}/status")
        status = str(body.get("status") or "").lower()
        print(f"  poll {request_id} {status}", flush=True)
        if status in {"completed", "succeeded", "success"}:
            return body
        if status in {"failed", "error", "cancelled", "canceled", "nsfw"}:
            raise RuntimeError(f"job {request_id} failed: {body}")
        time.sleep(sleep_s)
    raise TimeoutError(f"job {request_id} timed out")


def image_url_from_status(body: dict) -> str | None:
    images = body.get("images")
    if isinstance(images, list):
        for item in images:
            if isinstance(item, dict) and isinstance(item.get("url"), str):
                return item["url"]
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
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-volocar-product-motion/higgsfield"})
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


def upload_image(path: Path) -> str:
    ctype = "image/jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else "image/png"
    meta = hf_json("POST", "/files/generate-upload-url", {"content_type": ctype})
    upload_url = str(meta.get("upload_url") or "")
    public_url = str(meta.get("public_url") or "")
    if not upload_url or not public_url:
        raise RuntimeError("upload meta missing")
    headers = dict(meta.get("upload_headers") or {"Content-Type": ctype})
    req = urllib.request.Request(upload_url, data=path.read_bytes(), method="PUT", headers=headers)
    with urllib.request.urlopen(req, timeout=180) as resp:
        resp.read()
    return public_url


def ffprobe_video(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,codec_name",
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
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "duration": float(fmt.get("duration") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
        "codec": stream.get("codec_name"),
    }


def validate_source(path: Path) -> None:
    if path.stat().st_size < 80_000:
        raise RuntimeError("source too small")
    w, h = image_dimensions(path)
    if h < 900 or w < 1500:
        raise RuntimeError(f"source resolution too low {w}x{h}")
    if h and abs(w / h - 16 / 9) > 0.12:
        raise RuntimeError(f"source aspect not ~16:9 {w}x{h}")


def validate_video(path: Path) -> None:
    info = ffprobe_video(path)
    if info["width"] < 1280 or info["height"] < 720:
        raise RuntimeError(f"video too small {info['width']}x{info['height']}")
    if info["duration"] < 4.2 or info["duration"] > 6.5:
        raise RuntimeError(f"video duration {info['duration']}")
    if info["size"] < 200_000:
        raise RuntimeError("video corrupt/small")


def qc_frames(video: Path) -> list[str]:
    QC.mkdir(parents=True, exist_ok=True)
    out = []
    for label, t in (("first", 0.1), ("mid", 2.5), ("last", 4.6)):
        dest = QC / f"{video.stem}_{label}.jpg"
        subprocess.check_call(
            ["ffmpeg", "-y", "-ss", str(t), "-i", str(video), "-frames:v", "1", "-q:v", "3", str(dest)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        out.append(str(dest))
    return out


def poster_from_video(video: Path, poster: Path) -> None:
    poster.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", "0.35", "-i", str(video), "-frames:v", "1", "-q:v", "3", str(poster)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def generate_image(prompt: str, dest: Path) -> tuple[str, float]:
    est = parse_usd(hf_json("POST", f"/estimate/{IMAGE_MODEL}", {"prompt": prompt, "aspect_ratio": "16:9"}))
    print(f"  image estimate ${est:.4f}", flush=True)
    sub = hf_json("POST", f"/{IMAGE_MODEL}", {"prompt": prompt, "aspect_ratio": "16:9"})
    request_id = str(sub.get("request_id") or "")
    if not request_id:
        raise RuntimeError(f"image submit failed: {sub}")
    done = poll_request(request_id)
    url = image_url_from_status(done)
    if not url:
        raise RuntimeError("missing image url")
    download(url, dest)
    validate_source(dest)
    return request_id, est


def submit_video(i2v_jpg: Path, prompt: str, conservative: bool = False) -> tuple[str, float, str]:
    full_prompt = prompt
    if conservative:
        full_prompt = (
            "Extremely minimal motion. Almost static. " + prompt + " Camera locked. No parallax exaggeration."
        )
    public_url = upload_image(i2v_jpg)
    payload = {"image_url": public_url, "prompt": full_prompt, "duration": DURATION, "sound": "off"}
    est = parse_usd(hf_json("POST", f"/estimate/{VIDEO_MODEL}", payload))
    print(f"  video estimate ${est:.4f}", flush=True)
    sub = hf_json("POST", f"/{VIDEO_MODEL}", payload)
    request_id = str(sub.get("request_id") or "")
    if not request_id:
        raise RuntimeError(f"video submit failed: {sub}")
    return request_id, est, public_url


def finish_video(request_id: str, dest: Path) -> dict:
    done = poll_request(request_id, max_attempts=180, sleep_s=5.0)
    url = video_url_from_status(done)
    if not url:
        raise RuntimeError("missing video url")
    download(url, dest)
    validate_video(dest)
    return done


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {
        "collection": "VoloCar / Product Motion",
        "project": "volocar",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "concepts": [],
        "total_image_usd": 0.0,
        "total_video_usd": 0.0,
        "retries": 0,
    }


def save_manifest(m: dict) -> None:
    m["total_usd"] = round(float(m.get("total_image_usd") or 0) + float(m.get("total_video_usd") or 0), 4)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(m, indent=2) + "\n")


def get_concept_entry(m: dict, cid: str) -> dict:
    for c in m.get("concepts") or []:
        if c.get("id") == cid:
            return c
    entry = {"id": cid}
    m.setdefault("concepts", []).append(entry)
    return entry


def ensure_source(concept: dict, spent: dict) -> None:
    cid = concept["id"]
    entry = get_concept_entry(load_manifest(), cid)
    dest = MASTERS / concept["source_filename"]
    i2v = MASTERS / concept["source_filename"].replace("_source.jpg", "_i2v_1920x1080.jpg")

    if dest.exists() and dest.stat().st_size > 80_000:
        print(f"SKIP source exists {cid}", flush=True)
        entry["source"] = entry.get("source") or {"path": str(dest), "qc": "PASS", "reused": True}
        save_manifest(load_manifest())
        return

    if concept.get("reuse_source"):
        src = Path(concept["reuse_source"])
        if not src.exists():
            raise RuntimeError(f"reuse missing {src}")
        shutil.copy2(src, dest)
        validate_source(dest)
        w, h = image_dimensions(dest)
        entry["source"] = {
            "path": str(dest),
            "qc": "PASS",
            "reused_from": str(src),
            "image_cost_usd": 0.0,
            "width": w,
            "height": h,
        }
        m = load_manifest()
        get_concept_entry(m, cid).update(entry)
        save_manifest(m)
        print(f"REUSE source {cid} from {src.name}", flush=True)
        return

    prompt = concept["image_prompt"]
    assert prompt
    last_err = None
    for attempt in range(1 + MAX_IMAGE_RETRIES):
        try:
            if spent["usd"] >= BUDGET_USD:
                raise SystemExit(f"STOP budget ${BUDGET_USD}")
            print(f"GENERATE source {cid} attempt {attempt + 1}", flush=True)
            job_id, cost = generate_image(prompt, dest)
            spent["usd"] += cost
            spent["image"] += cost
            w, h = image_dimensions(dest)
            entry["source"] = {
                "path": str(dest),
                "qc": "PASS",
                "model": IMAGE_MODEL,
                "job_id": job_id,
                "image_cost_usd": cost,
                "attempt": attempt + 1,
                "width": w,
                "height": h,
            }
            m = load_manifest()
            get_concept_entry(m, cid).update(entry)
            m["total_image_usd"] = round(float(m.get("total_image_usd") or 0) + cost, 4)
            save_manifest(m)
            return
        except Exception as exc:
            last_err = exc
            print(f"  source FAIL: {exc}", flush=True)
            m = load_manifest()
            m["retries"] = int(m.get("retries") or 0) + 1
            save_manifest(m)
            if dest.exists():
                dest.unlink(missing_ok=True)
    entry["source"] = {"qc": "FAIL", "error": str(last_err)[:400]}
    m = load_manifest()
    get_concept_entry(m, cid).update(entry)
    save_manifest(m)
    raise RuntimeError(f"source failed {cid}: {last_err}")


def ensure_i2v_crop(concept: dict) -> Path:
    dest = MASTERS / concept["source_filename"]
    i2v = MASTERS / concept["source_filename"].replace("_source.jpg", "_i2v_1920x1080.jpg")
    if not i2v.exists() or i2v.stat().st_size < 50_000:
        ensure_1920x1080(dest, i2v)
    return i2v


def run_video(concept: dict, spent: dict, conservative: bool = False) -> None:
    cid = concept["id"]
    m = load_manifest()
    entry = get_concept_entry(m, cid)
    if (entry.get("source") or {}).get("qc") != "PASS":
        print(f"SKIP video {cid} — no source", flush=True)
        return

    vdest = MASTERS / concept["video_filename"]
    if vdest.exists() and vdest.stat().st_size > 300_000:
        try:
            validate_video(vdest)
            print(f"SKIP video exists {cid}", flush=True)
            return
        except Exception:
            vdest.unlink(missing_ok=True)

    i2v = ensure_i2v_crop(concept)
    last_err = None
    for attempt in range(1 + MAX_VIDEO_RETRIES):
        try:
            if spent["usd"] >= BUDGET_USD:
                raise SystemExit(f"STOP budget ${BUDGET_USD}")
            print(f"SUBMIT video {cid} attempt {attempt + 1} conservative={conservative}", flush=True)
            request_id, est, hf_url = submit_video(i2v, concept["video_prompt"], conservative=conservative)
            spent["usd"] += est
            spent["video"] += est
            done = finish_video(request_id, vdest)
            probe = ffprobe_video(vdest)
            frames = qc_frames(vdest)
            poster_from_video(vdest, POSTERS / f"{cid}.jpg")
            entry["video"] = {
                "path": str(vdest),
                "qc": "PASS",
                "model": VIDEO_MODEL,
                "job_id": request_id,
                "video_cost_usd": est,
                "hf_upload_url": hf_url,
                "probe": probe,
                "qc_frames": frames,
                "attempt": attempt + 1,
                "conservative": conservative,
                "credits": done.get("credits"),
            }
            m = load_manifest()
            get_concept_entry(m, cid).update(entry)
            m["total_video_usd"] = round(float(m.get("total_video_usd") or 0) + est, 4)
            save_manifest(m)
            print(f"VIDEO OK {cid} ${est:.4f}", flush=True)
            return
        except Exception as exc:
            last_err = exc
            print(f"  video FAIL: {exc}", flush=True)
            m = load_manifest()
            m["retries"] = int(m.get("retries") or 0) + 1
            save_manifest(m)
            if vdest.exists():
                vdest.unlink(missing_ok=True)
            conservative = True
    entry["video"] = {"qc": "FAIL", "error": str(last_err)[:400]}
    m = load_manifest()
    get_concept_entry(m, cid).update(entry)
    save_manifest(m)
    raise RuntimeError(f"video failed {cid}: {last_err}")


def main() -> int:
    auth_header()
    MASTERS.mkdir(parents=True, exist_ok=True)
    spent = {"usd": 0.0, "image": 0.0, "video": 0.0}

    pending_videos: list[dict] = []

    for concept in CONCEPTS:
        ensure_source(concept, spent)
        i2v = ensure_i2v_crop(concept)
        if spent["usd"] >= BUDGET_USD:
            break
        # Submit video jobs back-to-back after each source (poll completes per concept for simpler resume)
        try:
            run_video(concept, spent)
        except Exception as exc:
            print(f"WARN {concept['id']}: {exc}", flush=True)

    m = load_manifest()
    m["finished_at"] = datetime.now(timezone.utc).isoformat()
    m["run_spent_image_usd"] = round(spent["image"], 4)
    m["run_spent_video_usd"] = round(spent["video"], 4)
    save_manifest(m)
    print(f"DONE manifest={MANIFEST} spent=${spent['usd']:.4f}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
