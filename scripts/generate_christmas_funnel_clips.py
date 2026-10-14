#!/usr/bin/env python3
"""Christmas funnel creatives: 3×5s Higgsfield Kling I2V clips from the before photos.

Source stills are the public funnel before images. Each clip is the "after"
shown in the before/after filter on /funnel/homepage/christmas.

Fails closed if credentials are missing. Never uses Replicate.
Resumes a completed master — never resubmits a successful request.
Stops before any paid submit if the live estimate for new clips exceeds $1.80.
Credentials: HF_CREDENTIALS=KEY_ID:KEY_SECRET. Never print credential values.
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
DURATION = 5
BUDGET_USD = 1.80

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
FUNNEL = ROOT / "public" / "assets" / "funnel"
WEB = FUNNEL / "christmas-clips"
RAW = ROOT / "generated" / "christmas-funnel-clips" / "masters"
QC = ROOT / "generated" / "christmas-funnel-clips" / "qc"
LOG = WEB / "generation_manifest.json"

LOCK = (
    " Keep every face, age, clothing, pose, and the room identical to the source photo. "
    "No new people, no face swaps, no extra limbs, no morphing, no warped hands, "
    "no text, no logos, no captions, no zoom-only slideshow."
)

CLIPS = [
    {
        "id": "family",
        "before": FUNNEL / "christmas-before.png",
        "prompt": (
            "This exact family Christmas selfie comes alive for five seconds. "
            "Soft natural blinking and a tiny genuine smile. Christmas tree lights twinkle. "
            "A light drift of warm indoor snowflakes passes in front of the lens. "
            "Warm light shimmers. The camera stays almost still, with only a very slight living drift."
            + LOCK
        ),
    },
    {
        "id": "morning",
        "before": FUNNEL / "christmas-ex2-before.png",
        "prompt": (
            "This exact Christmas morning photo comes alive for five seconds. "
            "The little boy gently tugs the wrapping paper. The parents and sister smile softly. "
            "Tree lights twinkle. A few soft snowflakes drift through the warm room light. "
            "The camera holds steady."
            + LOCK
        ),
    },
    {
        "id": "gift",
        "before": FUNNEL / "christmas-ex3-before.png",
        "prompt": (
            "This exact photo of a boy in Christmas pajamas holding a wrapped gift comes alive for five seconds. "
            "He looks at the present with a small delighted smile and a natural blink. "
            "Tree lights twinkle behind him. A few soft snowflakes drift. The camera stays still."
            + LOCK
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
        "User-Agent": "tdg-christmas-funnel-clips/higgsfield",
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
    usd = float(body.get("usd")) if body.get("usd") is not None else float("nan")
    if not (usd >= 0):
        raise RuntimeError(f"live estimate missing usd: {body}")
    credits = body.get("credits")
    return {"usd": usd, "credits": None if credits is None else str(credits)}


def upload_image(path: Path) -> str:
    meta = hf_request("POST", "/files/generate-upload-url", {"content_type": "image/png"})
    public_url, upload_url = meta.get("public_url"), meta.get("upload_url")
    if not public_url or not upload_url:
        raise RuntimeError(f"upload URL missing fields: keys={list(meta.keys())}")
    headers = dict(meta.get("upload_headers") or {"Content-Type": "image/png"})
    req = urllib.request.Request(str(upload_url), data=path.read_bytes(), method="PUT", headers=headers)
    with urllib.request.urlopen(req, timeout=180) as resp:
        resp.read()
    return str(public_url)


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-christmas-funnel-clips/higgsfield"})
    with urllib.request.urlopen(req, timeout=180) as resp, tmp.open("wb") as f:
        while True:
            chunk = resp.read(256 * 1024)
            if not chunk:
                break
            f.write(chunk)
    tmp.replace(dest)


def probe(path: Path) -> dict:
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
        "duration": float(fmt.get("duration") or 0),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "codec": stream.get("codec_name"),
        "size": int(fmt.get("size") or path.stat().st_size),
    }


def validate_raw(info: dict) -> None:
    if info["duration"] < 3.0 or info["duration"] > 6.2:
        raise RuntimeError(f"duration {info['duration']} outside 3–6s")
    if info["width"] < 480 or info["height"] < 480:
        raise RuntimeError(f"resolution too small {info['width']}x{info['height']}")
    if info["size"] < 200_000:
        raise RuntimeError(f"file too small ({info['size']} bytes)")


def web_encode(src: Path, dest: Path) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-an",
            "-vf",
            "scale=720:-2:flags=lanczos",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "26",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    info = probe(dest)
    validate_raw(info)
    return info


def poster(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", "0.35", "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def qc_frames(src: Path, clip_id: str) -> None:
    QC.mkdir(parents=True, exist_ok=True)
    for label, t in (("first", 0.15), ("mid", 2.4), ("last", 4.6)):
        dest = QC / f"{clip_id}_{label}.jpg"
        subprocess.check_call(
            ["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


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


def video_url(body: dict) -> str | None:
    video = body.get("video")
    if isinstance(video, dict) and isinstance(video.get("url"), str):
        return video["url"]
    if isinstance(body.get("video_url"), str):
        return body["video_url"]
    return None


def load_log() -> dict:
    if LOG.exists():
        try:
            data = json.loads(LOG.read_text())
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
    return {}


def write_log(log: dict) -> None:
    WEB.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(log, indent=2) + "\n")


def web_ready(clip_id: str) -> bool:
    mp4 = WEB / f"{clip_id}.mp4"
    jpg = WEB / f"{clip_id}.jpg"
    if not mp4.exists() or not jpg.exists():
        return False
    try:
        validate_raw(probe(mp4))
    except Exception:
        return False
    return True


def main() -> int:
    estimate_only = "--estimate-only" in sys.argv
    read_credentials()
    print("HIGGSFIELD_AUTH: ping", flush=True)
    meta = hf_request("POST", "/files/generate-upload-url", {"content_type": "image/png"})
    if not meta.get("upload_url"):
        raise SystemExit("HIGGSFIELD_AUTH FAIL")
    print(f"HIGGSFIELD_AUTH: PASS\nMODEL: {MODEL_ID} duration={DURATION}s", flush=True)

    for d in (WEB, RAW, QC):
        d.mkdir(parents=True, exist_ok=True)

    prev = load_log()
    uploads: dict[str, str] = {}
    for clip in CLIPS:
        if not clip["before"].exists():
            raise SystemExit(f"missing before photo {clip['before']}")
        if web_ready(clip["id"]) and not estimate_only:
            print(f"SKIP {clip['id']} — web clip already valid", flush=True)
            continue
        print(f"Uploading {clip['before'].name}", flush=True)
        uploads[clip["id"]] = upload_image(clip["before"])

    estimates = []
    new_usd = 0.0
    print("=" * 72)
    print("LIVE HIGGSFIELD ESTIMATE")
    for clip in CLIPS:
        if clip["id"] not in uploads:
            prior = next((c for c in (prev.get("clips") or []) if c.get("id") == clip["id"]), {})
            est = {"usd": float(prior.get("generation_cost_usd") or 0), "credits": prior.get("credits")}
        else:
            est = parse_estimate(
                hf_request(
                    "POST",
                    ESTIMATE_PATH,
                    {
                        "image_url": uploads[clip["id"]],
                        "prompt": clip["prompt"],
                        "duration": DURATION,
                        "sound": "off",
                    },
                )
            )
            new_usd += est["usd"]
        estimates.append(est)
        print(f"  {clip['id']}: ${est['usd']:.4f} credits={est['credits']}", flush=True)
    print(f"NEW_ESTIMATE: ${new_usd:.4f}  cap=${BUDGET_USD:.2f}")
    print("=" * 72, flush=True)
    if new_usd > BUDGET_USD:
        print("STOP: estimate exceeds budget. No jobs submitted.", flush=True)
        return 3
    if estimate_only:
        return 0

    rows = [c for c in (prev.get("clips") or []) if web_ready(c.get("id", ""))]
    for clip, est in zip(CLIPS, estimates):
        if clip["id"] not in uploads:
            continue
        pending = next(
            (p for p in (prev.get("pending") or []) if p.get("id") == clip["id"] and p.get("job_id")),
            None,
        )
        if pending:
            request_id = str(pending["job_id"])
            print(f"RESUME {clip['id']} {request_id}", flush=True)
        else:
            print(f"SUBMIT {clip['id']}", flush=True)
            sub = hf_request(
                "POST",
                f"/{MODEL_ID}",
                {
                    "image_url": uploads[clip["id"]],
                    "prompt": clip["prompt"],
                    "duration": DURATION,
                    "sound": "off",
                },
            )
            request_id = str(sub.get("request_id") or "")
            if not request_id:
                raise RuntimeError(f"submit missing request_id for {clip['id']}: {list(sub.keys())}")
            prev.setdefault("pending", [])
            prev["pending"] = [p for p in prev["pending"] if p.get("id") != clip["id"]]
            prev["pending"].append({"id": clip["id"], "job_id": request_id, "at": datetime.now(timezone.utc).isoformat()})
            write_log(prev)
        done = poll_job(request_id)
        status = str(done.get("status") or "").lower()
        if status not in {"completed", "succeeded"}:
            raise RuntimeError(f"{clip['id']} failed status={done.get('status')} error={done.get('error')}")
        url = video_url(done)
        if not url:
            raise RuntimeError(f"{clip['id']} missing video url")
        raw_path = RAW / f"{clip['id']}.mp4"
        download(url, raw_path)
        raw_info = probe(raw_path)
        validate_raw(raw_info)
        qc_frames(raw_path, clip["id"])
        web_path = WEB / f"{clip['id']}.mp4"
        web_info = web_encode(raw_path, web_path)
        poster(raw_path, WEB / f"{clip['id']}.jpg")
        row = {
            "id": clip["id"],
            "before": str(clip["before"].relative_to(ROOT)),
            "clip": str(web_path.relative_to(ROOT)),
            "poster": str((WEB / f"{clip['id']}.jpg").relative_to(ROOT)),
            "job_id": request_id,
            "model": MODEL_ID,
            "duration_requested": DURATION,
            "generation_cost_usd": est["usd"],
            "credits": est["credits"],
            "raw_probe": raw_info,
            "web_probe": web_info,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        rows = [r for r in rows if r.get("id") != clip["id"]] + [row]
        prev["clips"] = rows
        prev["pending"] = [p for p in (prev.get("pending") or []) if p.get("id") != clip["id"]]
        prev["status"] = "partial"
        prev["updated_at"] = datetime.now(timezone.utc).isoformat()
        write_log(prev)
        print(f"CLIP OK {clip['id']} raw={raw_info['duration']:.2f}s web={web_info['size']}B", flush=True)

    prev["clips"] = rows
    prev["status"] = "ready" if len(rows) == len(CLIPS) else "partial"
    prev["model"] = MODEL_ID
    prev["provider"] = "higgsfield"
    prev["budget_usd"] = BUDGET_USD
    prev["updated_at"] = datetime.now(timezone.utc).isoformat()
    write_log(prev)
    print(f"DONE {len(rows)}/{len(CLIPS)}", flush=True)
    return 0 if len(rows) == len(CLIPS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
