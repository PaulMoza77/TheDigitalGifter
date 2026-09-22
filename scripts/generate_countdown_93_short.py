#!/usr/bin/env python3
"""Generate ONE Higgsfield Kling 3.0 Pro I2V short (5s, sound=off) for the 93-days countdown still.

Fails closed if Higgsfield credentials are missing. Never uses Replicate.
Resumes completed jobs from the generation log — never resubmits a successful request_id.
Before each paid submit, skips if a validated master already exists for that clip id.
Stops without generating if the live estimate exceeds $0.50.
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
BUDGET_USD = 0.50
MAX_PAID_GENERATIONS = 1

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
SOURCE = Path(os.environ.get("TDG_SOURCE") or (ROOT / "source" / "countdown-93"))
MASTERS = Path(
    os.environ.get("TDG_MASTERS") or (ROOT / "public" / "assets" / "christmas" / "countdown-93" / "masters")
)
POSTERS = Path(
    os.environ.get("TDG_POSTERS") or (ROOT / "public" / "assets" / "christmas" / "countdown-93" / "posters")
)
QC = Path(os.environ.get("TDG_QC") or (ROOT / "generated" / "countdown-93" / "qc"))
LOG = Path(
    os.environ.get("TDG_LOG")
    or (ROOT / "public" / "assets" / "christmas" / "countdown-93" / "generation_manifest.json")
)
GENLOG = Path(os.environ.get("TDG_GENLOG") or (ROOT / "generated" / "countdown-93" / "generation_log.json"))

NEGATIVE = (
    " CRITICAL: the on-screen text overlay is locked. The exact lettering “93 DAYS UNTIL Christmas” must stay "
    "perfectly sharp, readable, and completely motionless for all five seconds — same glyphs, same gold color, "
    "same position, same size, same script Christmas word. Do not animate, morph, regenerate, replace, warp, "
    "blur, or rewrite any text. No extra captions. Do not morph architecture, furniture, gifts, or the tree. "
    "No invented people. No wild camera motion, no Ken Burns-only still, no morphing, no warped windows. "
    "Subtle living-photograph motion only."
)

CLIPS = [
    {
        "id": "countdown_93_days_until_christmas",
        "filename": "countdown_93_days_until_christmas.mp4",
        "image": SOURCE / "93_days_until_christmas_1080x1920.png",
        "source_still": "93_days_until_christmas.jpg",
        "title": "Short · 93 days until Christmas",
        "library_id": "short-countdown-93-days",
        "prompt": (
            "Photoreal cinematic 9:16 cozy Christmas living room at night. This exact photograph comes alive "
            "for five seconds. Preserve the decorated Christmas tree with red bows, wrapped gifts, mug, lanterns, "
            "stone fireplace, garland, hanging lantern, snowy mountain village through the large window, and the "
            "fixed gold overlay text “93 DAYS UNTIL Christmas” exactly as in the first frame. Very subtle slow "
            "camera push-in. Natural snowfall outside the window. Fireplace flames move naturally. Christmas-tree "
            "and fairy lights softly twinkle. Candle flames in the lanterns flicker subtly. Slight realistic light "
            "and reflection movement on the window glass and floor. Everything else stays stable."
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
        "User-Agent": "tdg-countdown-93-i2v/higgsfield",
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
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-countdown-93-i2v/higgsfield"})
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
    if info["width"] != 1080 or info["height"] != 1920:
        raise RuntimeError(f"{info['filename']} resolution {info['width']}x{info['height']} (need 1080x1920)")
    if info["duration"] < 4.8 or info["duration"] > 5.3:
        raise RuntimeError(f"{info['filename']} duration {info['duration']}")
    if info["size"] < 1_500_000:
        raise RuntimeError(f"{info['filename']} looks empty/still-image fake ({info['size']} bytes)")
    if info["bitrate"] < 1_000_000:
        raise RuntimeError(f"{info['filename']} bitrate too low for real I2V ({info['bitrate']})")
    if info["codec"] not in {"h264", "hevc", "h265"}:
        raise RuntimeError(f"{info['filename']} unexpected codec {info['codec']}")


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
            return {
                "id": clip_id,
                "file": str(dest),
                "job_id": "existing-file",
                "generation_cost_usd": 0,
                "resumed": True,
            }
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
        "library_id": clip["library_id"],
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


def submit_and_download(clip: dict, est: dict, pending_job: str) -> dict:
    dest = MASTERS / clip["filename"]
    print(f"Polling {clip['id']} job={pending_job}", flush=True)
    done = poll_job(pending_job)
    status = str(done.get("status") or "").lower()
    if status not in {"completed", "succeeded"}:
        raise RuntimeError(
            f"{clip['id']} failed: status={done.get('status')} error={done.get('error')} job={pending_job}"
        )
    url = video_url_from_status(done)
    if not url:
        raise RuntimeError(f"{clip['id']} missing video url: keys={list(done.keys())}")
    print(f"Downloading {clip['id']} -> {dest}", flush=True)
    download(url, dest)
    return finish_local_assets(clip, dest, str(pending_job), est, clip["prompt"])


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
            print(f"SKIP upload {clip['id']} — master already on disk (reuse)", flush=True)
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
                "budget_usd": BUDGET_USD,
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
                "budget_usd": BUDGET_USD,
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
        "budget_usd": BUDGET_USD,
        "regenerations": int(prev.get("regenerations") or 0),
        "clips": [c for c in (prev.get("clips") or []) if existing_clip(prev, c.get("id") or "")],
        "pending": prev.get("pending") or [],
        "failed": prev.get("failed") or [],
        "paid_submits": int(prev.get("paid_submits") or 0),
    }

    for clip, est in zip(CLIPS, estimates):
        already = next((c for c in log["clips"] if c.get("id") == clip["id"]), None)
        if already:
            print(f"REUSE skip paid submit {clip['id']} job={already.get('job_id')}", flush=True)
            continue

        # Duplicate guard: re-check disk + log immediately before each paid call.
        fresh = existing_clip(load_log(), clip["id"])
        if fresh and fresh.get("job_id") not in {None, "existing-file"}:
            print(f"REUSE late-check {clip['id']} job={fresh.get('job_id')}", flush=True)
            log["clips"].append(fresh)
            write_logs(log)
            continue

        pending = pending_job_id(log, clip["id"])
        try:
            if not pending:
                if log["paid_submits"] >= MAX_PAID_GENERATIONS:
                    raise RuntimeError(f"paid_submits would exceed MAX_PAID_GENERATIONS={MAX_PAID_GENERATIONS}")
                projected = float(sum(c.get("generation_cost_usd") or 0 for c in log["clips"])) + float(est["usd"])
                if projected > BUDGET_USD + 1e-9:
                    raise RuntimeError(f"projected spend ${projected:.4f} exceeds budget ${BUDGET_USD:.2f}")
                payload = clip_payload(clip["_image_url"], clip["prompt"])
                print(f"Submitting {clip['id']}...", flush=True)
                submitted = hf_request("POST", SUBMIT_PATH, payload)
                request_id = submitted.get("request_id")
                if not request_id:
                    raise RuntimeError(f"submit missing request_id: {submitted}")
                log["paid_submits"] += 1
                upsert_pending(log, clip["id"], str(request_id))
                pending = str(request_id)
                print(f"  job={pending} status={submitted.get('status')} paid_submits={log['paid_submits']}", flush=True)
            entry = submit_and_download(clip, est, pending_job=pending)
        except Exception as err:
            print(f"TECHNICAL FAIL {clip['id']}: {err}", flush=True)
            log.setdefault("failed", []).append(
                {"id": clip["id"], "error": str(err)[:500], "at": datetime.now(timezone.utc).isoformat()}
            )
            write_logs(log)
            raise

        log["clips"].append(entry)
        log["pending"] = [row for row in (log.get("pending") or []) if row.get("id") != clip["id"]]
        log["actual_cost_usd"] = round(sum(float(c.get("generation_cost_usd") or 0) for c in log["clips"]), 4)
        write_logs(log)
        print(
            f"OK {clip['id']} job={entry['job_id']} cost=${entry['generation_cost_usd']:.4f} "
            f"running_total=${log['actual_cost_usd']:.4f}",
            flush=True,
        )

    log["status"] = "COMPLETE"
    log["actual_cost_usd"] = round(sum(float(c.get("generation_cost_usd") or 0) for c in log["clips"]), 4)
    log["completed_at"] = datetime.now(timezone.utc).isoformat()
    write_logs(log)
    print(f"COMPLETE clips={len(log['clips'])}/1 actual_cost=${log['actual_cost_usd']:.4f}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
