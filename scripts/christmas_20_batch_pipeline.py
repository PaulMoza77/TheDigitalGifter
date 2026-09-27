#!/usr/bin/env python3
"""Christmas 20-batch: 20×8s Kling 3.0 Pro I2V masters + finished derivatives.

Reuses TDG Higgsfield patterns (generate_christmas_express_sep23.py). No Replicate.
Resumable via public/assets/christmas/christmas-20-batch/generation_log.json.

Phases: manifest | estimate | generate | finish | assemble | report | all
"""

from __future__ import annotations

import hashlib
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
ESTIMATE_PATH = f"/estimate/{MODEL_ID}"
SUBMIT_PATH = f"/{MODEL_ID}"
DURATION = 8
PIPELINE_VERSION = "v1-kling8-higgsfield"

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
ASSETS_UPLOAD = Path(
    os.environ.get("TDG_INGEST_ASSETS") or "/home/ubuntu/.cursor/projects/workspace/assets"
)
BATCH = ROOT / "public/assets/christmas/christmas-20-batch"
PROMPTS = BATCH / "clip_prompts.json"
MANIFEST = BATCH / "batch_manifest.json"
GENLOG = BATCH / "generation_log.json"
FINISHLOG = BATCH / "finish_manifest.json"
ASSEMBLELOG = BATCH / "assemble_manifest.json"

MASTERS = BATCH / "masters"
MASTERS_QC = BATCH / "qc"
POSTERS = BATCH / "posters"
FINISHED_8 = BATCH / "finished" / "micro-8s"
FINISHED_16 = BATCH / "finished" / "reels-16s"
FINISHED_32 = BATCH / "finished" / "reels-32s"
MUSIC_DIR = ROOT / "public/assets/music/christmas"
MUSIC_MANIFEST = MUSIC_DIR / "LICENSE_MANIFEST.json"

INGEST_PATHS = [
    ROOT / "public/assets/christmas/library-stills/ingest_nyc_holiday_sep27.json",
    ROOT / "public/assets/christmas/library-stills/ingest_cozy_nostalgia_sep27.json",
]

