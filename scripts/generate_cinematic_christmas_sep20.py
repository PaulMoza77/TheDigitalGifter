#!/usr/bin/env python3
"""Generate 8 Higgsfield Kling 3.0 Pro I2V masters (5s, sound=off) for Sep 20 stills.

Fails closed if Higgsfield credentials are missing. Never uses Replicate.
Resumes completed jobs from the generation log — never resubmits a successful request_id.
Credentials: HF_CREDENTIALS=KEY_ID:KEY_SECRET (or HF_API_KEY_ID + HF_API_KEY_SECRET).
Never print credential values.
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
MODEL_ID = "kling-video/v3.0/pro/image-to-video"
ESTIMATE_PATH = "/estimate/kling-video/v3.0/pro/image-to-video"
SUBMIT_PATH = "/kling-video/v3.0/pro/image-to-video"
DURATION = 5
# Eight clips at the Sep 19 live rate (~$0.28) plus one technical retry headroom.
BUDGET_USD = 3.50

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
SOURCE = Path(os.environ.get("TDG_SOURCE") or (ROOT / "source" / "batch-sep20"))
MASTERS = Path(os.environ.get("TDG_MASTERS") or (ROOT / "public" / "assets" / "christmas" / "cinematic-sep20" / "masters"))
POSTERS = Path(os.environ.get("TDG_POSTERS") or (ROOT / "public" / "assets" / "christmas" / "cinematic-sep20" / "posters"))
QC = Path(os.environ.get("TDG_QC") or (ROOT / "generated" / "batch-sep20" / "qc"))
LOG = Path(os.environ.get("TDG_LOG") or (ROOT / "public" / "assets" / "christmas" / "cinematic-sep20" / "generation_manifest.json"))
GENLOG = Path(os.environ.get("TDG_GENLOG") or (ROOT / "generated" / "batch-sep20" / "generation_log.json"))

NEGATIVE = (
    " Do not morph faces, buildings, vehicles, animals, or text. No duplicated people, no extra limbs, "
    "no melting objects, no random text, logos, or captions appearing. No wild camera spins. Subtle cinematic motion only."
)

CLIPS = [
    {
        "id": "cinematic_01_polar_express",
        "filename": "cinematic_01_polar_express.mp4",
        "image": SOURCE / "01_polar_express_alpine_viaduct_1080x1920.png",
        "source_still": "polar_express_alpine_viaduct.jpg",
        "title": "Polar Express alpine viaduct",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas dusk. This exact photograph comes alive for five seconds. "
            "Preserve the black steam locomotive, wreath with red bow, red passenger cars, stone viaduct arches, "
            "warm window lights, lantern with red bow, snow-laden pines, alpine village, lake, and sunset mountains "
            "exactly as in the first frame. The train eases slowly forward along the tracks with physically correct "
            "wheel rotation. Thick steam billows naturally from the stack and drifts. Sparse snowfall. Warm coach "
            "lights flicker extremely subtly. Very gentle cinematic camera push along the tracks, almost locked-off. "
            "Architecture stays rigid. Passengers stay seated as small silhouettes. No extra cars or warped wheels."
            + NEGATIVE
        ),
    },
    {
        "id": "cinematic_02_coca_cola_truck",
        "filename": "cinematic_02_coca_cola_truck.mp4",
        "image": SOURCE / "02_coca_cola_christmas_truck_1080x1920.png",
        "source_still": "coca_cola_christmas_truck_times_square.jpg",
        "title": "Coca-Cola Christmas truck",
        "prompt": (
            "Photoreal cinematic 9:16 Times Square Christmas night. This exact photograph comes alive for five seconds. "
            "Preserve the red Coca-Cola truck, Santa mural, wreath on the grille, billboards, Christmas tree, wet street, "
            "crowd, and falling snow exactly as in the first frame. The truck slowly rolls forward a few meters with "
            "natural wheel rotation. String lights stay attached and stable — they twinkle, they do not crawl off the truck. "
            "Reflections slide naturally on the wet pavement. Sparse snowfall. Crowd makes tiny natural shifts, no morphing faces. "
            "Very slow street-level tracking. Billboards remain readable and unchanged. No extra trucks."
            + NEGATIVE
        ),
    },
    {
        "id": "cinematic_03_home_alone_house",
        "filename": "cinematic_03_home_alone_house.mp4",
        "image": SOURCE / "03_home_alone_style_house_1080x1920.png",
        "source_still": "home_alone_style_christmas_house.jpg",
        "title": "Home Alone-style Christmas house",
        "prompt": (
            "Photoreal cinematic 9:16 suburban Christmas night. This exact photograph comes alive for five seconds. "
            "Preserve the brick colonial house, black shutters, white columns, wreath, address plaque 671, Christmas lights, "
            "snow-covered lawn, lamp post, and parked van exactly as in the first frame. Extremely slow cinematic push toward "
            "the front door. Sparse snowfall. Christmas lights shimmer very softly. Tiny natural movement in evergreen branches. "
            "Warm interior glow stays consistent. Do not deform windows, roof, columns, or the house silhouette. No extra cars."
            + NEGATIVE
        ),
    },
    {
        "id": "cinematic_04_rockefeller",
        "filename": "cinematic_04_rockefeller.mp4",
        "image": SOURCE / "04_rockefeller_center_ice_rink_1080x1920.png",
        "source_still": "rockefeller_center_ice_rink.jpg",
        "title": "Rockefeller Center ice rink",
        "prompt": (
            "Photoreal cinematic 9:16 Rockefeller Center Christmas night. This exact photograph comes alive for five seconds. "
            "Preserve the Christmas tree, Prometheus statue, flags, skaters, fountain water, buildings, and foreground pine "
            "exactly as in the first frame. Skaters glide naturally on the ice with believable body motion. Sparse snowfall. "
            "Tree lights sparkle subtly. Fountain water continues. Slow forward-and-slightly-down cinematic move. Architecture "
            "and the statue stay rigid. Do not duplicate skaters or morph faces."
            + NEGATIVE
        ),
    },
    {
        "id": "cinematic_05_plaza_hotel",
        "filename": "cinematic_05_plaza_hotel.mp4",
        "image": SOURCE / "05_plaza_hotel_fifth_avenue_1080x1920.png",
        "source_still": "plaza_hotel_fifth_avenue.jpg",
        "title": "The Plaza Hotel Fifth Avenue",
        "prompt": (
            "Photoreal cinematic 9:16 Fifth Avenue Christmas night. This exact photograph comes alive for five seconds. "
            "Preserve The Plaza canopy lettering, wreaths, white horse, red carriage, doorman, wet street, taxis, and snow "
            "exactly as in the first frame. Very slow street-level dolly. The horse takes a few natural steps; the carriage "
            "follows. Taxis and distant pedestrians move naturally in the background. Sparse snowfall. Canopy lights stay "
            "stable. Do not warp the hotel facade or mutate THE PLAZA NEW YORK lettering."
            + NEGATIVE
        ),
    },
    {
        "id": "cinematic_06_santa_london",
        "filename": "cinematic_06_santa_london.mp4",
        "image": SOURCE / "06_santa_sleigh_over_london_1080x1920.png",
        "source_still": "santa_sleigh_over_london.jpg",
        "title": "Santa flying over London",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas night over London. This exact photograph comes alive for five seconds. "
            "Preserve Santa, the red sleigh, gift pile, eight reindeer, harnesses, full moon, Big Ben, Parliament, Thames "
            "boats, and London Eye exactly as in the first frame. Smooth gentle forward flight. Reindeer keep anatomically "
            "stable galloping motion — no extra legs, no warped antlers. Subtle sleigh bob. Clouds drift slowly. City lights "
            "parallax below. Sparse snowfall and sparkle. Camera tracks with the sleigh, not a wild orbit. Architecture stays rigid."
            + NEGATIVE
        ),
    },
    {
        "id": "cinematic_07_workshop",
        "filename": "cinematic_07_workshop.mp4",
        "image": SOURCE / "07_santa_workshop_north_pole_1080x1920.png",
        "source_still": "santa_workshop_north_pole.jpg",
        "title": "Santa’s Workshop North Pole",
        "prompt": (
            "Photoreal cinematic 9:16 North Pole workshop night. This exact photograph comes alive for five seconds. "
            "Preserve Santa, the Nice List parchment, elves, reindeer, sleigh, SANTA'S WORKSHOP sign, candy-cane pole, "
            "aurora, and gift piles exactly as in the first frame. Slow cinematic push through the scene. Santa’s hands "
            "make a tiny natural adjustment on the list. Elves make small wrapping and walking motions. Lanterns and firelight "
            "flicker. Sparse snowfall. Aurora drifts. Sign letters stay unchanged. No extra elves or morphing faces."
            + NEGATIVE
        ),
    },
    {
        "id": "cinematic_08_grinch",
        "filename": "cinematic_08_grinch.mp4",
        "image": SOURCE / "08_grinch_whoville_rooftop_1080x1920.png",
        "source_still": "grinch_whoville_rooftop.jpg",
        "title": "Grinch over Whoville",
        "prompt": (
            "Photoreal cinematic 9:16 Whoville Christmas night. This exact photograph comes alive for five seconds. "
            "Preserve the Grinch’s green fur, face, Santa hat and coat, sack of gifts, brick chimney, Welcome to Whoville "
            "sign, village lights, Christmas tree, and moon exactly as in the first frame. Very subtle mischievous head and "
            "shoulder movement. Fur shifts slightly in the wind. Sparse snowfall. Village lights twinkle. Gentle camera push. "
            "Absolutely no face morphing. Sign letters stay readable. Architecture stays rigid. No extra Grinches."
            + NEGATIVE
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
    secret = (
        os.environ.get("HF_API_KEY_SECRET") or os.environ.get("HF_SECRET") or os.environ.get("HF_API_SECRET") or ""
    ).strip()
    if key_id and secret:
        return key_id, secret
    print("BLOCKED: Higgsfield credentials missing. Fail closed — no Replicate fallback.", file=sys.stderr)
    raise SystemExit(2)


def auth_header() -> str:
    key_id, secret = read_credentials()
    return f"Key {key_id}:{secret}"


def hf_request(method: str, path_or_url: str, data: dict | None = None, timeout: int = 180) -> dict:
    url = path_or_url if path_or_url.startswith("http") else f"{HIGGSFIELD_API_BASE}{path_or_url}"
    body = None if data is None else json.dumps(data).encode()
    headers = {
        "Authorization": auth_header(),
        "User-Agent": "tdg-cinematic-christmas-sep20/higgsfield",
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
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-cinematic-christmas-sep20/higgsfield"})
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


def load_log() -> dict:
    for path in (LOG, GENLOG):
        if path.exists():
            try:
                data = json.loads(path.read_text())
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                pass
    return {}


def existing_clip(log: dict, clip_id: str) -> dict | None:
    for row in log.get("clips") or []:
        if row.get("id") == clip_id and row.get("job_id") and Path(row.get("file") or "").exists():
            try:
                validate_master(probe_summary(Path(row["file"])))
            except Exception:
                continue
            return row
    dest = MASTERS / next(c["filename"] for c in CLIPS if c["id"] == clip_id)
    if dest.exists():
        try:
            validate_master(probe_summary(dest))
            return {"id": clip_id, "file": str(dest), "job_id": "existing-file", "generation_cost_usd": 0, "resumed": True}
        except Exception:
            return None
    return None


def write_logs(log: dict) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    GENLOG.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(log, indent=2) + "\n"
    LOG.write_text(text)
    GENLOG.write_text(text)


def finish_local_assets(clip: dict, dest: Path, request_id: str, est: dict, prompt: str) -> dict:
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
        "generation_cost_usd": est["usd"],
        "credits": est["credits"],
        "file": str(dest),
        "probe": info,
        "qc_frames": [str(p) for p in frames],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def submit_and_download(clip: dict, est: dict, pending_job: str | None = None) -> dict:
    dest = MASTERS / clip["filename"]
    if pending_job:
        print(f"Resuming poll {clip['id']} job={pending_job}", flush=True)
        done = poll_job(pending_job)
        request_id = pending_job
    else:
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
        raise RuntimeError(f"{clip['id']} failed: status={done.get('status')} error={done.get('error')} job={request_id}")
    url = video_url_from_status(done)
    if not url:
        raise RuntimeError(f"{clip['id']} missing video url: keys={list(done.keys())}")
    print(f"Downloading {clip['id']} -> {dest}", flush=True)
    download(url, dest)
    return finish_local_assets(clip, dest, str(request_id), est, clip["prompt"])


def pending_job_id(log: dict, clip_id: str) -> str | None:
    for row in log.get("pending") or []:
        if row.get("id") == clip_id and row.get("job_id"):
            return str(row["job_id"])
    return None


def upsert_pending(log: dict, clip_id: str, job_id: str) -> None:
    pending = [row for row in (log.get("pending") or []) if row.get("id") != clip_id]
    pending.append({"id": clip_id, "job_id": job_id, "at": datetime.now(timezone.utc).isoformat()})
    log["pending"] = pending
    write_logs(log)


def main() -> int:
    estimate_only = "--estimate-only" in sys.argv
    read_credentials()
    verify_auth()

    MASTERS.mkdir(parents=True, exist_ok=True)
    GENLOG.parent.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)

    prev = load_log()
    uploads: dict[str, str] = {}
    for clip in CLIPS:
        if not clip["image"].exists():
            raise SystemExit(f"missing still {clip['image']}")
        if existing_clip(prev, clip["id"]) and not estimate_only:
            print(f"SKIP upload {clip['id']} — master already on disk", flush=True)
            continue
        print(f"Uploading {clip['image'].name}...", flush=True)
        uploads[clip["id"]] = upload_image(clip["image"])
        clip["_image_url"] = uploads[clip["id"]]

    estimates = []
    total_usd = 0.0
    print("=" * 72)
    print("LIVE HIGGSFIELD ESTIMATE")
    print(f"MODEL: {MODEL_ID}")
    for clip in CLIPS:
        if clip["id"] in uploads:
            payload = clip_payload(uploads[clip["id"]], clip["prompt"])
            body = hf_request("POST", ESTIMATE_PATH, payload)
            est = parse_estimate(body)
        else:
            prior = next((c for c in (prev.get("clips") or []) if c.get("id") == clip["id"]), None)
            usd = float((prior or {}).get("generation_cost_usd") or 0)
            est = {"usd": usd, "credits": (prior or {}).get("credits"), "raw": {"resumed": True}}
        estimates.append({"id": clip["id"], **est})
        total_usd += est["usd"]
        print(f"  {clip['id']}: ${est['usd']:.4f}  credits={est['credits']}", flush=True)
    print(f"ESTIMATED_COST (new + resumed): ${total_usd:.4f}")
    print("=" * 72, flush=True)

    new_usd = sum(e["usd"] for e, c in zip(estimates, CLIPS) if c["id"] in uploads)
    if new_usd > BUDGET_USD:
        print(f"STOP: live Higgsfield new total ${new_usd:.4f} exceeds ${BUDGET_USD:.2f}", flush=True)
        write_logs(
            {
                "status": "BLOCKED_PRICE",
                "provider": "higgsfield",
                "model": MODEL_ID,
                "estimated_total_usd": new_usd,
                "estimates": [{k: v for k, v in row.items() if k != "raw"} for row in estimates],
            }
        )
        return 3

    if estimate_only:
        print("estimate-only: not submitting paid jobs", flush=True)
        write_logs(
            {
                "status": "ESTIMATE_ONLY",
                "provider": "higgsfield",
                "model": MODEL_ID,
                "estimated_total_usd": new_usd,
                "estimates": [{k: v for k, v in row.items() if k != "raw"} for row in estimates],
            }
        )
        return 0

    print(f"PRICE CHECK: new ${new_usd:.4f} <= ${BUDGET_USD:.2f} — proceeding", flush=True)
    log = {
        "created_at": prev.get("created_at") or datetime.now(timezone.utc).isoformat(),
        "provider": "higgsfield",
        "model": MODEL_ID,
        "duration": DURATION,
        "sound": "off",
        "estimated_total_usd": new_usd,
        "regenerations": int(prev.get("regenerations") or 0),
        "clips": [c for c in (prev.get("clips") or []) if existing_clip(prev, c.get("id") or "")],
        "pending": prev.get("pending") or [],
        "failed": prev.get("failed") or [],
        "reels": prev.get("reels") or [],
    }

    for clip, est in zip(CLIPS, estimates):
        already = next((c for c in log["clips"] if c.get("id") == clip["id"]), None)
        if already:
            print(f"RESUME skip paid submit {clip['id']} job={already.get('job_id')}", flush=True)
            continue
        pending = pending_job_id(log, clip["id"])
        try:
            if not pending:
                # Persist job id immediately after submit inside helper by wrapping
                payload = clip_payload(clip["_image_url"], clip["prompt"])
                print(f"Submitting {clip['id']}...", flush=True)
                submitted = hf_request("POST", SUBMIT_PATH, payload)
                request_id = submitted.get("request_id")
                if not request_id:
                    raise RuntimeError(f"submit missing request_id: {submitted}")
                upsert_pending(log, clip["id"], str(request_id))
                pending = str(request_id)
                print(f"  job={pending} status={submitted.get('status')}", flush=True)
            entry = submit_and_download(clip, est, pending_job=pending)
        except Exception as err:
            print(f"TECHNICAL FAIL {clip['id']}: {err} — retrying once only if no live job remains", flush=True)
            log["regenerations"] += 1
            log.setdefault("failed", []).append(
                {"id": clip["id"], "error": str(err)[:500], "at": datetime.now(timezone.utc).isoformat()}
            )
            write_logs(log)
            time.sleep(4)
            pending2 = pending_job_id(log, clip["id"])
            reuse = None
            if pending2:
                try:
                    status_body = hf_request("GET", f"/requests/{pending2}/status")
                    st = str(status_body.get("status") or "").lower()
                    if st in {"completed", "succeeded"} or st not in {
                        "failed",
                        "nsfw",
                        "canceled",
                        "cancelled",
                        "error",
                    }:
                        reuse = pending2
                except Exception:
                    reuse = pending2
            if reuse:
                entry = submit_and_download(clip, est, pending_job=reuse)
            else:
                entry = submit_and_download(clip, est, pending_job=None)
        log["clips"] = [c for c in log["clips"] if c.get("id") != clip["id"]] + [entry]
        log["pending"] = [p for p in (log.get("pending") or []) if p.get("id") != clip["id"]]
        write_logs(log)
        time.sleep(2)

    log["status"] = "MASTERS_READY"
    log["actual_cost_usd"] = round(sum(float(c.get("generation_cost_usd") or 0) for c in log["clips"]), 4)
    log["success_count"] = len(log["clips"])
    log["failed_count"] = max(0, len(CLIPS) - len(log["clips"]))
    write_logs(log)
    print(f"Masters ready. success={log['success_count']} failed={log['failed_count']} cost=${log['actual_cost_usd']}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
