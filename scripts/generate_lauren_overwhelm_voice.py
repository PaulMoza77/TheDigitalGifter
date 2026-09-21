#!/usr/bin/env python3
"""SUPERSEDED for production assembly.

The rushed speed=1.22 Lauren VO has been replaced by
scripts/fix_lauren_overwhelm_voice.py (audio-only, visual reused).

Do not use this script to regenerate the published master.
Keep it only as provenance of the original OpenAI gpt-4o-mini-tts integration.
"""

from __future__ import annotations

import json
import os
import subprocess
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
AUDIO = ROOT / "public" / "assets" / "christmas" / "lauren-overwhelm" / "audio"
MANIFEST = ROOT / "public" / "assets" / "christmas" / "lauren-overwhelm" / "voice_manifest.json"

PREVIEW_TEXT = "This is Lauren. She loves Christmas… but every year, she has the same problem."

CUES = [
    {
        "id": "s1",
        "text": "This is Lauren. She loves Christmas… but every year, she has the same problem.",
        "target": 4.85,
    },
    {
        "id": "s2",
        "text": "Gifts. Dinner. Decorations. School events. Family plans… and somehow, she’s supposed to remember all of it.",
        "target": 4.95,
    },
    {
        "id": "s3",
        "text": "And the closer Christmas gets, the longer the list becomes… and the more expensive everything feels.",
        "target": 4.95,
    },
    {
        "id": "s4",
        "text": "She’s planning Christmas for everyone else… but she’s running out of time to actually enjoy it herself.",
        "target": 4.55,
    },
    {
        "id": "s5",
        "text": "Then Lauren finds a simpler way to keep Christmas together.",
        "target": 4.70,
    },
    {
        "id": "s6",
        "text": "Now the gifts, budget, meals and plans finally have a place… so Lauren can enjoy Christmas too.",
        "target": 4.55,
    },
    {
        "id": "cta",
        "text": "Plan less. Enjoy Christmas more.",
        "target": 2.10,
    },
]

FULL_TEXT = " ".join(c["text"] for c in CUES)
SPEED = 1.22

INSTRUCTIONS = (
    "You are a warm American English woman in her mid-thirties telling a friend's story. "
    "Calm, relatable, slightly conversational, emotionally responsive. "
    "Not a commercial, not a salesperson, not a movie trailer, not a TikTok AI voice. "
    "Speak as if sitting across from someone with cocoa, gently explaining Lauren's Christmas overwhelm "
    "and then the relief when she finds a simpler way. "
    "Natural pacing, small breaths between thoughts. Soften on the stress, lift slightly on the discovery, "
    "and end warm and resolved. Do not over-act."
)

MODEL = "gpt-4o-mini-tts"
VOICE = "coral"
# OpenAI gpt-4o-mini-tts is billed per character; ~$0.015 / 1k chars at typical TTS HD rates.
# Preview + full is tiny compared with Kling.


def openai_key() -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise SystemExit("BLOCKED: OPENAI_API_KEY missing")
    return key


def tts(text: str, dest: Path, fmt: str = "wav", speed: float = SPEED) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)

    def call(payload: dict) -> None:
        body = json.dumps(payload).encode()
        req = urllib.request.Request(
            "https://api.openai.com/v1/audio/speech",
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {openai_key()}",
                "Content-Type": "application/json",
                "Accept": f"audio/{'wav' if fmt == 'wav' else 'mpeg'}",
            },
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            dest.write_bytes(resp.read())

    payload = {
        "model": MODEL,
        "voice": VOICE,
        "input": text,
        "instructions": INSTRUCTIONS,
        "response_format": fmt,
        "speed": speed,
    }
    try:
        call(payload)
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        if "speed" in err.lower() or e.code == 400:
            payload.pop("speed", None)
            try:
                call(payload)
            except urllib.error.HTTPError as e2:
                raise RuntimeError(f"OpenAI TTS {e2.code} {e2.read().decode()[:600]}") from e2
        else:
            raise RuntimeError(f"OpenAI TTS {e.code} {err[:600]}") from e
    if dest.stat().st_size < 2000:
        raise RuntimeError(f"TTS empty: {dest}")
    return probe(dest)


def fit_duration(src: Path, target: float) -> dict:
    info = probe(src)
    dur = info["duration"]
    if dur <= 0.2 or abs(dur - target) < 0.18:
        return info
    ratio = dur / target
    if ratio <= 1.02:
        return info
    atempo = min(1.28, max(1.02, ratio))
    tmp = src.with_suffix(".fit.wav")
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", str(src), "-filter:a", f"atempo={atempo:.4f}", str(tmp)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    tmp.replace(src)
    return probe(src)