MUSIC_BY_MOOD = {
    "calm": "silent-night-lofi.mp3",
    "cozy": "god-rest-ye-merry-gentlemen-synthwave.mp3",
    "nostalgic": "auld-lang-syne-lofi.mp3",
    "emotional": "o-holy-night-lofi.mp3",
    "warm": "angels-we-have-heard-lofi.mp3",
    "upbeat": "joy-to-the-world-synthwave.mp3",
    "magical": "the-first-noel-synthwave.mp3",
    "cinematic": "we-three-kings-synthwave.mp3",
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def try_load_hf_from_mozas_vps() -> None:
    if (os.environ.get("HF_CREDENTIALS") or os.environ.get("HF_KEY") or "").strip():
        return
    if not (os.environ.get("MOZAS_SSH_HOST") and os.environ.get("MOZAS_SSH_PRIVATE_KEY")):
        return
    loader = ROOT / "scripts" / "_load_hf_credentials.sh"
    if not loader.exists():
        return
    print("Loading Higgsfield credentials from Mozas VPS app.env (value not printed).", flush=True)
    proc = subprocess.run(
        ["bash", str(loader)],
        capture_output=True,
        text=True,
        check=False,
        env=os.environ.copy(),
    )
    if proc.returncode != 0:
        print(f"HF load failed: {proc.stderr[:200]}", flush=True)
        return
    val = (proc.stdout or "").strip()
    if val and ":" in val:
        os.environ["HF_CREDENTIALS"] = val


def read_credentials() -> tuple[str, str]:
    try_load_hf_from_mozas_vps()
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
    print("BLOCKED: Higgsfield credentials missing.", file=sys.stderr)
    raise SystemExit(2)


def auth_header() -> str:
    key_id, secret = read_credentials()
    return f"Key {key_id}:{secret}"


def hf_request(method: str, path_or_url: str, data: dict | None = None, timeout: int = 180) -> dict:
    url = path_or_url if path_or_url.startswith("http") else f"{HIGGSFIELD_API_BASE}{path_or_url}"
    body = None if data is None else json.dumps(data).encode()
    headers = {
        "Authorization": auth_header(),
        "User-Agent": "tdg-christmas-20-batch/higgsfield",
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


def load_photo_index() -> dict[str, dict]:
    index: dict[str, dict] = {}
    for path in INGEST_PATHS:
        data = json.loads(path.read_text())
        for row in data.get("assets") or []:
            index[row["id"]] = row
    return index


def build_manifest() -> dict:
    prompts = json.loads(PROMPTS.read_text())
    photos = load_photo_index()
    neg = prompts.get("negative_suffix") or ""
    sources = []
    hashes: set[str] = set()
    for clip in prompts["clips"]:
        photo = photos.get(clip["photo_id"])
        if not photo:
            raise SystemExit(f"missing photo ingest for {clip['photo_id']}")
        upload = ASSETS_UPLOAD / photo["upload_id"]
        if not upload.exists():
            raise SystemExit(f"missing upload {upload}")
        still = ROOT / photo["generation_still"]
        if not still.exists():
            raise SystemExit(f"missing generation still {still}")
        digest = sha256_file(upload)
        if digest in hashes:
            raise SystemExit(f"duplicate hash {digest} for {clip['id']}")
        hashes.add(digest)
        w, h = probe_image(still)
        ar = round(w / h, 4) if h else 0
        sources.append(
            {
                "source_image_id": clip["id"],
                "photo_id": clip["photo_id"],
                "source_image": str(upload),
                "source_upload": photo["upload_id"],
                "generation_still": photo["generation_still"],
                "theme": clip["theme"],
                "dimensions": [w, h],
                "aspect_ratio": ar,
                "hash": digest,
                "generation_status": "pending",
                "pipeline_version": PIPELINE_VERSION,
                "motion_prompt": clip["prompt"] + neg,
                "music_mood": clip.get("music_mood", "calm"),
                "hook": clip.get("hook", ""),
                "master_filename": f"{clip['id']}.mp4",
            }
        )
    if len(sources) != 20:
        raise SystemExit(f"expected 20 sources, got {len(sources)}")
    manifest = {
        "status": "MANIFEST_READY",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "pipeline_version": PIPELINE_VERSION,
        "duration_seconds": DURATION,
        "model": MODEL_ID,
        "provider": "higgsfield",
        "source_batch": "christmas_20_batch",
        "count": 20,
        "sources": sources,
        "reels_16s": prompts.get("reels_16s") or [],
        "reels_32s": prompts.get("reels_32s") or [],
    }
    BATCH.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def probe_image(path: Path) -> tuple[int, int]:
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
            "json",
            str(path),
        ]
    )
    stream = (json.loads(raw).get("streams") or [{}])[0]
    return int(stream.get("width") or 0), int(stream.get("height") or 0)


def ffprobe_video(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,avg_frame_rate,codec_name",
            "-show_entries",
            "format=duration,bit_rate,size",
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
        "codec": stream.get("codec_name"),
    }


def has_audio(path: Path) -> bool:
    raw = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(path)],
        stderr=subprocess.DEVNULL,
    )
    return b"audio" in raw


def validate_master(path: Path) -> tuple[bool, str]:
    try:
        info = ffprobe_video(path)
    except Exception as e:
        return False, f"ffprobe_fail:{e}"
    if info["width"] < 1000 or info["height"] < 1700:
        return False, f"bad_dimensions:{info['width']}x{info['height']}"
    if info["height"] <= info["width"]:
        return False, "not_portrait"
    if info["duration"] < 7.0 or info["duration"] > 9.5:
        return False, f"bad_duration:{info['duration']:.2f}"
    if info["size"] < 300_000:
        return False, f"too_small:{info['size']}"
    return True, "qc_pass"


def upload_image(path: Path) -> str:
    ctype = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    meta = hf_request("POST", "/files/generate-upload-url", {"content_type": ctype})
    public_url = meta.get("public_url")
    upload_url = meta.get("upload_url")
    if not public_url or not upload_url:
        raise RuntimeError("upload URL missing fields")
    headers = dict(meta.get("upload_headers") or {"Content-Type": ctype})
    req = urllib.request.Request(str(upload_url), data=path.read_bytes(), method="PUT", headers=headers)
    with urllib.request.urlopen(req, timeout=180) as resp:
        resp.read()
    return str(public_url)


