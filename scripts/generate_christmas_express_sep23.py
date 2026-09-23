#!/usr/bin/env python3
"""Generate 5 Higgsfield Kling 3.0 Pro I2V masters (5s, sound=off) for Christmas Express stills.

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
# Five clips at the Sep 22 live rate (~$0.28) plus one technical retry headroom.
BUDGET_USD = 2.00

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
SOURCE = Path(os.environ.get("TDG_SOURCE") or (ROOT / "source" / "batch-christmas-express"))
MASTERS = Path(os.environ.get("TDG_MASTERS") or (ROOT / "public" / "assets" / "christmas" / "christmas-express" / "masters"))
POSTERS = Path(os.environ.get("TDG_POSTERS") or (ROOT / "public" / "assets" / "christmas" / "christmas-express" / "posters"))
QC = Path(os.environ.get("TDG_QC") or (ROOT / "generated" / "batch-christmas-express" / "qc"))
LOG = Path(os.environ.get("TDG_LOG") or (ROOT / "public" / "assets" / "christmas" / "christmas-express" / "generation_manifest.json"))
GENLOG = Path(os.environ.get("TDG_GENLOG") or (ROOT / "generated" / "batch-christmas-express" / "generation_log.json"))

NEGATIVE = (
    " Critical physics lock: the locomotive and every carriage MUST stay on the visible rails for the entire shot. "
    "The train never floats, never leaves the rails, never falls toward the village, never teleports, never bends, "
    "and never changes shape. Track geometry and the direction of travel stay physically coherent. Wheels rotate in "
    "sync with forward travel. Do not morph faces, buildings, vehicles, animals, gifts, or text. No duplicated people, "
    "no extra limbs, no melting objects, no random text, logos, or captions. No wild camera spins or random orbits. "
    "Slow cinematic push-in / slight tracking only. Subtle cinematic motion. Keep architecture, viaduct arches, and "
    "sign lettering rigid and readable."
)

RAIL_CORE = (
    "Photoreal cinematic 9:16 Christmas footage. This exact photograph comes alive for five seconds. "
    "The train MUST physically move forward along the visible railway tracks — locomotive advancing along the rails, "
    "wheels rotating consistently with travel, coupling remaining rigid. Thick steam and smoke flow naturally backward "
    "from the stack. Subtle snowfall. Warm Christmas lights shimmer gently. Tiny natural environmental movement only. "
    "Gifts stay physically attached to the train. Architecture, mountains, lake, castle, and village stay rigid. "
)

CLIPS = [
    {
        "id": "cx_01_night_viaduct",
        "filename": "cx_01_night_viaduct.mp4",
        "image": SOURCE / "01_night_moon_viaduct_1080x1920.png",
        "source_still": "christmas_express_night_moon_viaduct.jpg",
        "title": "Christmas Express night moon viaduct",
        "prompt": (
            RAIL_CORE
            + "Preserve the black steam locomotive numbered 1225, THE POLAR EXPRESS plate, wreath with red bow, "
            "red passenger cars, stone viaduct arches wrapped in lights, lantern, wooden sign reading ALL ABOARD "
            "A BRIGHTER CHRISTMAS TOGETHER, snow-laden pines, alpine village, lake, moon, and mountains exactly as "
            "in the first frame. The train eases slowly forward toward camera along the curved viaduct rails. "
            "Headlamps glow steadily. Coach windows stay warm. Do not mutate sign letters. No extra cars."
            + NEGATIVE
        ),
    },
    {
        "id": "cx_02_sunset_viaduct",
        "filename": "cx_02_sunset_viaduct.mp4",
        "image": SOURCE / "02_sunset_viaduct_1080x1920.png",
        "source_still": "christmas_express_sunset_viaduct.jpg",
        "title": "Christmas Express sunset viaduct",
        "prompt": (
            RAIL_CORE
            + "Preserve the black steam locomotive numbered 1225, THE POLAR EXPRESS plate, wreath with red bow, "
            "red passenger cars, stone viaduct, balcony lantern, snow-laden pines, alpine village, lake, castle, "
            "and sunset mountains exactly as in the first frame. The train eases slowly forward along the tracks "
            "toward camera with physically correct wheel rotation. Steam billows and drifts backward. Warm coach "
            "lights flicker extremely subtly. Passengers stay seated as small silhouettes. No extra cars or warped wheels."
            + NEGATIVE
        ),
    },
    {
        "id": "cx_03_station",
        "filename": "cx_03_station.mp4",
        "image": SOURCE / "03_north_pole_station_1080x1920.png",
        "source_still": "christmas_express_north_pole_station.jpg",
        "title": "North Pole Express station arrival",
        "prompt": (
            RAIL_CORE
            + "Preserve the black steam locomotive numbered 1225, POLAR EXPRESS plate, wreath, red cowcatcher, "
            "passenger cars, wet rails, NORTH POLE EXPRESS sign, ALL ABOARD FOR A BRIGHTER TOMORROW plaque, "
            "the child in the red coat and knit hat waving, golden retriever, gift piles, lanterns, village, "
            "and moon exactly as in the first frame. The train eases slowly forward along the station rails toward "
            "camera with correct wheel and steam physics. The child keeps a tiny natural wave. The dog stays seated "
            "with a small breath. Gifts remain stacked on the platform. Do not mutate sign letters or add extra people."
            + NEGATIVE
        ),
    },
    {
        "id": "cx_04_aurora_viaduct",
        "filename": "cx_04_aurora_viaduct.mp4",
        "image": SOURCE / "04_aurora_viaduct_1080x1920.png",
        "source_still": "christmas_express_aurora_viaduct.jpg",
        "title": "Christmas Express aurora viaduct",
        "prompt": (
            RAIL_CORE
            + "Preserve the black steam locomotive numbered 1225, THE POLAR EXPRESS plate, wreath with red bow, "
            "red passenger cars, stone viaduct, balcony lanterns, alpine village, lake, castle, mountains, aurora, "
            "and starry sky exactly as in the first frame. The train moves slowly forward along the curved viaduct "
            "rails. Aurora drifts very slowly. Steam flows backward. Coach lights shimmer. No extra cars. Do not "
            "warp the viaduct arches or the locomotive silhouette."
            + NEGATIVE
        ),
    },
    {
        "id": "cx_05_santa_gifts",
        "filename": "cx_05_santa_gifts.mp4",
        "image": SOURCE / "05_santa_gift_train_1080x1920.png",
        "source_still": "christmas_express_santa_gift_train.jpg",
        "title": "Christmas Express Santa gift train",
        "prompt": (
            RAIL_CORE
            + "Preserve Santa in the locomotive cab, the black steam locomotive numbered 1225, THE POLAR EXPRESS plate, "
            "wreath, red cowcatcher, open cars filled with wrapped gifts, people and elves riding the gift cars, "
            "stone viaduct, alpine village, lake, castle, moon, and mountains exactly as in the first frame. "
            "The train moves slowly forward along the viaduct rails toward a tunnel. Gifts remain physically attached "
            "inside the cars — they do not fly off. Santa uses only a subtle believable wave or breath. Elves and "
            "riders make tiny natural shifts, no morphing faces. Steam flows backward. No extra cars, no warped wheels."
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
        "User-Agent": "tdg-christmas-express-sep23/higgsfield",
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
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-christmas-express-sep23/higgsfield"})
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
    only_ids = [a.split("=", 1)[1] for a in sys.argv if a.startswith("--only=")]
    only_set = set(only_ids[0].split(",")) if only_ids else None
    read_credentials()
    verify_auth()

    MASTERS.mkdir(parents=True, exist_ok=True)
    GENLOG.parent.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)

    work = [c for c in CLIPS if only_set is None or c["id"] in only_set]
    if not work:
        raise SystemExit("no clips selected")

    prev = load_log()
    uploads: dict[str, str] = {}
    for clip in work:
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
    for clip in work:
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

    new_usd = sum(e["usd"] for e, c in zip(estimates, work) if c["id"] in uploads)
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

    est_by_id = {e["id"]: e for e in estimates}

    # Submit all missing jobs first so Higgsfield can run them in parallel.
    for clip in work:
        already = next((c for c in log["clips"] if c.get("id") == clip["id"]), None)
        if already:
            continue
        if pending_job_id(log, clip["id"]):
            continue
        payload = clip_payload(clip["_image_url"], clip["prompt"])
        print(f"Submitting {clip['id']}...", flush=True)
        submitted = hf_request("POST", SUBMIT_PATH, payload)
        request_id = submitted.get("request_id")
        if not request_id:
            raise RuntimeError(f"submit missing request_id: {submitted}")
        upsert_pending(log, clip["id"], str(request_id))
        print(f"  job={request_id} status={submitted.get('status')}", flush=True)
        time.sleep(0.4)

    for clip in work:
        already = next((c for c in log["clips"] if c.get("id") == clip["id"]), None)
        if already:
            print(f"RESUME skip paid submit {clip['id']} job={already.get('job_id')}", flush=True)
            continue
        pending = pending_job_id(log, clip["id"])
        est = est_by_id[clip["id"]]
        try:
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
        time.sleep(1)

    log["status"] = "MASTERS_READY"
    log["actual_cost_usd"] = round(sum(float(c.get("generation_cost_usd") or 0) for c in log["clips"]), 4)
    log["success_count"] = len(log["clips"])
    log["failed_count"] = max(0, len(CLIPS) - len(log["clips"]))
    write_logs(log)
    print(f"Masters ready. success={log['success_count']} failed={log['failed_count']} cost=${log['actual_cost_usd']}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
