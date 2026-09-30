#!/usr/bin/env python3
"""VoloCar Dubai Moments — parallel Kling 3.0 Pro I2V (5s) from existing library masters."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

HIGGSFIELD_API_BASE = "https://api.higgsfield.ai"
VIDEO_MODEL = "kling-video/v3.0/pro/image-to-video"
DURATION = 5
BUDGET_USD = 12.0
MAX_RETRIES = 1
MAX_SUBMIT_WORKERS = 6

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
MASTERS = ROOT / "public" / "assets" / "volocar" / "dubai-moments" / "masters"
I2V_STILLS = ROOT / "public" / "assets" / "volocar" / "dubai-moments" / "i2v-input"
CLIPS = ROOT / "public" / "assets" / "volocar" / "dubai-moments" / "clips"
MANIFEST = ROOT / "public" / "assets" / "volocar" / "dubai-moments" / "i2v_generation_manifest.json"

NEG = (
    " Do not morph faces, hands, vehicles, doors, luggage, or architecture. "
    "No text, logos, captions, UI. Subtle physically believable motion only. "
    "Preserve first-frame composition; do not redesign the scene."
)

CONSERVATIVE = (
    " Minimal motion only: barely perceptible movement, almost still photograph with life. "
    "Lock geometry; no camera orbit."
)

CLIPS_SPEC = [
    {
        "id": "01_volocar_dubai_moments_supercar_night_5s",
        "source_image_id": "01_volocar_dubai_moments_supercar_night",
        "master": "01_volocar_dubai_moments_supercar_night.jpg",
        "out": "01_volocar_dubai_moments_supercar_night_5s.mp4",
        "prompt": (
            "Photoreal cinematic 16:9 night Downtown Dubai. This exact photograph comes alive for five seconds. "
            "Preserve the supercar, wheels, paint, Burj Khalifa, skyline, road, traffic, and camera angle exactly. "
            "Car moves naturally forward at believable urban speed; wheels rotate correctly; subtle road parallax; "
            "Dubai traffic moves realistically; reflections shift subtly on bodywork; very slight stabilized camera tracking. "
            "Architecture stays stable. No dramatic acceleration, no orbit, no morphing."
        ),
    },
    {
        "id": "02_volocar_dubai_moments_girls_night_5s",
        "source_image_id": "02_volocar_dubai_moments_girls_night",
        "master": "02_volocar_dubai_moments_girls_night.jpg",
        "out": "02_volocar_dubai_moments_girls_night_5s.mp4",
        "prompt": (
            "Photoreal 16:9 blue-hour Dubai boulevard, red Mustang convertible. Five seconds, same composition. "
            "Driver stays focused on road; friends show subtle natural enjoyment — small smiles, slight head turns "
            "toward each other, hair in wind, one may steady hair; no waving, no arms raised, no turning to camera. "
            "Mustang moves naturally; background parallax; controlled camera. Preserve four occupants and car geometry."
        ),
    },
    {
        "id": "03_volocar_dubai_moments_the_arrival_5s",
        "source_image_id": "03_volocar_dubai_moments_the_arrival",
        "master": "03_volocar_dubai_moments_the_arrival.jpg",
        "out": "03_volocar_dubai_moments_the_arrival_5s.mp4",
        "prompt": (
            "Photoreal luxury hotel arrival, Rolls-Royce, five seconds. Extremely restrained motion: valet holds/opens door "
            "naturally; passenger begins small believable step out; partner subtle shift; background staff activity minimal. "
            "Rolls-Royce and doors stay geometrically stable. No posing, no orbit, no warped doors or hands."
        ),
    },
    {
        "id": "04_volocar_dubai_moments_morning_escape_5s",
        "source_image_id": "04_volocar_dubai_moments_morning_escape",
        "master": "04_volocar_dubai_moments_morning_escape.jpg",
        "out": "04_volocar_dubai_moments_morning_escape_5s.mp4",
        "prompt": (
            "Photoreal sunrise desert road toward Dubai, five seconds. Convertible travels forward naturally; "
            "correct wheel motion; road parallax; gentle atmospheric haze; subtle camera tracking; stable skyline. "
            "No drift, no racing, no dust explosion, no dramatic acceleration."
        ),
    },
    {
        "id": "05_volocar_dubai_moments_marina_night_5s",
        "source_image_id": "05_volocar_dubai_moments_marina_night",
        "master": "05_volocar_dubai_moments_marina_night.jpg",
        "out": "05_volocar_dubai_moments_marina_night_5s.mp4",
        "prompt": (
            "Photoreal Dubai Marina night, luxury GT, five seconds. Vehicle moves naturally through marina; "
            "subtle pedestrians; gentle water/yacht reflections; city lights stable; restrained camera drift only. "
            "Not a car commercial; preserve scene layout."
        ),
    },
    {
        "id": "06_volocar_dubai_moments_arrival_dubai_5s",
        "source_image_id": "06_volocar_dubai_moments_arrival_dubai",
        "master": "06_volocar_dubai_moments_arrival_dubai.jpg",
        "out": "06_volocar_dubai_moments_arrival_dubai_5s.mp4",
        "prompt": (
            "Photoreal airport arrival pickup, five seconds. Traveller and host subtle believable motion; "
            "host handles luggage naturally; traveller near SUV; vehicle stable; subtle background activity. "
            "No handshake, no keys, no posing toward camera."
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
    url = f"{HIGGSFIELD_API_BASE}{path}"
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "Authorization": auth_header(),
        "Accept": "application/json",
        "User-Agent": "tdg-volocar-dubai-moments-i2v/higgsfield",
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
    return float(body.get("usd"))


def poll_request(request_id: str, max_attempts: int = 100, sleep_s: float = 4.0) -> dict:
    for _ in range(max_attempts):
        body = hf_json("GET", f"/requests/{request_id}/status")
        status = str(body.get("status") or "").lower()
        if status in {"completed", "succeeded", "success"}:
            return body
        if status in {"failed", "error", "cancelled"}:
            raise RuntimeError(f"job {request_id} failed: {body}")
        time.sleep(sleep_s)
    raise TimeoutError(f"job {request_id} timed out")


def video_url_from_status(body: dict) -> str | None:
    video = body.get("video")
    if isinstance(video, dict) and isinstance(video.get("url"), str):
        return video["url"]
    if isinstance(body.get("video_url"), str):
        return body["video_url"]
    return None


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-volocar-dubai-moments-i2v/higgsfield"})
    with urllib.request.urlopen(req, timeout=300) as resp, dest.open("wb") as f:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            f.write(chunk)


def upload_image(path: Path) -> str:
    ctype = "image/jpeg"
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
        "codec": stream.get("codec_name"),
        "size": int(fmt.get("size") or 0),
    }


def qc_video(path: Path) -> tuple[bool, str]:
    pr = ffprobe(path)
    if pr["width"] < 1280 or pr["height"] < 720:
        return False, f"resolution {pr['width']}x{pr['height']}"
    if pr["duration"] < 4.0 or pr["duration"] > 6.5:
        return False, f"duration {pr['duration']}"
    if pr["size"] < 150_000:
        return False, f"size {pr['size']}"
    return True, "ok"


def run_one(spec: dict, spent: list[float], conservative: bool = False) -> dict:
    master = MASTERS / spec["master"]
    if not master.exists():
        raise FileNotFoundError(master)
    i2v_still = I2V_STILLS / spec["master"].replace(".jpg", "_1920x1080.jpg")
    out_path = CLIPS / spec["out"]
    entry: dict = {
        "id": spec["id"],
        "source_image_id": spec["source_image_id"],
        "source_master": str(master),
        "model": VIDEO_MODEL,
        "duration_s": DURATION,
        "asset_type": "short_clip",
        "project": "volocar",
        "collection": "dubai_moments",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "provider": "higgsfield",
    }

    if out_path.exists() and out_path.stat().st_size > 500_000:
        pr = ffprobe(out_path)
        ok, reason = qc_video(out_path)
        entry.update({"status": "REUSED", "path": str(out_path), "probe": pr, "qc": reason if ok else f"fail:{reason}"})
        return entry

    ensure_1920x1080(master, i2v_still)
    public_url = upload_image(i2v_still)
    prompt = spec["prompt"] + NEG
    if conservative:
        prompt += CONSERVATIVE

    est = parse_usd(
        hf_json(
            "POST",
            f"/estimate/{VIDEO_MODEL}",
            {"image_url": public_url, "prompt": prompt, "duration": DURATION, "sound": "off"},
        )
    )
    if spent[0] + est > BUDGET_USD:
        raise RuntimeError(f"budget exceeded before {spec['id']} est=${est:.4f}")
    sub = hf_json(
        "POST",
        f"/{VIDEO_MODEL}",
        {"image_url": public_url, "prompt": prompt, "duration": DURATION, "sound": "off"},
    )
    job_id = str(sub.get("request_id") or "")
    if not job_id:
        raise RuntimeError(f"submit failed {spec['id']}: {sub}")
    entry["job_id"] = job_id
    entry["generation_cost_usd"] = est
    entry["hf_upload_url"] = public_url
    spent[0] += est
    print(f"SUBMITTED {spec['id']} job={job_id} est=${est:.4f}", flush=True)
    done = poll_request(job_id)
    vurl = video_url_from_status(done)
    if not vurl:
        raise RuntimeError(f"missing video url {spec['id']}")
    download(vurl, out_path)
    pr = ffprobe(out_path)
    ok, reason = qc_video(out_path)
    entry.update(
        {
            "path": str(out_path),
            "probe": pr,
            "qc_status": "pass" if ok else "fail",
            "qc_detail": reason,
            "status": "OK" if ok else "QC_FAIL",
            "credits": done.get("credits"),
        }
    )
    return entry


def submit_only(spec: dict, spent: list[float], conservative: bool) -> dict:
    """Upload + submit; returns entry with job_id before poll."""
    master = MASTERS / spec["master"]
    i2v_still = I2V_STILLS / spec["master"].replace(".jpg", "_1920x1080.jpg")
    out_path = CLIPS / spec["out"]
    if out_path.exists() and out_path.stat().st_size > 500_000:
        return {"spec": spec, "reused": True, "out_path": out_path}

    ensure_1920x1080(master, i2v_still)
    public_url = upload_image(i2v_still)
    prompt = spec["prompt"] + NEG + (CONSERVATIVE if conservative else "")
    est = parse_usd(
        hf_json(
            "POST",
            f"/estimate/{VIDEO_MODEL}",
            {"image_url": public_url, "prompt": prompt, "duration": DURATION, "sound": "off"},
        )
    )
    if spent[0] + est > BUDGET_USD:
        raise RuntimeError(f"budget exceeded {spec['id']}")
    sub = hf_json(
        "POST",
        f"/{VIDEO_MODEL}",
        {"image_url": public_url, "prompt": prompt, "duration": DURATION, "sound": "off"},
    )
    job_id = str(sub.get("request_id") or "")
    if not job_id:
        raise RuntimeError(f"submit failed {spec['id']}")
    spent[0] += est
    print(f"SUBMITTED {spec['id']} job={job_id} est=${est:.4f}", flush=True)
    return {
        "spec": spec,
        "job_id": job_id,
        "est": est,
        "public_url": public_url,
        "prompt": prompt,
        "conservative": conservative,
    }


def finish_job(pending: dict, spent_track: list[float]) -> dict:
    spec = pending["spec"]
    out_path = CLIPS / spec["out"]
    done = poll_request(pending["job_id"])
    vurl = video_url_from_status(done)
    if not vurl:
        raise RuntimeError(f"missing url {spec['id']}")
    download(vurl, out_path)
    pr = ffprobe(out_path)
    ok, reason = qc_video(out_path)
    return {
        "id": spec["id"],
        "source_image_id": spec["source_image_id"],
        "source_master": str(MASTERS / spec["master"]),
        "model": VIDEO_MODEL,
        "duration_s": DURATION,
        "job_id": pending["job_id"],
        "generation_cost_usd": pending["est"],
        "hf_upload_url": pending["public_url"],
        "path": str(out_path),
        "probe": pr,
        "qc_status": "pass" if ok else "fail",
        "qc_detail": reason,
        "status": "OK" if ok else "QC_FAIL",
        "attempt": 2 if pending.get("conservative") else 1,
        "asset_type": "short_clip",
        "project": "volocar",
        "collection": "dubai_moments",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "provider": "higgsfield",
    }


def main() -> int:
    t0 = time.time()
    auth_header()
    CLIPS.mkdir(parents=True, exist_ok=True)
    I2V_STILLS.mkdir(parents=True, exist_ok=True)

    spent = [0.0]
    results: list[dict] = []
    retries: list[dict] = []

    # Parallel submit (uploads + API submit)
    pending_jobs: list[dict] = []
    with ThreadPoolExecutor(max_workers=MAX_SUBMIT_WORKERS) as ex:
        futs = {ex.submit(submit_only, spec, spent, False): spec for spec in CLIPS_SPEC}
        for fut in as_completed(futs):
            spec = futs[fut]
            try:
                res = fut.result()
                if res.get("reused"):
                    pr = ffprobe(res["out_path"])
                    results.append(
                        {
                            "id": spec["id"],
                            "source_image_id": spec["source_image_id"],
                            "status": "REUSED",
                            "path": str(res["out_path"]),
                            "probe": pr,
                        }
                    )
                else:
                    pending_jobs.append(res)
            except Exception as exc:
                results.append({"id": spec["id"], "status": "FAILED", "error": str(exc)[:500]})

    # Parallel poll + download
    with ThreadPoolExecutor(max_workers=MAX_SUBMIT_WORKERS) as ex:
        futs = {ex.submit(finish_job, p, spent): p for p in pending_jobs}
        for fut in as_completed(futs):
            p = futs[fut]
            try:
                entry = fut.result()
                if entry["status"] == "QC_FAIL" and entry.get("attempt", 1) <= MAX_RETRIES:
                    retries.append({"id": entry["id"], "reason": entry.get("qc_detail")})
                    print(f"RETRY {entry['id']} ({entry.get('qc_detail')})", flush=True)
                    retry_pending = submit_only(p["spec"], spent, True)
                    entry2 = finish_job(retry_pending, spent)
                    entry = entry2
                results.append(entry)
                print(f"DONE {entry['id']} status={entry.get('status')} ${entry.get('generation_cost_usd', 0):.4f}", flush=True)
            except Exception as exc:
                results.append({"id": p["spec"]["id"], "status": "FAILED", "error": str(exc)[:500]})

    total = round(sum(float(r.get("generation_cost_usd") or 0) for r in results), 4)
    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "model": VIDEO_MODEL,
        "duration_s": DURATION,
        "clips": results,
        "retries": retries,
        "total_usd": total,
        "elapsed_s": round(time.time() - t0, 1),
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"MANIFEST {MANIFEST} total_usd=${total} elapsed={manifest['elapsed_s']}s", flush=True)
    failed = [r for r in results if r.get("status") not in {"OK", "REUSED"}]
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
