#!/usr/bin/env python3
"""Generate additional talking-Santa name variants using the Daniel golden pipeline.

Reuses Daniel's Santa master (HF image URL) + same OpenAI TTS + MiniMax H3 ref-to-video.
Does NOT regenerate Daniel or the Santa still.
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

# Import shared pipeline from canary module (same repo, no production coupling).
sys.path.insert(0, str(Path(__file__).resolve().parent))
import talking_santa_canary as ts  # noqa: E402

NAMES = ["Emma", "Olivia", "Sophia", "Liam", "Noah"]
MAX_VIDEO_ATTEMPTS = 3
VIDEO_DURATION_SECONDS = 5  # Daniel reference used 5s request
BUDGET_USD = 4.0 * len(NAMES)


def dialogue_for(name: str) -> str:
    return f"Ho, ho, ho! Merry Christmas, {name}!"


def tts_instructions(name: str) -> str:
    return (
        "You are a warm, deep, older American Santa Claus recording a short personal Christmas video. "
        "Natural human speech — not robotic, not cartoonish, not announcer-like. "
        "Deliver 'Ho, ho, ho!' as one natural Santa laugh with breath and warmth, not three separate clipped words. "
        f"Pronounce the name {name} clearly at the end. No background music or sound effects."
    )


def synthesize_name_tts(name: str, dest: Path) -> dict:
    model = os.environ.get("TALKING_SANTA_TTS_MODEL", "gpt-4o-mini-tts")
    voice = os.environ.get("TALKING_SANTA_TTS_VOICE", "onyx")
    text = dialogue_for(name)
    payload: dict = {
        "model": model,
        "voice": voice,
        "input": text,
        "response_format": "mp3",
    }
    if "mini-tts" in model:
        payload["instructions"] = tts_instructions(name)
    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {ts.openai_key()}",
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
    dur_raw = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(dest)]
    )
    duration = float(dur_raw.decode().strip() or 0)
    return {
        "model": model,
        "voice": voice,
        "file": str(dest),
        "duration": duration,
        "dialogue": text,
        "estimated_usd": round(max(0.01, len(text) / 1000 * 0.015), 4),
        "latency_ms": int((time.time() - started) * 1000),
        "provider": "openai",
    }


def load_golden_image_url(golden_dir: Path) -> str:
    meta_path = golden_dir / "santa_master.json"
    if meta_path.exists():
        url = str(json.loads(meta_path.read_text()).get("hf_public_url") or "").strip()
        if url.startswith("http"):
            return url
    master = golden_dir / "santa_master_9x16.png"
    if master.exists():
        return ts.upload_file(master)
    raise SystemExit(f"Golden Santa master missing under {golden_dir}")


def slug(name: str) -> str:
    return name.strip().lower()


def generate_one(name: str, golden_dir: Path, out_dir: Path, image_url: str, force: bool) -> dict:
    s = slug(name)
    final_path = out_dir / f"talking_santa_{s}_final.mp4"
    if final_path.exists() and final_path.stat().st_size > 200_000 and not force:
        probe = ts.probe_summary(final_path)
        return {
            "name": name,
            "status": "REUSED",
            "final_mp4": str(final_path),
            "probe": probe,
            "cost_usd": 0.0,
        }

    speech_path = out_dir / f"speech_{s}.mp3"
    tts = synthesize_name_tts(name, speech_path)
    audio_url = ts.upload_file(speech_path)

    log: dict = {
        "name": name,
        "dialogue": tts["dialogue"],
        "tts": tts,
        "golden_image_url": image_url,
        "video_model": ts.VIDEO_MODEL,
        "video_prompt": ts.VIDEO_PROMPT,
        "duration_requested": VIDEO_DURATION_SECONDS,
        "attempts": [],
    }

    last_err = None
    for attempt in range(1, MAX_VIDEO_ATTEMPTS + 1):
        try:
            est = ts.estimate_video(image_url, audio_url, VIDEO_DURATION_SECONDS)
            print(f"{name} video attempt {attempt} est=${est['usd']:.4f}", flush=True)
            submitted = ts.hf_request(
                "POST",
                f"/{ts.VIDEO_MODEL}",
                {
                    "prompt": ts.VIDEO_PROMPT,
                    "duration": VIDEO_DURATION_SECONDS,
                    "aspect_ratio": "9:16",
                    "resolution": "2K",
                    "image_urls": [image_url],
                    "audio_urls": [audio_url],
                    "aigc_watermark": False,
                },
            )
            request_id = str(submitted.get("request_id") or "")
            if not request_id:
                raise RuntimeError(f"submit missing request_id: {submitted}")
            done = ts.poll_job(request_id)
            if str(done.get("status")).lower() not in {"completed", "succeeded"}:
                raise RuntimeError(f"status={done.get('status')} err={done.get('error')}")
            url = ts.video_url_from_status(done)
            if not url:
                raise RuntimeError("missing video url")
            attempt_path = out_dir / f"talking_santa_{s}_attempt{attempt}.mp4"
            ts.download(url, attempt_path)
            probe = ts.probe_summary(attempt_path)
            if probe["width"] < 1000 or probe["height"] < 1000:
                raise RuntimeError(f"bad resolution {probe['width']}x{probe['height']}")
            if not probe["has_audio"]:
                raise RuntimeError("missing audio stream")
            if probe["duration"] < 4.0 or probe["duration"] > 7.0:
                raise RuntimeError(f"duration out of band {probe['duration']}")

            ts.OUT = out_dir
            (out_dir / "qc").mkdir(parents=True, exist_ok=True)
            entry = {
                "attempt": attempt,
                "job_id": request_id,
                "generation_cost_usd": est["usd"],
                "probe": probe,
            }
            qc_frames = []
            for label, t in (
                ("first", 0.15),
                ("mid", max(probe["duration"] / 2, 0.5)),
                ("last", max(probe["duration"] - 0.2, 0.5)),
            ):
                frame = out_dir / "qc" / f"talking_santa_{s}_attempt{attempt}_{label}.jpg"
                subprocess.check_call(
                    [
                        "ffmpeg",
                        "-y",
                        "-ss",
                        str(t),
                        "-i",
                        str(attempt_path),
                        "-frames:v",
                        "1",
                        "-q:v",
                        "3",
                        str(frame),
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                qc_frames.append(str(frame))
            entry["qc_frames"] = qc_frames

            if final_path.exists():
                final_path.unlink()
            attempt_path.rename(final_path)
            log["attempts"].append(entry)
            log["status"] = "GENERATED"
            log["final_mp4"] = str(final_path)
            log["probe"] = probe
            log["cost_usd"] = round(float(tts["estimated_usd"]) + float(est["usd"]), 4)
            return log
        except Exception as err:
            last_err = str(err)
            print(f"{name} FAIL attempt {attempt}: {last_err}", flush=True)
            log["attempts"].append({"attempt": attempt, "error": last_err[:500]})
            time.sleep(4)

    log["status"] = "FAILED"
    log["error"] = last_err
    log["cost_usd"] = float(tts.get("estimated_usd") or 0)
    return log


def main() -> int:
    force = "--force" in sys.argv
    estimate_only = "--estimate-only" in sys.argv
    only = [a.split("=", 1)[1] for a in sys.argv if a.startswith("--only=")]
    names = [n for n in NAMES if not only or n in only[0].split(",")]
    if not names:
        raise SystemExit("no names selected")

    root = Path(os.environ.get("TDG_ROOT") or "/workspace")
    golden_dir = Path(
        os.environ.get("TDG_TALKING_SANTA_GOLDEN")
        or (root / "public" / "assets" / "library" / "test" / "talking-santa-canary-daniel")
    )
    out_dir = Path(
        os.environ.get("TDG_TALKING_SANTA_OUT")
        or (root / "public" / "assets" / "library" / "test" / "talking-santa-canary-daniel")
    )
    out_dir.mkdir(parents=True, exist_ok=True)

    ts.read_credentials()
    ts.openai_key()

    per_video = 0.01 + 0.13 * VIDEO_DURATION_SECONDS
    total_est = len(names) * per_video
    print("=" * 72)
    print("TALKING SANTA BATCH — Daniel golden pipeline reuse")
    print(f"  GOLDEN: {golden_dir}")
    print(f"  OUT: {out_dir}")
    print(f"  VIDEO: {ts.VIDEO_MODEL}  duration={VIDEO_DURATION_SECONDS}s")
    print(f"  TTS: OpenAI {os.environ.get('TALKING_SANTA_TTS_MODEL', 'gpt-4o-mini-tts')} / onyx")
    print(f"  NAMES: {', '.join(names)}")
    print(f"  ESTIMATE (no image regen): ~${total_est:.2f} for {len(names)} videos")
    print("=" * 72, flush=True)

    if estimate_only:
        return 0

    if total_est > BUDGET_USD:
        print(f"STOP: estimate ${total_est:.2f} > budget ${BUDGET_USD:.2f}", file=sys.stderr)
        return 3

    image_url = load_golden_image_url(golden_dir)
    print(f"REUSE Santa image URL (Daniel master)", flush=True)

    results = []
    total_cost = 0.0
    for name in names:
        print(f"\n--- {name} ---", flush=True)
        row = generate_one(name, golden_dir, out_dir, image_url, force=force)
        results.append(row)
        total_cost += float(row.get("cost_usd") or 0)

    manifest = {
        "status": "COMPLETE" if all(r.get("final_mp4") for r in results) else "PARTIAL",
        "golden_reference": str(golden_dir / "talking_santa_daniel_final.mp4"),
        "golden_image_url": image_url,
        "workflow": {
            "video_model": ts.VIDEO_MODEL,
            "image_model": "REUSE_DANIEL_MASTER",
            "tts_provider": "openai",
            "tts_model": os.environ.get("TALKING_SANTA_TTS_MODEL", "gpt-4o-mini-tts"),
            "tts_voice": os.environ.get("TALKING_SANTA_TTS_VOICE", "onyx"),
        },
        "videos": results,
        "total_cost_usd": round(total_cost, 4),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    (out_dir / "batch_names_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"status": manifest["status"], "total_cost_usd": total_cost, "count": len(results)}))
    return 0 if manifest["status"] == "COMPLETE" else 1


if __name__ == "__main__":
    raise SystemExit(main())