def clip_payload(image_url: str, prompt: str) -> dict:
    return {"image_url": image_url, "prompt": prompt, "duration": DURATION, "sound": "off"}


def video_url_from_status(body: dict) -> str | None:
    video = body.get("video")
    if isinstance(video, dict) and isinstance(video.get("url"), str):
        return video["url"]
    if isinstance(body.get("video_url"), str):
        return body["video_url"]
    return None


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-christmas-20-batch/higgsfield"})
    with urllib.request.urlopen(req, timeout=300) as resp, dest.open("wb") as f:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            f.write(chunk)


def poll_job(request_id: str, timeout_s: int = 1800) -> dict:
    start = time.time()
    while time.time() - start < timeout_s:
        current = hf_request("GET", f"/requests/{request_id}/status")
        status = str(current.get("status") or "")
        print(f"  poll {request_id} {status}", flush=True)
        if status.lower() in {"completed", "succeeded", "failed", "nsfw", "canceled", "cancelled", "error"}:
            return current
        time.sleep(8)
    raise TimeoutError(f"timeout {request_id}")


def load_genlog() -> dict:
    if GENLOG.exists():
        try:
            return json.loads(GENLOG.read_text())
        except json.JSONDecodeError:
            pass
    return {}


def write_genlog(data: dict) -> None:
    GENLOG.write_text(json.dumps(data, indent=2) + "\n")


def idempotency_key(source_id: str) -> str:
    return f"{source_id}:{PIPELINE_VERSION}"


def phase_estimate(manifest: dict) -> int:
    read_credentials()
    work = manifest["sources"]
    prev = load_genlog()
    uploads: dict[str, str] = {}
    for row in work:
        sid = row["source_image_id"]
        master = MASTERS / row["master_filename"]
        if master.exists() and validate_master(master)[0]:
            continue
        still = ROOT / row["generation_still"]
        print(f"Uploading still for estimate {sid}...", flush=True)
        uploads[sid] = upload_image(still)

    estimates = []
    total = 0.0
    per_clip = 0.0
    for row in work:
        sid = row["source_image_id"]
        prior = next((g for g in (prev.get("generations") or []) if g.get("source_image_id") == sid), None)
        if prior and prior.get("status") in {"qc_pass", "completed"} and Path(prior.get("output_path") or "").exists():
            usd = float(prior.get("actual_cost") or 0)
            estimates.append({"id": sid, "usd": usd, "resumed": True})
            total += usd
            continue
        if sid not in uploads:
            est_usd = float(os.environ.get("TDG_ESTIMATE_PLACEHOLDER_USD", "0.45"))
            estimates.append({"id": sid, "usd": est_usd, "resumed": True})
            total += est_usd
            continue
        body = hf_request("POST", ESTIMATE_PATH, clip_payload(uploads[sid], row["motion_prompt"]))
        est = parse_estimate(body)
        estimates.append({"id": sid, **est, "resumed": False})
        total += est["usd"]
        if est["usd"] > per_clip:
            per_clip = est["usd"]

    new_clips = [e for e in estimates if not e.get("resumed")]
    base = sum(e["usd"] for e in new_clips)
    if new_clips:
        per_clip = max(e["usd"] for e in new_clips)
    max_retry = per_clip * 20
    max_possible = base + max_retry
    budget_cap = float(os.environ.get("TDG_BUDGET_USD", "22.0"))
    reference_5s = 0.28
    reference_8s_linear = reference_5s * (8 / 5)

    print("=" * 72)
    print("COST GUARD (live Higgsfield estimate)")
    print(f"MODEL: {MODEL_ID}")
    print(f"DURATION: {DURATION}s x {len(new_clips)} new clips")
    print(f"ESTIMATED_BASE_COST: ${base:.4f}")
    print(f"COST_PER_CLIP: ${per_clip:.4f}")
    print(f"MAX_RETRY_EXPOSURE: ${max_retry:.4f} (1 retry each)")
    print(f"MAX_POSSIBLE_COST: ${max_possible:.4f}")
    print(f"REFERENCE_5S_RATE: ${reference_5s:.4f} -> linear 8s ref ${reference_8s_linear:.4f}/clip")
    print("=" * 72)

    write_genlog(
        {
            **prev,
            "estimate": {
                "at": datetime.now(timezone.utc).isoformat(),
                "estimated_base_cost": base,
                "cost_per_clip": per_clip,
                "max_retry_exposure": max_retry,
                "max_possible_cost": max_possible,
                "estimates": [{k: v for k, v in e.items() if k != "raw"} for e in estimates],
            },
        }
    )

    if base > budget_cap:
        print(f"STOP: base ${base:.4f} exceeds TDG_BUDGET_USD cap ${budget_cap:.2f}", flush=True)
        return 3
    if per_clip > reference_8s_linear * 1.35:
        print(
            f"STOP: per-clip ${per_clip:.4f} materially above linear ref ${reference_8s_linear:.4f}",
            flush=True,
        )
        return 3
    return 0