def probe(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,bit_rate,size",
            "-of",
            "json",
            str(path),
        ]
    )
    fmt = json.loads(raw).get("format") or {}
    return {
        "path": str(path.relative_to(ROOT)) if str(path).startswith(str(ROOT)) else str(path),
        "duration": float(fmt.get("duration") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
        "bitrate": int(fmt.get("bit_rate") or 0),
    }


def wav_to_mp3(src: Path, dest: Path) -> None:
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", str(src), "-codec:a", "libmp3lame", "-q:a", "2", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def estimate_usd(text: str) -> float:
    # Conservative upper bound for gpt-4o-mini-tts.
    return round(max(0.01, (len(text) / 1000) * 0.015), 4)


def main() -> int:
    AUDIO.mkdir(parents=True, exist_ok=True)
    preview_wav = AUDIO / "vo_preview_coral.wav"
    full_wav = AUDIO / "vo_lauren_overwhelm_full.wav"
    full_mp3 = AUDIO / "vo_lauren_overwhelm_full.mp3"

    preview_cost = estimate_usd(PREVIEW_TEXT)
    full_cost = estimate_usd(FULL_TEXT)
    print("=" * 72)
    print("VOICE ESTIMATE")
    print(f"  provider: OpenAI {MODEL} voice={VOICE}")
    print(f"  preview chars={len(PREVIEW_TEXT)} ~${preview_cost:.4f}")
    print(f"  full chars={len(FULL_TEXT)} ~${full_cost:.4f}")
    print(f"  TOTAL TTS ~${preview_cost + full_cost:.4f}")
    print("=" * 72, flush=True)

    import sys

    estimate_only = "--estimate-only" in sys.argv
    preview_only = "--preview-only" in sys.argv

    if estimate_only:
        MANIFEST.write_text(
            json.dumps(
                {
                    "status": "ESTIMATE_ONLY",
                    "provider": "openai",
                    "model": MODEL,
                    "voice": VOICE,
                    "estimated_usd": preview_cost + full_cost,
                },
                indent=2,
            )
            + "\n"
        )
        return 0

    print("Generating VOICE PREVIEW...", flush=True)
    preview_info = tts(PREVIEW_TEXT, preview_wav, "wav")
    print(f"PREVIEW {preview_info['duration']:.2f}s {preview_info['size']} bytes", flush=True)

    if preview_only:
        MANIFEST.write_text(
            json.dumps(
                {
                    "status": "PREVIEW_READY",
                    "provider": "openai",
                    "model": MODEL,
                    "voice": VOICE,
                    "speed": SPEED,
                    "preview": preview_info,
                    "estimated_usd": preview_cost,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
                indent=2,
            )
            + "\n"
        )
        return 0

    cue_infos = []
    files = []
    for cue in CUES:
        dest = AUDIO / f"vo_{cue['id']}.wav"
        print(f"Generating cue {cue['id']}...", flush=True)
        info = tts(cue["text"], dest, "wav")
        info = fit_duration(dest, cue["target"])
        print(f"  {cue['id']} {info['duration']:.2f}s (target {cue['target']:.2f})", flush=True)
        cue_infos.append({"id": cue["id"], "text": cue["text"], "target": cue["target"], **info})
        files.append(dest)

    concat_list = AUDIO / "vo_concat.txt"
    concat_list.write_text("".join(f"file '{p}'\n" for p in files))
    # Soft gaps: 0.18s between scenes 1-5, 0.45s after scene 4 (emotional pause), 0.12s before CTA.
    gaps = {"s1": 0.16, "s2": 0.14, "s3": 0.14, "s4": 0.42, "s5": 0.16, "s6": 0.12, "cta": 0.0}
    filter_parts = []
    inputs = []
    for i, cue in enumerate(CUES):
        inputs.extend(["-i", str(files[i])])
        delay = gaps[cue["id"]]
        if delay > 0:
            filter_parts.append(f"[{i}]apad=pad_dur={delay}[a{i}]")
        else:
            filter_parts.append(f"[{i}]anull[a{i}]")
    n = len(CUES)
    concat = "".join(f"[a{i}]" for i in range(n)) + f"concat=n={n}:v=0:a=1[out]"
    cmd = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filter_parts) + ";" + concat,
        "-map",
        "[out]",
        "-ar",
        "48000",
        "-ac",
        "1",
        str(full_wav),
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    wav_to_mp3(full_wav, full_mp3)
    full_info = probe(full_wav)
    mp3_info = probe(full_mp3)
    print(f"FULL {full_info['duration']:.2f}s wav + mp3", flush=True)

    MANIFEST.write_text(
        json.dumps(
            {
                "status": "VOICE_READY",
                "project": "Lauren — Christmas Overwhelm Story 01",
                "provider": "openai",
                "model": MODEL,
                "voice": VOICE,
                "speed": SPEED,
                "instructions": INSTRUCTIONS,
                "script": FULL_TEXT,
                "cues": cue_infos,
                "preview": preview_info,
                "full_wav": full_info,
                "full_mp3": mp3_info,
                "estimated_usd": round(preview_cost + sum(estimate_usd(c["text"]) for c in CUES), 4),
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            indent=2,
        )
        + "\n"
    )
    print("VOICE_READY", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
