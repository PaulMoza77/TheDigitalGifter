#!/usr/bin/env python3
"""Assemble Kling cut 2: 4 existing 1080x1920 masters, new order. Fails unless ffprobe is 1080x1920."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path("/workspace")
MASTERS_DIR = ROOT / "public/assets/christmas/instagram-reel-kling-1080p"
OUT_DIR = MASTERS_DIR
POSTERS = OUT_DIR / "posters"

# Remix of the existing Kling v3 Pro masters. Skip chalet; new story order.
CLIPS = [
    ("clip_02_santa_raw.mp4", 0.10, 2.70),
    ("clip_03_market_raw.mp4", 0.12, 2.70),
    ("clip_01_train_raw.mp4", 0.08, 2.70),
    ("clip_05_cozy_raw.mp4", 0.10, 3.00),
]
SLOW = 1.12
DEST = OUT_DIR / "final_christmas_reel_1080p_cut2.mp4"
POSTER = POSTERS / "final_cut2.jpg"


def probe(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,coded_width,coded_height,avg_frame_rate,bit_rate,codec_name,pix_fmt,nb_frames",
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
    fps_txt = stream.get("avg_frame_rate") or "0/1"
    if "/" in str(fps_txt):
        num, den = str(fps_txt).split("/")
        fps = float(num) / float(den) if float(den) else 0.0
    else:
        fps = float(fps_txt or 0)
    return {
        "path": str(path),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "coded_width": int(stream.get("coded_width") or 0),
        "coded_height": int(stream.get("coded_height") or 0),
        "fps": fps,
        "bitrate": int(fmt.get("bit_rate") or stream.get("bit_rate") or 0),
        "duration": float(fmt.get("duration") or 0),
        "size": int(fmt.get("size") or 0),
        "codec": stream.get("codec_name"),
        "pix_fmt": stream.get("pix_fmt"),
        "nb_frames": stream.get("nb_frames"),
    }


def assert_true_1080p(info: dict, label: str) -> None:
    print(
        f"FFPROBE {label}: {info['width']}x{info['height']} "
        f"bitrate={info['bitrate']} fps={info['fps']} duration={info['duration']:.3f}s",
        flush=True,
    )
    if info["width"] != 1080 or info["height"] != 1920:
        raise SystemExit(f"FAIL {label}: expected 1080x1920, got {info['width']}x{info['height']}")
    if info["bitrate"] < 10_000_000:
        raise SystemExit(f"FAIL {label}: bitrate {info['bitrate']} below 10 Mbps")


def export() -> None:
    inputs: list[str] = []
    filters: list[str] = []
    for i, (name, start, dur) in enumerate(CLIPS):
        src = MASTERS_DIR / name
        if not src.exists():
            raise SystemExit(f"missing master {src}")
        info = probe(src)
        print(f"MASTER {name}: {info['width']}x{info['height']} bitrate={info['bitrate']}", flush=True)
        if info["width"] < 1080 or info["height"] < 1920:
            raise SystemExit(f"FAIL master {name} is {info['width']}x{info['height']}")
        inputs.extend(["-i", str(src)])
        filters.append(
            f"[{i}:v]trim=start={start}:duration={dur},setpts={SLOW}*(PTS-STARTPTS),"
            f"fps=24,setsar=1,format=yuv420p,unsharp=5:5:0.45:5:5:0.00[v{i}]"
        )
    n = len(CLIPS)
    concat_in = "".join(f"[v{i}]" for i in range(n))
    filters.append(f"{concat_in}concat=n={n}:v=1:a=0[cat]")
    filters.append("[cat]format=yuv420p[out]")

    cmd = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[out]",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-profile:v",
        "high",
        "-level",
        "4.2",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "24",
        "-s",
        "1080x1920",
        "-b:v",
        "16M",
        "-minrate",
        "12M",
        "-maxrate",
        "20M",
        "-bufsize",
        "32M",
        "-x264-params",
        "nal-hrd=cbr:aq-mode=3:aq-strength=0.75",
        "-movflags",
        "+faststart",
        str(DEST),
    ]
    print("+ ffmpeg export", DEST.name, flush=True)
    subprocess.check_call(cmd)


def extract_poster() -> None:
    POSTERS.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-ss",
            "0.35",
            "-i",
            str(DEST),
            "-frames:v",
            "1",
            "-q:v",
            "3",
            str(POSTER),
        ]
    )


def main() -> int:
    export()
    info = probe(DEST)
    assert_true_1080p(info, "CUT2")
    extract_poster()
    report = {"CUT2": info, "order": [name for name, _, _ in CLIPS]}
    (OUT_DIR / "ffprobe_cut2.json").write_text(json.dumps(report, indent=2) + "\n")
    print("PASS 1080x1920 cut2", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