def _sync_existing_master(row: dict, generations: list[dict]) -> list[dict]:
    sid = row["source_image_id"]
    master = MASTERS / row["master_filename"]
    if not master.exists():
        return generations
    ok, _ = validate_master(master)
    if not ok:
        return generations
    prior = next((g for g in generations if g.get("source_image_id") == sid), {})
    entry = {
        "source_image_id": sid,
        "idempotency_key": idempotency_key(sid),
        "generation_job_id": prior.get("generation_job_id", "existing-file"),
        "provider": "higgsfield",
        "model": MODEL_ID,
        "duration": DURATION,
        "prompt": row["motion_prompt"],
        "status": "qc_pass",
        "qc_status": "qc_pass",
        "output_path": str(master.relative_to(ROOT)),
        "actual_cost": float(prior.get("actual_cost") or 0),
        "created_at": prior.get("created_at") or datetime.now(timezone.utc).isoformat(),
    }
    print(f"SKIP generate {sid} — master exists", flush=True)
    return [g for g in generations if g.get("source_image_id") != sid] + [entry]


def phase_generate(manifest: dict) -> int:
    read_credentials()
    MASTERS.mkdir(parents=True, exist_ok=True)
    prev = load_genlog()
    generations = list(prev.get("generations") or [])
    pending_jobs: dict[str, dict] = {
        str(row.get("source_image_id")): row for row in (prev.get("pending_jobs") or []) if row.get("source_image_id")
    }
    est_by_id: dict[str, float] = {
        str(row.get("id")): float(row.get("usd") or 0) for row in ((prev.get("estimate") or {}).get("estimates") or [])
    }

    work_rows: list[dict] = []
    for row in manifest["sources"]:
        generations = _sync_existing_master(row, generations)
        sid = row["source_image_id"]
        if any(g.get("source_image_id") == sid and g.get("status") == "qc_pass" for g in generations):
            continue
        if any(g.get("source_image_id") == sid and g.get("status") == "needs_manual_review" for g in generations):
            continue
        work_rows.append(row)

    uploads: dict[str, str] = {}
    for row in work_rows:
        sid = row["source_image_id"]
        if sid in pending_jobs and pending_jobs[sid].get("job_id"):
            continue
        still = ROOT / row["generation_still"]
        print(f"Uploading {sid}...", flush=True)
        uploads[sid] = upload_image(still)
        if sid not in est_by_id:
            est = parse_estimate(
                hf_request("POST", ESTIMATE_PATH, clip_payload(uploads[sid], row["motion_prompt"]))
            )
            est_by_id[sid] = est["usd"]

    for row in work_rows:
        sid = row["source_image_id"]
        if sid in pending_jobs and pending_jobs[sid].get("job_id"):
            continue
        image_url = uploads.get(sid)
        if not image_url:
            still = ROOT / row["generation_still"]
            image_url = upload_image(still)
        print(f"Submitting {sid}...", flush=True)
        submitted = hf_request("POST", SUBMIT_PATH, clip_payload(image_url, row["motion_prompt"]))
        job_id = str(submitted.get("request_id") or "")
        if not job_id:
            raise RuntimeError(f"no request_id for {sid}")
        pending_jobs[sid] = {
            "source_image_id": sid,
            "job_id": job_id,
            "attempts": int(pending_jobs.get(sid, {}).get("attempts") or 0) + 1,
            "est_usd": est_by_id.get(sid, 0.493),
            "master_filename": row["master_filename"],
            "motion_prompt": row["motion_prompt"],
        }
        write_genlog({**load_genlog(), "generations": generations, "pending_jobs": list(pending_jobs.values())})
        time.sleep(0.35)

    terminal = {"completed", "succeeded", "failed", "nsfw", "canceled", "cancelled", "error"}
    while pending_jobs:
        finished: list[str] = []
        for sid, job in list(pending_jobs.items()):
            job_id = job["job_id"]
            body = hf_request("GET", f"/requests/{job_id}/status")
            status = str(body.get("status") or "").lower()
            print(f"  {sid} {job_id} {status}", flush=True)
            if status not in terminal:
                continue
            finished.append(sid)
            row = next(r for r in manifest["sources"] if r["source_image_id"] == sid)
            master = MASTERS / row["master_filename"]
            if status in {"completed", "succeeded"}:
                url = video_url_from_status(body)
                if not url:
                    err = "missing video url"
                else:
                    try:
                        download(url, master)
                        ok, reason = validate_master(master)
                        if not ok:
                            raise RuntimeError(reason)
                        generations = [g for g in generations if g.get("source_image_id") != sid] + [
                            {
                                "source_image_id": sid,
                                "idempotency_key": idempotency_key(sid),
                                "generation_job_id": job_id,
                                "provider": "higgsfield",
                                "model": MODEL_ID,
                                "duration": DURATION,
                                "prompt": row["motion_prompt"],
                                "status": "qc_pass",
                                "qc_status": "qc_pass",
                                "output_path": str(master.relative_to(ROOT)),
                                "actual_cost": float(job.get("est_usd") or 0),
                                "attempts": job.get("attempts") or 1,
                                "created_at": datetime.now(timezone.utc).isoformat(),
                            }
                        ]
                        print(f"PASS {sid}", flush=True)
                        err = None
                    except Exception as exc:
                        err = str(exc)
                if err:
                    attempts = int(job.get("attempts") or 1)
                    if attempts < 2:
                        print(f"RETRY {sid}: {err}", flush=True)
                        still = ROOT / row["generation_still"]
                        image_url = upload_image(still)
                        submitted = hf_request("POST", SUBMIT_PATH, clip_payload(image_url, row["motion_prompt"]))
                        retry_id = str(submitted.get("request_id") or "")
                        pending_jobs[sid] = {**job, "job_id": retry_id, "attempts": attempts + 1}
                        finished.pop()
                    else:
                        generations = [g for g in generations if g.get("source_image_id") != sid] + [
                            {
                                "source_image_id": sid,
                                "idempotency_key": idempotency_key(sid),
                                "status": "needs_manual_review",
                                "qc_status": f"fail:{err}",
                                "attempts": attempts,
                                "created_at": datetime.now(timezone.utc).isoformat(),
                            }
                        ]
            else:
                attempts = int(job.get("attempts") or 1)
                if attempts < 2:
                    print(f"RETRY {sid} after {status}", flush=True)
                    still = ROOT / row["generation_still"]
                    image_url = upload_image(still)
                    submitted = hf_request("POST", SUBMIT_PATH, clip_payload(image_url, row["motion_prompt"]))
                    retry_id = str(submitted.get("request_id") or "")
                    pending_jobs[sid] = {**job, "job_id": retry_id, "attempts": attempts + 1}
                    finished.pop()
                else:
                    generations = [g for g in generations if g.get("source_image_id") != sid] + [
                        {
                            "source_image_id": sid,
                            "idempotency_key": idempotency_key(sid),
                            "status": "needs_manual_review",
                            "qc_status": f"fail:{status}",
                            "attempts": attempts,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        }
                    ]
        for sid in finished:
            pending_jobs.pop(sid, None)
        write_genlog(
            {
                **load_genlog(),
                "generations": generations,
                "pending_jobs": list(pending_jobs.values()),
                "actual_kling_cost": round(
                    sum(float(g.get("actual_cost") or 0) for g in generations if g.get("status") == "qc_pass"),
                    4,
                ),
            }
        )
        if pending_jobs:
            time.sleep(8)

    passed = sum(1 for g in generations if g.get("status") == "qc_pass")
    print(f"Generations qc_pass={passed}/20", flush=True)
    return 0 if passed == 20 else 1


