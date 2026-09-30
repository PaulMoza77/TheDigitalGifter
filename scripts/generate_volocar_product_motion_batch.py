#!/usr/bin/env python3
"""VoloCar Product Motion batch — four 16:9 source stills + 5s Kling 3.0 Pro I2V masters.

Pipelines image → I2V per concept; submits video jobs without waiting for all stills.
Credentials: HF_CREDENTIALS or scripts/_load_hf_credentials.sh (Mozas VPS).
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

HIGGSFIELD_API_BASE = "https://api.higgsfield.ai"
IMAGE_MODEL = "recraft/v4.1/pro/text-to-image"
VIDEO_MODEL = "kling-video/v3.0/pro/image-to-video"
DURATION = 5
BUDGET_USD = 12.0
MAX_IMAGE_RETRIES = 1
MAX_VIDEO_RETRIES = 1

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
MASTERS = ROOT / "public" / "assets" / "volocar" / "product-motion" / "masters"
POSTERS = ROOT / "public" / "assets" / "volocar" / "product-motion" / "posters"
SOURCE = ROOT / "source" / "volocar" / "product-motion"
MANIFEST = ROOT / "public" / "assets" / "volocar" / "product-motion" / "generation_manifest.json"

NEGATIVE_I2V = (
    " Do not morph faces, hands, vehicles, glass, buildings, or road geometry. "
    "No invented text, numbers, logos, captions, watermarks, UI, or readable signage. "
    "No wild camera spins or scene cuts. Subtle physically believable motion only. "
    "Preserve the first frame composition exactly."
)

CONCEPTS = [
    {
        "id": "01_volocar_zero_deposit",
        "sequence": 1,
        "name": "Zero Deposit",
        "source_filename": "01_volocar_zero_deposit_source.jpg",
        "video_filename": "01_volocar_zero_deposit_5s.mp4",
        "still_prompt": (
            "Premium abstract product visual, 16:9 landscape. Deep charcoal near-black void environment. "
            "A single elegant abstract object inspired by premium bank-card proportions but NOT a usable card: "
            "smoked glass layers, precision machined edges, restrained brushed metal accents, no embossing, "
            "no chip slot detail, no magnetic stripe text, completely blank surfaces. Floating slightly in space, "
            "soft studio rim light, subtle warm amber-orange reflection band on the glass edge like luxury automotive "
            "accent lighting. Apple product-film restraint, luxury automotive material design. "
            "No text, no numbers, no logos, no Visa, no names, no currency, no words anywhere in frame."
        ),
        "i2v_prompt": (
            "Premium abstract 16:9 product film. This exact frame comes alive for five seconds. "
            "Preserve the smoked-glass abstract card-like object, charcoal environment, and camera angle exactly. "
            "A thin controlled warm amber-orange light reflection travels slowly and precisely across and through "
            "the glass; as it passes, the glass becomes slightly clearer and lighter, less visually heavy — "
            "financial friction dissolving metaphorically. Motion very slow, luxurious, minimal. "
            "Camera drift almost imperceptible. No shattering, no particles, no money, no icons, no zero glyph."
            + NEGATIVE_I2V
        ),
    },
    {
        "id": "02_volocar_monthly",
        "sequence": 2,
        "name": "Monthly",
        "source_filename": "02_volocar_monthly_source.jpg",
        "video_filename": "02_volocar_monthly_5s.mp4",
        "still_prompt": (
            "Ultra photorealistic 16:9 cinematic photograph. ONE fixed composition: a contemporary premium attainable "
            "vehicle (Mercedes GLE or BMW X5 or Tesla Model Y class SUV, not a supercar) parked naturally in a driveway "
            "or quiet street outside a beautiful modern residential villa or apartment building with clean architecture "
            "and landscaping. Early morning soft cool light, long shadows, quiet atmosphere. Camera on tripod at human "
            "height, three-quarter front view of the car, car occupies moderate portion of frame with environment visible. "
            "No people required. No text, logos, license plate readable text, calendars, clocks, or numbers anywhere."
        ),
        "i2v_prompt": (
            "Photoreal cinematic 16:9. This exact photograph animates for five seconds as elegant controlled time-lapse "
            "around a completely unchanged vehicle. Preserve the exact same car model, color, wheels, trim, position, "
            "and camera lock-off framing. Time passes: early morning cool light transitions through clear daylight to "
            "warm golden evening and early night — sun direction shifts naturally, shadows rotate, ambient sky color "
            "changes, subtle window lights in the building gradually turn on. Subtle natural background life only. "
            "The car does NOT morph, move dramatically, or change color. No racing clouds, no montage cuts, no calendar."
            + NEGATIVE_I2V
        ),
    },
    {
        "id": "03_volocar_airport_delivery",
        "sequence": 3,
        "name": "Airport Delivery",
        "source_filename": "03_volocar_airport_delivery_source.jpg",
        "video_filename": "03_volocar_airport_delivery_5s.mp4",
        "still_prompt": (
            "Ultra photorealistic 16:9 photograph. Modern international airport terminal curbside passenger pickup zone, "
            "premium contemporary architecture, glass and stone, internationally plausible not tied to one city. "
            "Adult traveller with one tasteful rolling suitcase just outside terminal doors, natural walking pose, "
            "not looking at camera. Mid-ground: premium SUV (Mercedes GLC or BMW X5 class) legally parked at curbside. "
            "Professional host in dark smart casual standing beside driver door, hand on door handle beginning to open "
            "the front passenger door. Correct hands, fingers, faces, door geometry, suitcase wheels. Documentary observed "
            "moment, no posing. No readable airline logos, no giant signage text, no private jet, no runway, no impossible "
            "vehicle placement. No text or watermark."
        ),
        "i2v_prompt": (
            "Photoreal cinematic 16:9 airport curbside. Five seconds from this exact frame. Preserve traveller, suitcase, "
            "terminal architecture, premium SUV, and host exactly — same people, same car, same positions. "
            "Very subtle camera drift or gentle rack focus that reveals the waiting vehicle beside the traveller. "
            "The professional host smoothly opens the front passenger door a modest amount — natural service gesture. "
            "Traveller continues a small natural step forward. No luggage loading, no handshake, no keys, no entering car, "
            "no car driving away. Minimal motion, high realism in hands and faces."
            + NEGATIVE_I2V
        ),
    },
    {
        "id": "04_volocar_supercars",
        "sequence": 4,
        "name": "Supercars",
        "source_filename": "04_volocar_supercars_source.jpg",
        "video_filename": "04_volocar_supercars_5s.mp4",
        "still_prompt": (
            "Ultra photorealistic 16:9 cinematic photograph, golden hour approaching early evening on Palm Jumeirah Dubai. "
            "Green Lamborghini Huracán EVO Spyder convertible, roof down, driving on a believable coastal road with "
            "Palm Jumeirah luxury hotel architecture and sea visible; distant Burj Al Arab only if geographically plausible "
            "in this angle, otherwise omit. Camera slightly wider than car commercial — environment breathes, car not "
            "filling entire frame. Warm sunlight, realistic sea and sky, natural reflections, sparse natural traffic. "
            "High-budget travel footage feeling, not black-background ad. No drift, smoke, speed ramp, fake lens flare, "
            "cyberpunk grade, or empty impossible roads. No text or logos."
        ),
        "i2v_prompt": (
            "Photoreal cinematic 16:9 Palm Jumeirah Dubai golden hour. Five seconds from this exact frame. "
            "Preserve green Lamborghini Huracán EVO Spyder roof-down, paint, wheels, Dubai coastal environment, "
            "architecture, sea, sky, and camera perspective exactly. Restrained tracking shot alongside the car at "
            "natural cruising speed — wheels rotate correctly, gentle parallax on hotels and sea, warm sunlight shifts "
            "subtly on bodywork. No aggressive acceleration, orbit, drift, smoke, or morphing vehicle. "
            "Feels like genuine premium travel footage."
            + NEGATIVE_I2V
        ),
    },
]

_auth_lock = threading.Lock()


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
    with _auth_lock:
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


def poll_request(request_id: str, max_attempts: int = 120, sleep_s: float = 5.0) -> dict:
    for _ in range(max_attempts):
        body = hf_json("GET", f"/requests/{request_id}/status")
        status = str(body.get("status") or "").lower()
        if status in {"completed", "succeeded", "success"}:
            return body
        if status in {"failed", "error", "cancelled", "nsfw"}:
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
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-volocar-product-motion/higgsfield"})
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


def poster_from_source(source: Path, poster: Path) -> None:
    poster.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", str(source), "-vf", "scale=1920:1080", "-q:v", "2", "-frames:v", "1", str(poster)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


class CostTracker:
    def __init__(self) -> None:
        self.image_usd = 0.0
        self.video_usd = 0.0
        self.image_retries = 0
        self.video_retries = 0
        self.lock = threading.Lock()

    def add_image(self, usd: float, retry: bool = False) -> None:
        with self.lock:
            self.image_usd += usd
            if retry:
                self.image_retries += 1

    def add_video(self, usd: float, retry: bool = False) -> None:
        with self.lock:
            self.video_usd += usd
            if retry:
                self.video_retries += 1

    @property
    def total(self) -> float:
        return self.image_usd + self.video_usd


cost = CostTracker()


def generate_still(concept: dict, attempt: int) -> dict:
    dest = MASTERS / concept["source_filename"]
    est = parse_usd(hf_json("POST", f"/estimate/{IMAGE_MODEL}", {"prompt": concept["still_prompt"], "aspect_ratio": "16:9"}))
    if cost.total + est > BUDGET_USD:
        raise SystemExit(f"STOP: budget would exceed ${BUDGET_USD:.2f}")
    sub = hf_json("POST", f"/{IMAGE_MODEL}", {"prompt": concept["still_prompt"], "aspect_ratio": "16:9"})
    request_id = str(sub.get("request_id") or "")
    if not request_id:
        raise RuntimeError(f"still submit failed: {sub}")
    done = poll_request(request_id)
    url = image_url_from_status(done)
    if not url:
        raise RuntimeError("still missing url")
    download(url, dest)
    w, h = image_dimensions(dest)
    if h and abs(w / h - 16 / 9) > 0.12:
        raise RuntimeError(f"bad aspect {w}x{h}")
    cost.add_image(est, retry=attempt > 1)
    return {
        "step": "source",
        "qc": "PASS",
        "model": IMAGE_MODEL,
        "job_id": request_id,
        "path": str(dest),
        "generation_cost_usd": est,
        "width": w,
        "height": h,
        "attempt": attempt,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def submit_video_job(concept: dict, i2v_path: Path, conservative: bool = False) -> tuple[str, float]:
    public_url = upload_image(i2v_path)
    prompt = concept["i2v_prompt"]
    if conservative:
        prompt = (
            "Extremely minimal motion. Almost static cinematic hold with micro-movement only. "
            + prompt
        )
    est = parse_usd(
        hf_json(
            "POST",
            f"/estimate/{VIDEO_MODEL}",
            {"image_url": public_url, "prompt": prompt, "duration": DURATION, "sound": "off"},
        )
    )
    if cost.total + est > BUDGET_USD:
        raise SystemExit(f"STOP: budget would exceed ${BUDGET_USD:.2f}")
    sub = hf_json(
        "POST",
        f"/{VIDEO_MODEL}",
        {"image_url": public_url, "prompt": prompt, "duration": DURATION, "sound": "off"},
    )
    request_id = str(sub.get("request_id") or "")
    if not request_id:
        raise RuntimeError(f"video submit failed: {sub}")
    return request_id, est


def finish_video(concept: dict, request_id: str, est: float, attempt: int) -> dict:
    done = poll_request(request_id, max_attempts=150, sleep_s=5.0)
    vurl = video_url_from_status(done)
    if not vurl:
        raise RuntimeError("video missing url")
    video_path = MASTERS / concept["video_filename"]
    download(vurl, video_path)
    probe = ffprobe(video_path)
    if probe["size"] < 200_000:
        raise RuntimeError(f"video too small {probe}")
    poster = POSTERS / concept["video_filename"].replace(".mp4", ".jpg")
    poster_from_source(MASTERS / concept["source_filename"], poster)
    cost.add_video(est, retry=attempt > 1)
    return {
        "step": "video",
        "qc": "PASS",
        "model": VIDEO_MODEL,
        "job_id": request_id,
        "path": str(video_path),
        "poster": str(poster),
        "generation_cost_usd": est,
        "probe": probe,
        "attempt": attempt,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def ensure_source(concept: dict, entry: dict) -> bool:
    source_path = MASTERS / concept["source_filename"]
    if source_path.exists() and source_path.stat().st_size > 80_000:
        print(f"REUSE source {concept['id']}", flush=True)
        entry["source"] = entry.get("source") or {
            "step": "source",
            "qc": "PASS",
            "reused": True,
            "path": str(source_path),
        }
        return True
    print(f"STILL {concept['id']}", flush=True)
    last_err = None
    for attempt in range(1, 2 + MAX_IMAGE_RETRIES):
        try:
            entry["source"] = generate_still(concept, attempt)
            print(f"  STILL OK {source_path}", flush=True)
            return True
        except Exception as exc:
            last_err = exc
            print(f"  STILL FAIL attempt {attempt}: {exc}", flush=True)
    entry["source"] = {"step": "source", "qc": "FAIL", "error": str(last_err)[:500]}
    return False


def prepare_i2v_crop(concept: dict) -> Path:
    source_path = MASTERS / concept["source_filename"]
    i2v_path = SOURCE / concept["source_filename"].replace("_source.jpg", "_1920x1080.jpg")
    if not i2v_path.exists() or i2v_path.stat().st_size < 80_000:
        ensure_1920x1080(source_path, i2v_path)
    return i2v_path


PendingVideo = tuple[dict, dict, str, float, int]


def collect_pending_video(concept: dict, entry: dict) -> PendingVideo | None:
    video_path = MASTERS / concept["video_filename"]
    if video_path.exists() and video_path.stat().st_size > 500_000:
        print(f"REUSE video {concept['id']}", flush=True)
        entry["video"] = entry.get("video") or {
            "step": "video",
            "qc": "PASS",
            "reused": True,
            "path": str(video_path),
        }
        return None
    i2v_path = prepare_i2v_crop(concept)
    print(f"I2V submit {concept['id']}", flush=True)
    last_err = None
    for attempt in range(1, 2 + MAX_VIDEO_RETRIES):
        try:
            request_id, est = submit_video_job(concept, i2v_path, conservative=attempt > 1)
            print(f"  job={request_id} est=${est:.4f} attempt={attempt}", flush=True)
            return (concept, entry, request_id, est, attempt)
        except Exception as exc:
            last_err = exc
            print(f"  SUBMIT FAIL attempt {attempt}: {exc}", flush=True)
    entry["video"] = {"step": "video", "qc": "FAIL", "error": str(last_err)[:500]}
    return None


def resolve_pending(pending: PendingVideo) -> None:
    concept, entry, request_id, est, attempt = pending
    video_path = MASTERS / concept["video_filename"]
    try:
        entry["video"] = finish_video(concept, request_id, est, attempt)
        print(f"  VIDEO OK {video_path}", flush=True)
    except Exception as exc:
        print(f"  VIDEO FAIL {concept['id']} attempt {attempt}: {exc}", flush=True)
        if attempt <= MAX_VIDEO_RETRIES:
            try:
                i2v_path = prepare_i2v_crop(concept)
                request_id2, est2 = submit_video_job(concept, i2v_path, conservative=True)
                print(f"  RETRY job={request_id2}", flush=True)
                entry["video"] = finish_video(concept, request_id2, est2, attempt + 1)
                print(f"  VIDEO OK retry {video_path}", flush=True)
            except Exception as exc2:
                entry["video"] = {"step": "video", "qc": "FAIL", "error": str(exc2)[:500]}
        else:
            entry["video"] = {"step": "video", "qc": "FAIL", "error": str(exc)[:500]}


def write_manifest(manifest: dict) -> None:
    manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
    manifest["total_image_usd"] = round(cost.image_usd, 4)
    manifest["total_video_usd"] = round(cost.video_usd, 4)
    manifest["total_usd"] = round(cost.total, 4)
    manifest["image_retries"] = cost.image_retries
    manifest["video_retries"] = cost.video_retries
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")


def main() -> int:
    auth_header()
    MASTERS.mkdir(parents=True, exist_ok=True)
    SOURCE.mkdir(parents=True, exist_ok=True)

    manifest: dict = {"concepts": [], "provider": "higgsfield", "batch": "volocar_product_motion"}
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text())

    pending_videos: list[PendingVideo] = []

    for concept in CONCEPTS:
        entry = next((c for c in manifest.get("concepts", []) if c.get("id") == concept["id"]), None) or {
            "id": concept["id"],
            "sequence": concept["sequence"],
            "name": concept["name"],
            "collection": "product_motion",
            "project": "volocar",
        }
        if ensure_source(concept, entry):
            job = collect_pending_video(concept, entry)
            if job:
                pending_videos.append(job)
        entry["cost_usd"] = round(
            float(entry.get("source", {}).get("generation_cost_usd") or 0)
            + float(entry.get("video", {}).get("generation_cost_usd") or 0),
            4,
        )
        manifest["concepts"] = [c for c in manifest.get("concepts", []) if c.get("id") != concept["id"]]
        manifest["concepts"].append(entry)
        write_manifest(manifest)

    if pending_videos:
        with ThreadPoolExecutor(max_workers=min(4, len(pending_videos))) as pool:
            futures = [pool.submit(resolve_pending, p) for p in pending_videos]
            for fut in as_completed(futures):
                fut.result()
        for entry in manifest["concepts"]:
            entry["cost_usd"] = round(
                float(entry.get("source", {}).get("generation_cost_usd") or 0)
                + float(entry.get("video", {}).get("generation_cost_usd") or 0),
                4,
            )
        write_manifest(manifest)

    manifest["concepts"] = sorted(manifest["concepts"], key=lambda c: c.get("sequence", 0))
    write_manifest(manifest)
    print(
        f"DONE image=${cost.image_usd:.4f} video=${cost.video_usd:.4f} total=${cost.total:.4f} manifest={MANIFEST}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
