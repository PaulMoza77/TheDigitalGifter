#!/usr/bin/env python3
"""Isolated TDG talking-Santa canary (Daniel). Higgsfield + OpenAI TTS only — no Replicate.

Workflow (best available on live HF catalog as of probe):
  1. recraft/v4.1/pro/text-to-image — reusable Santa master (9:16)
  2. OpenAI TTS — exact dialogue, Santa voice
  3. minimax/h3/reference-to-video — image + audio driven lip-sync (Kling Avatar not on account)

Does not touch content autopilot or Santa production pipeline.
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
IMAGE_MODEL = "recraft/v4.1/pro/text-to-image"
VIDEO_MODEL = "minimax/h3/reference-to-video"
DIALOGUE = "Ho, ho, ho! Merry Christmas, Daniel!"
RECIPIENT = "Daniel"
MAX_VIDEO_ATTEMPTS = 3
BUDGET_USD = 4.50

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
OUT = Path(
    os.environ.get("TDG_TALKING_SANTA_OUT")
    or (ROOT / "public" / "assets" / "library" / "test" / "talking-santa-canary-daniel")
)
MANIFEST = OUT / "canary_manifest.json"

SANTA_PROMPT = (
    "Ultra photorealistic vertical photograph of a real elderly warm male Santa Claus, chest-up portrait, "
    "looking directly into the camera with a natural friendly smile, mouth clearly visible and unobstructed "
    "through a full realistic white beard, premium traditional red Santa suit with white fur trim, "
    "natural skin texture and pores, soft cozy Christmas living room with decorated tree and warm fireplace "
    "bokeh behind him, cinematic but believable real human Santa recorded a personal video message, "
    "9:16 portrait composition, no text, no watermark, no cartoon, no CGI plastic skin, no extra people."
)

VIDEO_PROMPT = (
    "Photoreal chest-up Santa Claus from the reference image speaks directly to camera. "
    "Preserve exact face, beard, suit, and room from the reference. "
    "Accurate lip sync and mouth movement matching the provided audio. "
    "Natural blinking, subtle head motion, warm expression, steady eye contact. "
    "Minimal body motion. No morphing, no identity change, no camera cuts, no text."
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
    for path in (Path("/tmp/mozas-hf/app.env.partial"),):
        load_dotenv_file(path)
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
    print("BLOCKED: Higgsfield credentials missing", file=sys.stderr)
    raise SystemExit(2)


def auth_header() -> str:
    key_id, secret = read_credentials()
    return f"Key {key_id}:{secret}"


def openai_key() -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        print("BLOCKED: OPENAI_API_KEY missing", file=sys.stderr)
        raise SystemExit(2)
    return key


def hf_request(method: str, path_or_url: str, data: dict | None = None, timeout: int = 180) -> dict:
    url = path_or_url if path_or_url.startswith("http") else f"{HIGGSFIELD_API_BASE}{path_or_url}"
    body = None if data is None else json.dumps(data).encode()
    headers = {
        "Authorization": auth_header(),
        "User-Agent": "tdg-talking-santa-canary/higgsfield",
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


def upload_bytes(data: bytes, content_type: str) -> str:
    meta = hf_request("POST", "/files/generate-upload-url", {"content_type": content_type})
    upload_url = str(meta.get("upload_url") or "")
    public_url = str(meta.get("public_url") or "")
    if not upload_url or not public_url:
        raise RuntimeError("upload meta missing urls")
    headers = dict(meta.get("upload_headers") or {"Content-Type": content_type})
    req = urllib.request.Request(upload_url, data=data, method="PUT", headers=headers)
    with urllib.request.urlopen(req, timeout=180) as resp:
        resp.read()
    return public_url


def upload_file(path: Path) -> str:
    ctype = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    if path.suffix.lower() == ".mp3":
        ctype = "audio/mpeg"
    return upload_bytes(path.read_bytes(), ctype)


def poll_job(request_id: str, timeout_s: int = 1200) -> dict:
    start = time.time()
    while time.time() - start < timeout_s:
        current = hf_request("GET", f"/requests/{request_id}/status")
        status = str(current.get("status") or "")
        print(f"  {request_id} {status}", flush=True)
        if status.lower() in {"completed", "succeeded", "failed", "nsfw", "canceled", "cancelled", "error"}:
            return current
        time.sleep(8)
    raise TimeoutError(f"job {request_id} timed out")


def video_url_from_status(body: dict) -> str | None:
    video = body.get("video")
    if isinstance(video, dict) and isinstance(video.get("url"), str):
        return video["url"]
    if isinstance(body.get("video_url"), str):
        return body["video_url"]
    return None


def image_url_from_status(body: dict) -> str | None:
    images = body.get("images")
    if isinstance(images, list) and images:
        first = images[0]
        if isinstance(first, dict) and isinstance(first.get("url"), str):
            return first["url"]
        if isinstance(first, str) and first.startswith("http"):
            return first
    if isinstance(body.get("image_url"), str):
        return body["image_url"]
    return None


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-talking-santa-canary"})
    with urllib.request.urlopen(req, timeout=180) as resp, dest.open("wb") as f:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            f.write(chunk)


def ffprobe_full(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,width,height,avg_frame_rate,duration,bit_rate",
            "-show_entries",
            "format=duration,size,bit_rate",
            "-of",
            "json",
            str(path),
        ]
    )
    return json.loads(raw)


def probe_summary(path: Path) -> dict:
    data = ffprobe_full(path)
    vstream = next((s for s in (data.get("streams") or []) if s.get("codec_type") == "video"), {})
    astream = next((s for s in (data.get("streams") or []) if s.get("codec_type") == "audio"), {})
    fmt = data.get("format") or {}
    fps_txt = vstream.get("avg_frame_rate") or "0/1"
    if "/" in str(fps_txt):
        num, den = str(fps_txt).split("/")
        fps = float(num) / float(den) if float(den) else 0.0
    else:
        fps = float(fps_txt or 0)
    return {
        "path": str(path),
        "duration": float(fmt.get("duration") or vstream.get("duration") or 0),
        "width": int(vstream.get("width") or 0),
        "height": int(vstream.get("height") or 0),
        "fps": round(fps, 3),
        "has_audio": bool(astream),
        "audio_codec": astream.get("codec_name"),
        "size": int(fmt.get("size") or path.stat().st_size),
    }


def synthesize_tts(dest: Path) -> dict:
    model = os.environ.get("TALKING_SANTA_TTS_MODEL", "gpt-4o-mini-tts")
    voice = os.environ.get("TALKING_SANTA_TTS_VOICE", "onyx")
    instructions = (
        "You are a warm, deep, older American Santa Claus recording a short personal Christmas video. "
        "Natural human speech — not robotic, not cartoonish, not announcer-like. "
        "Deliver 'Ho, ho, ho!' as one natural Santa laugh with breath and warmth, not three separate clipped words. "
        "Pronounce the name Daniel clearly at the end. No background music or sound effects."
    )
    payload: dict = {
        "model": model,
        "voice": voice,
        "input": DIALOGUE,
        "response_format": "mp3",
    }
    if "mini-tts" in model:
        payload["instructions"] = instructions
    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {openai_key()}",
            "Content-Type": "application/json",
        },
    )
    started = time.time()
    with urllib.request.urlopen(req, timeout=120) as resp:
        mp3 = resp.read()
    if len(mp3) < 1000:
        raise RuntimeError("tts output too small")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(mp3)
    audio_probe = probe_summary(dest) if dest.suffix == ".mp4" else {}
    # mp3 duration via ffprobe
    dur_raw = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(dest)]
    )
    duration = float(dur_raw.decode().strip() or 0)
    est = round(max(0.01, len(DIALOGUE) / 1000 * 0.015), 4)
    return {
        "model": model,
        "voice": voice,
        "file": str(dest),
        "duration": duration,
        "estimated_usd": est,
        "latency_ms": int((time.time() - started) * 1000),
        "provider": "openai",
        **({"audio_probe": audio_probe} if audio_probe else {}),
    }


def estimate_video(image_url: str, audio_url: str, duration: int) -> dict:
    body = hf_request(
        "POST",
        f"/estimate/{VIDEO_MODEL}",
        {
            "prompt": VIDEO_PROMPT,
            "duration": duration,
            "aspect_ratio": "9:16",
            "image_urls": [image_url],
            "audio_urls": [audio_url],
            "aigc_watermark": False,
        },
    )
    usd = body.get("usd")
    if usd is None:
        # descriptive pricing: ~$0.13/s at 2K
        usd = round(0.13 * duration, 4)
        body["estimated_from_description"] = True
    return {"usd": float(usd), "credits": body.get("credits"), "raw": body}


def estimate_image() -> dict:
    body = hf_request(
        "POST",
        f"/estimate/{IMAGE_MODEL}",
        {"prompt": SANTA_PROMPT, "aspect_ratio": "9:16"},
    )
    usd = float(body.get("usd") or 0)
    if usd <= 0:
        raise RuntimeError(f"image estimate missing: {body}")
    return {"usd": usd, "credits": body.get("credits"), "raw": body}


def generate_image(force: bool = False) -> dict:
    master_png = OUT / "santa_master_9x16.png"
    master_meta = OUT / "santa_master.json"
    if master_png.exists() and master_png.stat().st_size > 100_000 and not force:
        meta = json.loads(master_meta.read_text()) if master_meta.exists() else {}
        return {**meta, "reused": True, "file": str(master_png)}
    est = estimate_image()
    print(f"IMAGE ESTIMATE ${est['usd']:.4f}", flush=True)
    submitted = hf_request("POST", f"/{IMAGE_MODEL}", {"prompt": SANTA_PROMPT, "aspect_ratio": "9:16"})
    request_id = str(submitted.get("request_id") or "")
    if not request_id:
        raise RuntimeError(f"image submit failed: {submitted}")
    done = poll_job(request_id)
    if str(done.get("status")).lower() not in {"completed", "succeeded"}:
        raise RuntimeError(f"image failed: {done.get('status')} {done.get('error')}")
    url = image_url_from_status(done)
    if not url:
        raise RuntimeError("image missing url")
    download(url, master_png)
    public = upload_file(master_png)
    entry = {
        "model": IMAGE_MODEL,
        "job_id": request_id,
        "file": str(master_png),
        "hf_public_url": public,
        "generation_cost_usd": est["usd"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    master_meta.write_text(json.dumps(entry, indent=2) + "\n")
    return entry


def generate_video(image_url: str, audio_url: str, duration: int, attempt: int) -> dict:
    est = estimate_video(image_url, audio_url, duration)
    print(f"VIDEO ESTIMATE attempt={attempt} ${est['usd']:.4f} duration={duration}s", flush=True)
    submitted = hf_request(
        "POST",
        f"/{VIDEO_MODEL}",
        {
            "prompt": VIDEO_PROMPT,
            "duration": duration,
            "aspect_ratio": "9:16",
            "resolution": "2K",
            "image_urls": [image_url],
            "audio_urls": [audio_url],
            "aigc_watermark": False,
        },
    )
    request_id = str(submitted.get("request_id") or "")
    if not request_id:
        raise RuntimeError(f"video submit failed: {submitted}")
    done = poll_job(request_id)
    if str(done.get("status")).lower() not in {"completed", "succeeded"}:
        raise RuntimeError(f"video failed: {done.get('status')} {done.get('error')}")
    url = video_url_from_status(done)
    if not url:
        raise RuntimeError("video missing url")
    dest = OUT / f"talking_santa_daniel_attempt{attempt}.mp4"
    download(url, dest)
    probe = probe_summary(dest)
    return {
        "attempt": attempt,
        "model": VIDEO_MODEL,
        "job_id": request_id,
        "file": str(dest),
        "probe": probe,
        "generation_cost_usd": est["usd"],
        "duration_requested": duration,
    }


def extract_qc_frame(video: Path, label: str, t: float) -> Path:
    qc = OUT / "qc"
    qc.mkdir(parents=True, exist_ok=True)
    dest = qc / f"{video.stem}_{label}.jpg"
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", str(t), "-i", str(video), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return dest


def main() -> int:
    estimate_only = "--estimate-only" in sys.argv
    force_image = "--force-image" in sys.argv

    read_credentials()
    openai_key()
    OUT.mkdir(parents=True, exist_ok=True)

    print("=" * 72)
    print("TDG TALKING SANTA CANARY — capability probe summary")
    print("Kling Avatar endpoints: NOT on TDG HF catalog (model_not_found)")
    print("Selected workflow:")
    print(f"  IMAGE: {IMAGE_MODEL}")
    print(f"  VOICE: OpenAI TTS (no Replicate)")
    print(f"  VIDEO: {VIDEO_MODEL} (image_urls + audio_urls)")
    print(f"  DIALOGUE: {DIALOGUE}")
    print("=" * 72, flush=True)

    tts_path = OUT / "speech_daniel.mp3"
    if tts_path.exists() and tts_path.stat().st_size > 1000 and "--force-tts" not in sys.argv:
        dur = float(
            subprocess.check_output(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(tts_path)]
            )
            .decode()
            .strip()
            or 0
        )
        tts = {"file": str(tts_path), "duration": dur, "reused": True, "estimated_usd": 0.0}
        print(f"REUSE TTS {tts_path} {dur:.2f}s", flush=True)
    else:
        print("Synthesizing TTS...", flush=True)
        tts = synthesize_tts(tts_path)
        print(f"TTS {tts['duration']:.2f}s voice={tts.get('voice')} ~${tts['estimated_usd']:.4f}", flush=True)

    audio_duration = float(tts["duration"] or 5)
    video_duration = 5 if audio_duration <= 5.8 else 6

    image_est = estimate_image()
    # MiniMax H3 estimate requires real media URLs; use published rate when pre-upload.
    video_est = {"usd": round(0.13 * video_duration, 4), "credits": None, "raw": {"pricing_description": "2K @ $0.13/s"}}
    total_est = image_est["usd"] + float(tts.get("estimated_usd") or 0) + float(video_est["usd"])
    print(f"ESTIMATED TOTAL (1 image + 1 video): ${total_est:.4f}", flush=True)
    print(f"  image ${image_est['usd']:.4f}  tts ${float(tts.get('estimated_usd') or 0):.4f}  video ${video_est['usd']:.4f}", flush=True)

    if estimate_only:
        MANIFEST.write_text(
            json.dumps(
                {
                    "status": "ESTIMATE_ONLY",
                    "workflow": {
                        "image_model": IMAGE_MODEL,
                        "video_model": VIDEO_MODEL,
                        "voice": "openai",
                    },
                    "estimated_usd": total_est,
                    "dialogue": DIALOGUE,
                },
                indent=2,
            )
            + "\n"
        )
        return 0

    if total_est > BUDGET_USD:
        print(f"STOP: estimate ${total_est:.4f} > budget ${BUDGET_USD:.2f}", flush=True)
        return 3

    print("Generating Santa master...", flush=True)
    image = generate_image(force=force_image)
    image_url = str(image.get("hf_public_url") or "")
    if not image_url:
        image_url = upload_file(Path(image["file"]))
    audio_url = upload_file(tts_path)

    log: dict = {
        "status": "RUNNING",
        "dialogue": DIALOGUE,
        "recipient": RECIPIENT,
        "workflow": {
            "image_model": IMAGE_MODEL,
            "video_model": VIDEO_MODEL,
            "voice_provider": "openai",
            "voice_model": tts.get("model"),
            "voice_id": tts.get("voice"),
            "kling_avatar_available": False,
        },
        "santa_master": image,
        "tts": tts,
        "attempts": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    last_err = None
    for attempt in range(1, MAX_VIDEO_ATTEMPTS + 1):
        try:
            print(f"VIDEO GENERATION attempt {attempt}/{MAX_VIDEO_ATTEMPTS}", flush=True)
            entry = generate_video(image_url, audio_url, video_duration, attempt)
            entry["qc_frames"] = [
                str(extract_qc_frame(Path(entry["file"]), "first", 0.15)),
                str(extract_qc_frame(Path(entry["file"]), "mid", max(entry["probe"]["duration"] / 2, 0.5))),
                str(extract_qc_frame(Path(entry["file"]), "last", max(entry["probe"]["duration"] - 0.2, 0.5))),
            ]
            log["attempts"].append(entry)
            final = Path(entry["file"])
            final_copy = OUT / "talking_santa_daniel_final.mp4"
            if final_copy.exists():
                final_copy.unlink()
            final.rename(final_copy)
            entry["file"] = str(final_copy)
            log["final_mp4"] = str(final_copy)
            log["final_probe"] = entry["probe"]
            log["status"] = "GENERATED"
            break
        except Exception as err:
            last_err = str(err)
            print(f"ATTEMPT {attempt} FAIL: {last_err}", flush=True)
            log["attempts"].append({"attempt": attempt, "error": last_err[:500]})
            time.sleep(4)
    else:
        log["status"] = "FAILED"
        log["error"] = last_err

    billed = [float(a.get("generation_cost_usd") or 0) for a in log["attempts"] if isinstance(a.get("generation_cost_usd"), (int, float))]
    log["actual_cost_usd"] = round(
        float(image.get("generation_cost_usd") or 0) + float(tts.get("estimated_usd") or 0) + sum(billed),
        4,
    )
    MANIFEST.write_text(json.dumps(log, indent=2) + "\n")
    print(json.dumps({"status": log["status"], "final": log.get("final_mp4"), "cost": log["actual_cost_usd"]}))
    return 0 if log.get("final_mp4") else 1


if __name__ == "__main__":
    raise SystemExit(main())