def mix_music(video: Path, music: Path, out: Path, duration: float) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    fade_in, fade_out = 1.2, 2.0
    fade_out_start = max(0, duration - fade_out)
    filt = (
        f"[1:a]afade=t=in:st=0:d={fade_in},afade=t=out:st={fade_out_start}:d={fade_out},"
        f"atrim=0:{duration},asetpts=PTS-STARTPTS,volume=0.85[aout]"
    )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video),
            "-i",
            str(music),
            "-filter_complex",
            filt,
            "-map",
            "0:v:0",
            "-map",
            "[aout]",
            "-t",
            str(duration),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "18",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(out),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def export_trimmed_master(src: Path, dest: Path, start: float = 0.08, dur: float = 7.84) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-ss",
            str(start),
            "-i",
            str(src),
            "-t",
            str(dur),
            "-vf",
            "fps=30,scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p",
            "-an",
            "-c:v",
            "libx264",
            "-crf",
            "18",
            "-movflags",
            "+faststart",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def phase_finish(manifest: dict) -> int:
    gen = load_genlog()
    finished = []
    recent_music: list[str] = []
    for row in manifest["sources"]:
        sid = row["source_image_id"]
        master = MASTERS / row["master_filename"]
        gen_row = next((g for g in gen.get("generations") or [] if g["source_image_id"] == sid), None)
        if not gen_row or gen_row.get("status") != "qc_pass" or not master.exists():
            continue
        silent = BATCH / "silent" / f"{sid}.mp4"
        export_trimmed_master(master, silent)
        mood = row.get("music_mood", "calm")
        track = MUSIC_BY_MOOD.get(mood, "silent-night-lofi.mp3")
        if track in recent_music[-2:]:
            track = next(t for t in MUSIC_BY_MOOD.values() if t not in recent_music[-2:])
        recent_music.append(track)
        music = MUSIC_DIR / track
        out = FINISHED_8 / f"{sid}.mp4"
        dur = ffprobe_video(silent)["duration"]
        mix_music(silent, music, out, dur)
        if not has_audio(out):
            raise RuntimeError(f"no audio in {out}")
        finished.append(
            {
                "id": sid,
                "type": "micro_short",
                "path": str(out.relative_to(ROOT)),
                "music": track,
                "hook": row.get("hook", ""),
                "publish_status": "ready_to_publish",
                "duration": ffprobe_video(out)["duration"],
            }
        )
    FINISHLOG.write_text(json.dumps({"finished_8s": finished, "count": len(finished)}, indent=2) + "\n")
    print(f"Finished 8s shorts: {len(finished)}/20", flush=True)
    return 0 if len(finished) == 20 else 1


