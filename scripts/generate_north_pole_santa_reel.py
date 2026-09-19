#!/usr/bin/env python3
"""Generate 4 Higgsfield Kling 3.0 Pro I2V clips for the North Pole Santa reel.

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
# Four clips at the live Sep 19 rate (~$0.28) plus one conservative regen.
BUDGET_USD = 2.00

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
SOURCE = Path(os.environ.get("TDG_SOURCE") or (ROOT / "source" / "north-pole-santa"))
MASTERS = Path(
    os.environ.get("TDG_MASTERS") or (ROOT / "public" / "assets" / "christmas" / "north-pole-santa" / "masters")
)
POSTERS = Path(
    os.environ.get("TDG_POSTERS") or (ROOT / "public" / "assets" / "christmas" / "north-pole-santa" / "posters")
)
QC = Path(os.environ.get("TDG_QC") or (ROOT / "generated" / "north-pole-santa" / "qc"))
LOG = Path(
    os.environ.get("TDG_LOG")
    or (ROOT / "public" / "assets" / "christmas" / "north-pole-santa" / "generation_manifest.json")
)
GENLOG = Path(os.environ.get("TDG_GENLOG") or (ROOT / "generated" / "north-pole-santa" / "generation_log.json"))

CLIPS = [
    {
        "id": "santa_01_workshop",
        "filename": "santa_01_workshop.mp4",
        "image": SOURCE / "01_workshop_wrapping_1080x1920.png",
        "source_still": "01_workshop_wrapping_1080x1920.jpg",
        "title": "North Pole toy workshop wrapping",
        "conservative_prompt": False,
        "prompt": (
            "Photoreal cinematic 9:16 Christmas film. This exact North Pole toy workshop photograph comes alive for five seconds. "
            "Preserve Santa's face, glasses, beard, red suit, white gloves, the two elf children, teddy bear, wrapped gifts, "
            "wooden table, lantern, parchment scroll, wooden crate reading SPREADING JOY WORLDWIDE, NORTH POLE TOY WORKSHOP "
            "sign, window, shelves of toys, and every letter of visible text exactly as in the first frame. "
            "Very slow expensive cinematic camera push toward Santa tying the red ribbon. Stabilized tripod, no handheld shake. "
            "Santa's gloved hands complete one small natural ribbon-tie motion. Elves keep the same poses with tiny working "
            "hand movement only. Candle flame in the lantern flickers naturally. Christmas lights shimmer gently, never pulse. "
            "Soft steam rises from the red SANTA FUEL mug. Tiny dust motes in warm light. Foreground gifts stay still; "
            "background elves move slower than Santa. Do not morph faces, hands, architecture, signs, or wrapping paper. "
            "Do not add people. Archival cinematic footage filmed inside Santa's workshop."
        ),
    },
    {
        "id": "santa_02_sleigh",
        "filename": "santa_02_sleigh.mp4",
        "image": SOURCE / "02_sleigh_loading_1080x1920.png",
        "source_still": "02_sleigh_loading_1080x1920.jpg",
        "title": "Santa loading the sleigh",
        "conservative_prompt": False,
        "prompt": (
            "Photoreal cinematic 9:16 Christmas night at the North Pole. This exact photograph comes alive for five seconds. "
            "Preserve Santa's face, beard, red suit, the red-and-gold sleigh, reindeer, gift sack reading Delivering Happiness "
            "Worldwide, NORTH POLE sign, wooden SLEIGH CHECKLIST crate, lanterns, wreaths, elves in the doorway, snow, and "
            "all signage letters exactly as in the first frame. Slow stabilized cinematic glide toward Santa loading gifts. "
            "Natural falling snow at different depths and speeds. Aurora drifts almost imperceptibly across the sky. "
            "Lantern flames flicker. Reindeer breathe visible cold air and one ear twitches; they do not walk away. "
            "Santa settles a gift into the sleigh with one small realistic motion. Subtle steam from the workshop doorway. "
            "Christmas lights shimmer softly. Wet-snow reflections. Architecture, sleigh runners, and faces stay rigid. "
            "No extra reindeer, no warped antlers, no mutated text. Luxury Christmas commercial filmed outdoors."
        ),
    },
    {
        "id": "santa_03_desk",
        "filename": "santa_03_desk.mp4",
        "image": SOURCE / "03_snow_globe_desk_1080x1920.png",
        "source_still": "03_snow_globe_desk_1080x1920.jpg",
        "title": "Santa polishing the snow globe",
        "conservative_prompt": False,
        "prompt": (
            "Photoreal cinematic 9:16 warm Christmas interior. This exact photograph comes alive for five seconds. "
            "Preserve Santa's face, glasses, beard, red coat, leather apron, white gloves, the snow globe cottage, "
            "red mug reading FUELED BY COOKIES AND CHRISTMAS MAGIC, chocolate-chip cookies, wooden toy train, "
            "Today checklist parchment, lantern, NORTH POLE sign, reindeer at the window, and all text exactly as in "
            "the first frame. Extremely slow cinematic push toward Santa and the snow globe. Santa gently wipes the "
            "globe once with the cloth; hands stay anatomically correct. Tiny snow swirls inside the globe. "
            "Steam rises from the coffee. Candle lantern flickers. Window snow falls gently. Christmas lights shimmer. "
            "Reindeer outside may blink once and breathe. Do not change faces, mug lettering, checklist words, or "
            "workshop architecture. Warm, intimate, human Christmas film — not luxury advertising."
        ),
    },
    {
        "id": "santa_04_sweep",
        "filename": "santa_04_sweep.mp4",
        "image": SOURCE / "04_workshop_sweeping_1080x1920.png",
        "source_still": "04_workshop_sweeping_1080x1920.jpg",
        "title": "Santa sweeping the workshop",
        "conservative_prompt": False,
        "prompt": (
            "Photoreal cinematic 9:16 North Pole workshop. This exact photograph comes alive for five seconds. "
            "Preserve Santa's face, glasses, beard, red suit, black boots, broom, red sack reading A Cleaner North Pole "
            "A Happier World, red bucket Even Santa Cleans, wooden crate TIDY ELVES HAPPY ELVES, NORTH POLE signs, "
            "Christmas tree, reindeer outside the arch, and all lettering exactly as in the first frame. "
            "Slow stabilized cinematic push toward Santa. He makes one short realistic broom sweep; snow dust slides "
            "across the wooden floor with real physics then settles. Tree lights shimmer. Candle glow. Gentle snowfall "
            "visible through the open arch. Reindeer in the background shift weight slightly. Architecture stays rigid. "
            "The last second becomes calmer and almost locked-off on Santa, broom, sack, and the snowy North Pole beyond. "
            "Do not morph faces, broom, signs, or building proportions. Closing shot of a cinematic Christmas campaign."
        ),
    },
]

CONSERVATIVE_SUFFIX = (
    " CONSERVATIVE MOTION ONLY. Minimal camera travel. Almost locked-off tripod with tiny push-in. "
    "Environment motion only: sparse snow, light shimmer, water, reflections. Zero architecture change."
)


def load_dotenv_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        key, value = s.split("=", 1)
        key = key.strip()
        if key and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")


def read_credentials() -> tuple[str, str]:
    load_dotenv_file(Path("/tmp/mozas-hf/app.env.partial"))
    combined = (os.environ.get("HF_CREDENTIALS") or os.environ.get("HF_KEY") or "").strip()
    if ":" in combined:
        key_id, secret = combined.split(":", 1)
        key_id, secret = key_id.strip(), secret.strip()
        if key_id and secret:
            return key_id, secret
    key_id = (os.environ.get("HF_API_KEY_ID") or os.environ.get("HF_API_KEY") or "").strip()
    secret = (
        os.environ.get("HF_API_KEY_SECRET") or os.environ.get("HF_SECRET") or os.environ.get("HF_API_SECRET") or ""
    ).strip()
    if key_id and secret:
        return key_id, secret
    print(
        "BLOCKED: Higgsfield credentials missing. Set HF_CREDENTIALS. Fail closed — no Replicate fallback.",
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
        "User-Agent": "tdg-north-pole-santa-reel/higgsfield",
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
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-north-pole-santa-reel/higgsfield"})
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


def prompt_for(clip: dict, conservative: bool) -> str:
    prompt = clip["prompt"]
    if conservative:
        return prompt + CONSERVATIVE_SUFFIX
    return prompt


def submit_and_download(clip: dict, est: dict, conservative: bool = False) -> dict:
    prompt = prompt_for(clip, conservative)
    payload = clip_payload(clip["_image_url"], prompt)
    print(f"Submitting {clip['id']} conservative={conservative}...", flush=True)
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
        "prompt": prompt,
        "conservative": conservative,
        "generation_cost_usd": est["usd"],
        "credits": est["credits"],
        "file": str(dest),
        "probe": info,
        "qc_frames": [str(p) for p in frames],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    only_ids = [a[len("--only=") :] for a in sys.argv if a.startswith("--only=")]
    estimate_only = "--estimate-only" in sys.argv
    conservative = "--conservative" in sys.argv
    only = set(only_ids[0].split(",")) if only_ids else None

    clips = [c for c in CLIPS if only is None or c["id"] in only]
    if not clips:
        raise SystemExit("no clips selected")

    read_credentials()
    verify_auth()

    MASTERS.mkdir(parents=True, exist_ok=True)
    GENLOG.parent.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)
    LOG.parent.mkdir(parents=True, exist_ok=True)

    uploads: dict[str, str] = {}
    for clip in clips:
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
    print("RESOLUTION TARGET: 1080x1920 via 9:16 source stills")
    print("DURATION: 5s  SOUND: off")
    for clip in clips:
        payload = clip_payload(uploads[clip["id"]], prompt_for(clip, conservative))
        body = hf_request("POST", ESTIMATE_PATH, payload)
        est = parse_estimate(body)
        estimates.append({"id": clip["id"], **est})
        total_usd += est["usd"]
        print(f"  {clip['id']}: ${est['usd']:.4f}  credits={est['credits']}", flush=True)
    print(f"ESTIMATED_COST ({len(clips)} clips): ${total_usd:.4f}")
    print("=" * 72, flush=True)

    if total_usd > BUDGET_USD:
        print(f"STOP: live Higgsfield total ${total_usd:.4f} exceeds ${BUDGET_USD:.2f}", flush=True)
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
    existing = {}
    if LOG.exists():
        try:
            existing = json.loads(LOG.read_text())
        except json.JSONDecodeError:
            existing = {}
    prior_clips = [c for c in (existing.get("clips") or []) if only is None or c.get("id") not in {x["id"] for x in clips}]
    log = {
        "created_at": existing.get("created_at") or datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "provider": "higgsfield",
        "model": MODEL_ID,
        "duration": DURATION,
        "sound": "off",
        "estimated_total_usd": total_usd,
        "regenerations": int(existing.get("regenerations") or 0),
        "clips": prior_clips,
        "reels": existing.get("reels") or [],
    }

    for clip, est in zip(clips, estimates):
        dest = MASTERS / clip["filename"]
        if dest.exists() and dest.stat().st_size > 200_000 and "--force" not in sys.argv:
            print(f"SKIP existing successful {clip['id']} ({dest})", flush=True)
            info = probe_summary(dest)
            log["clips"].append(
                {
                    "id": clip["id"],
                    "title": clip["title"],
                    "source_image": clip["source_still"],
                    "reused_existing": True,
                    "file": str(dest),
                    "probe": info,
                }
            )
            continue
        try:
            entry = submit_and_download(clip, est, conservative=conservative)
        except Exception as err:
            print(f"TECHNICAL FAIL {clip['id']}: {err} — retrying once conservative", flush=True)
            log["regenerations"] += 1
            time.sleep(4)
            entry = submit_and_download(clip, est, conservative=True)
        log["clips"].append(entry)
        GENLOG.write_text(json.dumps(log, indent=2) + "\n")
        LOG.write_text(json.dumps(log, indent=2) + "\n")
        time.sleep(2)

    log["status"] = "MASTERS_READY"
    billed = [c.get("generation_cost_usd") for c in log["clips"] if isinstance(c.get("generation_cost_usd"), (int, float))]
    log["actual_cost_usd"] = round(sum(billed), 4) if billed else None
    LOG.write_text(json.dumps(log, indent=2) + "\n")
    GENLOG.write_text(json.dumps(log, indent=2) + "\n")
    print("Masters ready. Assemble after visual QC.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
