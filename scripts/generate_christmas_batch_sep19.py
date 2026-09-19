#!/usr/bin/env python3
"""Generate 5 Higgsfield Kling 3.0 Pro I2V masters (5s, sound=off) for Sep 19 stills.

Fails closed if Higgsfield credentials are missing. Never uses Replicate.
Credentials: HF_CREDENTIALS=KEY_ID:KEY_SECRET (or HF_API_KEY_ID + HF_API_KEY_SECRET).
Never print credential values.
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
MODEL_ID = "kling-video/v3.0/pro/image-to-video"
ESTIMATE_PATH = "/estimate/kling-video/v3.0/pro/image-to-video"
SUBMIT_PATH = "/kling-video/v3.0/pro/image-to-video"
DURATION = 5
# Five clips at the Sep 18 live rate (~$0.28) plus one technical retry headroom.
BUDGET_USD = 2.00

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
SOURCE = Path(os.environ.get("TDG_SOURCE") or (ROOT / "source" / "batch-sep19"))
MASTERS = Path(os.environ.get("TDG_MASTERS") or (ROOT / "public" / "assets" / "christmas" / "reels" / "masters"))
FINALS = Path(os.environ.get("TDG_FINALS") or (ROOT / "public" / "assets" / "christmas" / "reels" / "final"))
POSTERS = Path(os.environ.get("TDG_POSTERS") or (ROOT / "public" / "assets" / "christmas" / "reels" / "posters"))
QC = Path(os.environ.get("TDG_QC") or (ROOT / "generated" / "batch-sep19" / "qc"))
LOG = Path(os.environ.get("TDG_LOG") or (ROOT / "public" / "assets" / "christmas" / "reels" / "generation_manifest_sep19.json"))
GENLOG = Path(os.environ.get("TDG_GENLOG") or (ROOT / "generated" / "batch-sep19" / "generation_log.json"))

CLIPS = [
    {
        "id": "christmas_master_06",
        "filename": "christmas_master_06.mp4",
        "image": SOURCE / "01_village_balcony_girl_1080x1920.png",
        "source_still": "01_village_balcony_girl.jpg",
        "title": "Village balcony girl + teddy",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas night. This exact photograph comes alive for five seconds. "
            "Preserve the girl in the red knit hat, her face, hair, red-and-cream sweater, teddy bear, wooden "
            "balcony railing, lantern, wrapped gifts with red bows, garlands, snowman, stone bridge, ice rink, "
            "giant Christmas tree, village houses, castle, mountains, moon, and Santa's distant sleigh exactly "
            "as in the first frame. Natural sparse snowfall. Lantern flame flickers extremely subtly. Fairy lights "
            "twinkle very softly. Distant ice-skaters make tiny natural movements. Chimney smoke rises. Water "
            "reflections drift. Santa's sleigh glides slowly along the same sky path. Very slow cinematic push-in "
            "from the balcony with slight foreground-background parallax. Architecture, faces, and gifts stay rigid. "
            "Do not add text, logos, extra people, extra limbs, or morphing. Archival-cinematic luxury Christmas footage."
        ),
    },
    {
        "id": "christmas_master_07",
        "filename": "christmas_master_07.mp4",
        "image": SOURCE / "02_santa_child_aurora_1080x1920.png",
        "source_still": "02_santa_child_aurora.jpg",
        "title": "Santa and child watching sleigh",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas night. This exact photograph comes alive for five seconds. "
            "Preserve Santa's face, beard, red suit, the child in the cream knit hat pointing, the golden retriever, "
            "plaid blankets, lantern, hot cocoa mugs, cookies, wrapped gifts, wooden sign reading SOME PLACES STILL "
            "BELIEVE, lake, village, castle, moon, aurora, and the distant sleigh exactly as in the first frame. "
            "The child keeps the same pointing pose with only a tiny natural arm settle. Santa breathes and may blink. "
            "The dog's fur shifts slightly; it does not stand up. Aurora drifts slowly. Distant sleigh glides on the "
            "same path. Lantern flame flickers. Steam from cocoa. Soft snowfall. Very slow cinematic push-in. "
            "Do not mutate the sign letters. No extra people, no face morph, no new objects. Warm emotional Christmas film."
        ),
    },
    {
        "id": "christmas_master_08",
        "filename": "christmas_master_08.mp4",
        "image": SOURCE / "03_santa_sleigh_believe_1080x1920.png",
        "source_still": "03_santa_sleigh_believe.jpg",
        "title": "Santa sleigh over alpine village",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas night from Santa's sleigh. This exact photograph comes alive for "
            "five seconds. Preserve Santa's face, beard, red suit, the reindeer anatomy, harnesses, gift pile, "
            "garland, lantern, BELIEVE GOOD THINGS STILL HAPPEN sign, lake, stone bridge, village, castle, "
            "mountains, and moon exactly as in the first frame. The sleigh eases slightly forward through the air "
            "with physically believable motion. Reindeer make small realistic gait/head movements. Lantern flame "
            "flickers. Gift ribbons shift slightly. Soft snowfall. Water reflections drift. Very slow camera with "
            "tiny tracking, not a wild flyover. Architecture stays rigid. Do not mutate sign text. No extra reindeer, "
            "no warped antlers, no extra limbs, no morphing Santa. Luxury Christmas movie footage."
        ),
    },
    {
        "id": "christmas_master_09",
        "filename": "christmas_master_09.mp4",
        "image": SOURCE / "04_polar_express_interior_1080x1920.png",
        "source_still": "04_polar_express_interior.jpg",
        "title": "Polar Express train interior",
        "prompt": (
            "Photoreal cinematic 9:16 Polar Express interior. This exact photograph comes alive for five seconds. "
            "Preserve the girl with the red hair bow, her cream sweater, teddy bear, THE POLAR EXPRESS seat, "
            "Santa hat on the opposite seat, gingerbread cookies, cocoa mug, brass lantern, wood paneling, "
            "window view of the castle, viaduct, river, and mountains exactly as in the first frame. The girl "
            "breathes and may blink; she does not turn into a different person. Outside, the landscape drifts "
            "slowly past the window as if the train is moving gently. Lantern flame flickers. Cocoa steam. "
            "Fairy lights twinkle. Subtle reflections on the window glass. Extremely slow cinematic camera. "
            "Do not warp the train interior, castle, or cookies. No added text or logos. Emotional Christmas film."
        ),
    },
    {
        "id": "christmas_master_10",
        "filename": "christmas_master_10.mp4",
        "image": SOURCE / "05_polar_express_station_1080x1920.png",
        "source_still": "05_polar_express_station.jpg",
        "title": "Polar Express locomotive at station",
        "prompt": (
            "Photoreal cinematic 9:16 Polar Express locomotive at a snowy station. This exact photograph comes "
            "alive for five seconds. Preserve the black steam locomotive number 1225, wreath, headlamp, steam, "
            "cars, wet rails, station lanterns, BELIEVE ALL ABOARD FOR A BRIGHTER TOMORROW sign, the girl in the "
            "red coat and knit hat holding a lantern, mountains, moon, and viaduct exactly as in the first frame. "
            "The train eases slowly forward toward camera with correct wheel and steam physics. Thick steam and "
            "smoke drift naturally. Headlamp glows steadily. Station lights twinkle. Soft snowfall. The girl "
            "stands still with only tiny coat/hat movement and a small breath in the cold. Very slow cinematic "
            "push-in. Do not break wheels, warp the locomotive, mutate sign letters, or add extra people. "
            "Luxury Christmas movie opening shot."
        ),
    },
]


def read_credentials() -> tuple[str, str]:
    combined = (os.environ.get("HF_CREDENTIALS") or os.environ.get("HF_KEY") or "").strip()
    if ":" in combined:
        key_id, secret = combined.split(":", 1)
        key_id, secret = key_id.strip(), secret.strip()
        if key_id and secret:
            return key_id, secret
    key_id = (os.environ.get("HF_API_KEY_ID") or os.environ.get("HF_API_KEY") or "").strip()
    secret = (os.environ.get("HF_API_KEY_SECRET") or os.environ.get("HF_SECRET") or os.environ.get("HF_API_SECRET") or "").strip()
    if key_id and secret:
        return key_id, secret
    print(
        "BLOCKED: Higgsfield credentials missing. Set HF_CREDENTIALS on the job runner "
        "(VPS container thedigitalgifter). Fail closed — no Replicate fallback.",
        file=sys.stderr,
    )
    raise SystemExit(2)


def auth_header() -> str:
    key_id, secret = read_credentials()
    return f"Key {key_id}:{secret}"


def hf_request(method: str, path_or_url: str, data: dict | None = None, timeout: int = 180) -> dict:
    url = path_or_url if path_or_url.startswith("http") else f"{HIGGSFIELD_API_BASE}{path_or_url}"
    body = None if data is None else json.dumps(data).encode()
    headers = {
        "Authorization": auth_header(),
        "User-Agent": "tdg-christmas-batch-sep19/higgsfield",
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"{method} {url} -> {e.code} {err[:800]}") from e


def parse_estimate(body: object) -> dict:
    if not isinstance(body, dict):
        raise RuntimeError(f"estimate response not an object: {body!r}")
    usd_raw = body.get("usd")
    usd = float(usd_raw) if usd_raw is not None else float("nan")
    if not (usd >= 0):
        raise RuntimeError(f"live estimate missing usd: {body}")
    credits = body.get("credits")
    return {"usd": usd, "credits": None if credits is None else str(credits), "raw": body}


def video_url_from_status(body: dict) -> str | None:
    video = body.get("video")
    if isinstance(video, dict) and isinstance(video.get("url"), str):
        return video["url"]
    if isinstance(body.get("video_url"), str):
        return body["video_url"]
    images = body.get("images")
    if isinstance(images, list) and images:
        first = images[0]
        if isinstance(first, dict) and isinstance(first.get("url"), str):
            return first["url"]
    return None


def upload_image(path: Path) -> str:
    ctype = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    meta = hf_request("POST", "/files/generate-upload-url", {"content_type": ctype})
    public_url = meta.get("public_url")
    upload_url = meta.get("upload_url")
    if not public_url or not upload_url:
        raise RuntimeError(f"upload URL missing fields: keys={list(meta.keys())}")
    headers = dict(meta.get("upload_headers") or {"Content-Type": ctype})
    data = path.read_bytes()
    req = urllib.request.Request(str(upload_url), data=data, method="PUT", headers=headers)
    with urllib.request.urlopen(req, timeout=180) as resp:
        resp.read()
    return str(public_url)


def clip_payload(image_url: str, prompt: str) -> dict:
    return {
        "image_url": image_url,
        "prompt": prompt,
        "duration": DURATION,
        "sound": "off",
    }


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-christmas-batch-sep19/higgsfield"})
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
            "stream=width,height,avg_frame_rate,codec_name,duration,bit_rate",
            "-show_entries",
            "format=duration,bit_rate,size",
            "-of",
            "json",
            str(path),
        ]
    )
    return json.loads(raw)


def probe_summary(path: Path) -> dict:
    data = ffprobe(path)
    stream = (data.get("streams") or [{}])[0]
    fmt = data.get("format") or {}
    fps_txt = stream.get("avg_frame_rate") or "0/1"
    if "/" in str(fps_txt):
        num, den = str(fps_txt).split("/")
        fps = float(num) / float(den) if float(den) else 0.0
    else:
        fps = float(fps_txt or 0)
    return {
        "filename": path.name,
        "path": str(path),
        "duration": float(fmt.get("duration") or stream.get("duration") or 0),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "codec": stream.get("codec_name"),
        "fps": round(fps, 3),
        "bitrate": int(fmt.get("bit_rate") or stream.get("bit_rate") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
    }


def validate_master(info: dict) -> None:
    if info["width"] < 1080 or info["height"] < 1080:
        raise RuntimeError(f"{info['filename']} too small: {info['width']}x{info['height']}")
    if info["duration"] < 4.5 or info["duration"] > 6.5:
        raise RuntimeError(f"{info['filename']} duration {info['duration']}")
    if info["size"] < 200_000:
        raise RuntimeError(f"{info['filename']} looks empty/corrupt ({info['size']} bytes)")


def ffmpeg_available() -> bool:
    return bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))


def extract_qc_frames(src: Path) -> list[Path]:
    QC.mkdir(parents=True, exist_ok=True)
    out = []
    for label, t in (("first", 0.12), ("mid", 2.4), ("last", 4.7)):
        dest = QC / f"{src.stem}_{label}.jpg"
        subprocess.check_call(
            ["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        out.append(dest)
    return out


def poster(src: Path, dest: Path, t: float = 0.4) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def verify_auth() -> None:
    print("HIGGSFIELD_AUTH: ping generate-upload-url", flush=True)
    meta = hf_request("POST", "/files/generate-upload-url", {"content_type": "image/png"})
    if not meta.get("upload_url"):
        raise RuntimeError("HIGGSFIELD_AUTH FAIL: upload URL response missing upload_url")
    print("HIGGSFIELD_AUTH: PASS", flush=True)
    print(f"MODEL: {MODEL_ID}", flush=True)


def poll_job(request_id: str, timeout_s: int = 1200) -> dict:
    start = time.time()
    while time.time() - start < timeout_s:
        current = hf_request("GET", f"/requests/{request_id}/status")
        status = str(current.get("status") or "")
        print(f"  {request_id} {status}", flush=True)
        if status.lower() in {"completed", "succeeded", "failed", "nsfw", "canceled", "cancelled", "error"}:
            return current
        time.sleep(8)
    raise TimeoutError(f"Higgsfield job {request_id} timed out")


def submit_and_download(clip: dict, est: dict) -> dict:
    payload = clip_payload(clip["_image_url"], clip["prompt"])
    print(f"Submitting {clip['id']}...", flush=True)
    submitted = hf_request("POST", SUBMIT_PATH, payload)
    request_id = submitted.get("request_id")
    if not request_id:
        raise RuntimeError(f"submit missing request_id: {submitted}")
    print(f"  job={request_id} status={submitted.get('status')}", flush=True)
    done = poll_job(str(request_id))
    status = str(done.get("status") or "").lower()
    if status not in {"completed", "succeeded"}:
        raise RuntimeError(f"{clip['id']} failed: status={done.get('status')} error={done.get('error')}")
    url = video_url_from_status(done)
    if not url:
        raise RuntimeError(f"{clip['id']} missing video url: keys={list(done.keys())}")
    dest = MASTERS / clip["filename"]
    print(f"Downloading {clip['id']} -> {dest}", flush=True)
    download(url, dest)
    info = probe_summary(dest)
    validate_master(info)
    print(
        f"FFPROBE {info['filename']} {info['width']}x{info['height']} "
        f"{info['duration']:.3f}s {info['codec']} {info['fps']}fps",
        flush=True,
    )
    frames = extract_qc_frames(dest)
    poster(dest, POSTERS / f"{clip['id']}.jpg")
    return {
        "id": clip["id"],
        "title": clip["title"],
        "source_image": clip["source_still"],
        "job_id": str(request_id),
        "model": MODEL_ID,
        "prompt": clip["prompt"],
        "generation_cost_usd": est["usd"],
        "credits": est["credits"],
        "file": str(dest),
        "probe": info,
        "qc_frames": [str(p) for p in frames],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    estimate_only = "--estimate-only" in sys.argv
    read_credentials()
    verify_auth()

    MASTERS.mkdir(parents=True, exist_ok=True)
    GENLOG.parent.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)

    uploads: dict[str, str] = {}
    for clip in CLIPS:
        if not clip["image"].exists():
            raise SystemExit(f"missing still {clip['image']}")
        print(f"Uploading {clip['image'].name}...", flush=True)
        uploads[clip["id"]] = upload_image(clip["image"])
        clip["_image_url"] = uploads[clip["id"]]

    estimates = []
    total_usd = 0.0
    print("=" * 72)
    print("LIVE HIGGSFIELD ESTIMATE")
    print(f"MODEL: {MODEL_ID}")
    for clip in CLIPS:
        payload = clip_payload(uploads[clip["id"]], clip["prompt"])
        body = hf_request("POST", ESTIMATE_PATH, payload)
        est = parse_estimate(body)
        estimates.append({"id": clip["id"], **est})
        total_usd += est["usd"]
        print(f"  {clip['id']}: ${est['usd']:.4f}  credits={est['credits']}", flush=True)
    print(f"ESTIMATED_COST (5 clips): ${total_usd:.4f}")
    print("=" * 72, flush=True)

    if total_usd > BUDGET_USD:
        print(f"STOP: live Higgsfield total ${total_usd:.4f} exceeds ${BUDGET_USD:.2f}", flush=True)
        LOG.parent.mkdir(parents=True, exist_ok=True)
        LOG.write_text(
            json.dumps(
                {
                    "status": "BLOCKED_PRICE",
                    "provider": "higgsfield",
                    "model": MODEL_ID,
                    "estimated_total_usd": total_usd,
                    "estimates": [{k: v for k, v in row.items() if k != "raw"} for row in estimates],
                },
                indent=2,
            )
            + "\n"
        )
        return 3

    if estimate_only:
        print("estimate-only: not submitting paid jobs", flush=True)
        GENLOG.write_text(
            json.dumps(
                {
                    "status": "ESTIMATE_ONLY",
                    "provider": "higgsfield",
                    "model": MODEL_ID,
                    "estimated_total_usd": total_usd,
                    "estimates": [{k: v for k, v in row.items() if k != "raw"} for row in estimates],
                },
                indent=2,
            )
            + "\n"
        )
        return 0

    print(f"PRICE CHECK: total ${total_usd:.4f} <= ${BUDGET_USD:.2f} — proceeding", flush=True)
    log = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "provider": "higgsfield",
        "model": MODEL_ID,
        "duration": DURATION,
        "sound": "off",
        "estimated_total_usd": total_usd,
        "regenerations": 0,
        "clips": [],
        "reels": [],
    }

    for clip, est in zip(CLIPS, estimates):
        try:
            entry = submit_and_download(clip, est)
        except Exception as err:
            print(f"TECHNICAL FAIL {clip['id']}: {err} — retrying once", flush=True)
            log["regenerations"] += 1
            time.sleep(4)
            entry = submit_and_download(clip, est)
        log["clips"].append(entry)
        GENLOG.write_text(json.dumps(log, indent=2) + "\n")
        LOG.write_text(json.dumps(log, indent=2) + "\n")
        time.sleep(2)

    log["status"] = "MASTERS_READY"
    log["actual_cost_usd"] = round(sum(c["generation_cost_usd"] for c in log["clips"]), 4)
    LOG.write_text(json.dumps(log, indent=2) + "\n")
    GENLOG.write_text(json.dumps(log, indent=2) + "\n")
    print("Masters ready. Assemble reels after visual QC.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