def concat_reel(clips: list[Path], dest: Path, trim_start: float = 0.08, trim_dur: float = 7.84) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    inputs = []
    filters = []
    for i, clip in enumerate(clips):
        inputs.extend(["-i", str(clip)])
        filters.append(
            f"[{i}:v]trim=start={trim_start}:duration={trim_dur},setpts=PTS-STARTPTS,"
            f"fps=30,scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p[v{i}]"
        )
    n = len(clips)
    filters.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[outv]")
    subprocess.check_call(
        ["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(filters), "-map", "[outv]", "-an", "-c:v", "libx264", "-crf", "18", "-movflags", "+faststart", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def phase_assemble(manifest: dict) -> int:
    gen = load_genlog()
    master_by = {row["source_image_id"]: MASTERS / row["master_filename"] for row in manifest["sources"]}
    reels_16 = []
    reels_32 = []
    recent_music: list[str] = []

    for spec in manifest.get("reels_16s") or []:
        clip_paths = [master_by[c] for c in spec["clips"]]
        silent = BATCH / "silent" / f"{spec['id']}.mp4"
        concat_reel(clip_paths, silent)
        mood = "cinematic"
        track = MUSIC_BY_MOOD[mood]
        out = FINISHED_16 / f"{spec['id']}.mp4"
        dur = ffprobe_video(silent)["duration"]
        mix_music(silent, MUSIC_DIR / track, out, dur)
        reels_16.append({"id": spec["id"], "path": str(out.relative_to(ROOT)), "hook": spec.get("hook", ""), "publish_status": "ready_to_publish"})
        recent_music.append(track)

    for spec in manifest.get("reels_32s") or []:
        clip_paths = [master_by[c] for c in spec["clips"]]
        silent = BATCH / "silent" / f"{spec['id']}.mp4"
        concat_reel(clip_paths, silent, trim_dur=7.9)
        mood = "magical"
        track = MUSIC_BY_MOOD[mood]
        out = FINISHED_32 / f"{spec['id']}.mp4"
        dur = ffprobe_video(silent)["duration"]
        mix_music(silent, MUSIC_DIR / track, out, dur)
        reels_32.append({"id": spec["id"], "path": str(out.relative_to(ROOT)), "hook": spec.get("hook", ""), "publish_status": "ready_to_publish"})

    ASSEMBLELOG.write_text(json.dumps({"reels_16s": reels_16, "reels_32s": reels_32}, indent=2) + "\n")
    print(f"Assembled 16s={len(reels_16)} 32s={len(reels_32)}", flush=True)
    return 0 if len(reels_16) == 10 and len(reels_32) == 5 else 1


def phase_report() -> int:
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    gen = load_genlog()
    finish = json.loads(FINISHLOG.read_text()) if FINISHLOG.exists() else {}
    asm = json.loads(ASSEMBLELOG.read_text()) if ASSEMBLELOG.exists() else {}
    gens = gen.get("generations") or []
    passed = [g for g in gens if g.get("status") == "qc_pass"]
    failed = [g for g in gens if g.get("status") not in {"qc_pass", None} and "fail" in str(g.get("status", ""))]
    manual = [g for g in gens if g.get("status") == "needs_manual_review"]
    est = (gen.get("estimate") or {}).get("estimated_base_cost")
    actual = gen.get("actual_kling_cost") or round(sum(float(g.get("actual_cost") or 0) for g in passed), 4)
    print("FINAL REPORT")
    print(f"SOURCE_IMAGES: {manifest.get('count', 0)}/20")
    print(f"KLING_GENERATIONS PASS: {len(passed)} FAILED: {len(failed)} MANUAL_REVIEW: {len(manual)}")
    print(f"MASTER_CLIPS: {len(list(MASTERS.glob('*.mp4')))}/20")
    print(f"8S SHORTS: {finish.get('count', 0)}/20")
    print(f"16S REELS: {len(asm.get('reels_16s') or [])}/10")
    print(f"32S REELS: {len(asm.get('reels_32s') or [])}/5")
    total_ready = finish.get("count", 0) + len(asm.get("reels_16s") or []) + len(asm.get("reels_32s") or [])
    print(f"TOTAL_READY_TO_PUBLISH: {total_ready}/35")
    audio_ok = all(has_audio(ROOT / p["path"]) for p in (finish.get("finished_8s") or [])) if finish else False
    print(f"AUDIO_VERIFIED: {'YES' if audio_ok else 'NO'}")
    print(f"ACTUAL_KLING_COST: ${actual}")
    print(f"ESTIMATED_VS_ACTUAL: ${est} vs ${actual}")
    print(f"LIBRARY_PATHS: {BATCH.relative_to(ROOT)}")
    return 0


def main() -> int:
    phase = (sys.argv[1] if len(sys.argv) > 1 else "manifest").lower()
    if phase == "manifest":
        build_manifest()
        print(f"Wrote {MANIFEST}", flush=True)
        return 0
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else build_manifest()
    if phase == "estimate":
        return phase_estimate(manifest)
    if phase == "generate":
        return phase_generate(manifest)
    if phase == "finish":
        return phase_finish(manifest)
    if phase == "assemble":
        return phase_assemble(manifest)
    if phase == "report":
        return phase_report()
    if phase == "all":
        if phase_estimate(manifest) != 0:
            return 3
        rc = phase_generate(manifest)
        if rc != 0:
            return rc
        if phase_finish(manifest) != 0:
            return 1
        if phase_assemble(manifest) != 0:
            return 1
        return phase_report()
    raise SystemExit(f"unknown phase {phase}")


if __name__ == "__main__":
    raise SystemExit(main())
