#!/usr/bin/env python3
"""Single-pass TRUE 1080x1920 export from master I2V clips. Fails unless ffprobe is 1080x1920."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path("/workspace")
GENERATED = ROOT / "generated"
FINAL = ROOT / "final"
FONT = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"

# Original generated masters (Kling v3 Pro 1080x1920), not previews.
MASTERS = [
    GENERATED / "clip_01_train_raw.mp4",
    GENERATED / "clip_02_santa_raw.mp4",
    GENERATED / "clip_03_market_raw.mp4",
    GENERATED / "clip_04_chalet_raw.mp4",
    GENERATED / "clip_05_cozy_raw.mp4",
]

# Early, more stable windows. Slight slowdown to tame camera/snow busyness.
# (start, source_duration) — after setpts=PTS*1.12 these become ~2.5s / 3.5s.
TRIMS = [
    (0.05, 2.24),  # train ~2.51s
    (0.08, 2.24),  # santa
    (0.08, 2.24),  # market
    (0.05, 2.24),  # chalet
    (0.08, 3.12),  # cozy ~3.49s
]
SLOW = 1.12


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


def print_gate(info: dict, label: str) -> None:
    print(f"FFPROBE {label}:")
    print(f"- width: {info['width']}")
    print(f"- height: {info['height']}")
    print(f"- bitrate: {info['bitrate']}")
    print(f"- fps: {info['fps']}")
    print(
        f"  coded={info['coded_width']}x{info['coded_height']} "
        f"duration={info['duration']:.3f}s size={info['size']}",
        flush=True,
    )


def assert_true_1080p(info: dict, label: str) -> None:
    print_gate(info, label)
    if info["width"] != 1080 or info["height"] != 1920:
        raise SystemExit(
            f"FAIL {label}: expected 1080x1920, got {info['width']}x{info['height']}"
        )
    if info["coded_width"] not in (1080, 0) or info["coded_height"] not in (1920, 0):
        if info["coded_width"] and info["coded_height"]:
            if info["coded_width"] != 1080 or info["coded_height"] != 1920:
                raise SystemExit(
                    f"FAIL {label}: coded {info['coded_width']}x{info['coded_height']}"
                )
    if info["bitrate"] < 10_000_000:
        raise SystemExit(f"FAIL {label}: bitrate {info['bitrate']} below 10 Mbps")


def export(dest: Path, overlay: str | None) -> None:
    inputs: list[str] = []
    filters: list[str] = []
    for i, (src, (start, dur)) in enumerate(zip(MASTERS, TRIMS)):
        if not src.exists():
            raise SystemExit(f"missing master {src}")
        info = probe(src)
        print(f"MASTER {src.name}: {info['width']}x{info['height']} bitrate={info['bitrate']}")
        if info["width"] < 1080 or info["height"] < 1920:
            raise SystemExit(
                f"FAIL master {src.name} is {info['width']}x{info['height']} (preview/proxy?)"
            )
        inputs.extend(["-i", str(src)])
        # Keep native 1080x1920 pixels. Do not scale. Mild unsharp only.
        chain = (
            f"[{i}:v]trim=start={start}:duration={dur},setpts={SLOW}*(PTS-STARTPTS),"
            "fps=24,setsar=1,format=yuv420p,unsharp=5:5:0.45:5:5:0.00[v{i}]".format(i=i)
        )
        filters.append(chain)
    n = len(MASTERS)
    concat_in = "".join(f"[v{i}]" for i in range(n))
    filters.append(f"{concat_in}concat=n={n}:v=1:a=0[cat]")
    if overlay:
        filters.append(
            "[cat]drawtext=fontfile={font}:text='{text}':fontsize=36:"
            "fontcolor=white@0.92:shadowcolor=black@0.40:shadowx=2:shadowy=2:"
            "x=(w-text_w)/2:y=h-160:enable='gte(t,0.6)',format=yuv420p[out]".format(
                font=FONT, text=overlay.replace("'", r"\'")
            )
        )
        out = "[out]"
    else:
        filters.append("[cat]format=yuv420p[out]")
        out = "[out]"

    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filters),
        "-map",
        out,
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
        str(dest),
    ]
    print("+ ffmpeg export", dest.name, flush=True)
    subprocess.check_call(cmd)


def main() -> int:
    FINAL.mkdir(parents=True, exist_ok=True)
    clean = FINAL / "final_christmas_reel_1080p.mp4"
    text = FINAL / "final_christmas_reel_1080p_text.mp4"
    export(clean, overlay=None)
    export(text, overlay="Christmas is getting closer")

    report = {}
    for label, path in [("CLEAN", clean), ("TEXT", text)]:
        info = probe(path)
        assert_true_1080p(info, label)
        report[label] = info

    (FINAL / "ffprobe_gate.json").write_text(json.dumps(report, indent=2) + "\n")
    (FINAL / "FFPROBE.txt").write_text(
        "\n".join(
            [
                "CLEAN",
                f"width: {report['CLEAN']['width']}",
                f"height: {report['CLEAN']['height']}",
                f"bitrate: {report['CLEAN']['bitrate']}",
                f"fps: {report['CLEAN']['fps']}",
                "",
                "TEXT",
                f"width: {report['TEXT']['width']}",
                f"height: {report['TEXT']['height']}",
                f"bitrate: {report['TEXT']['bitrate']}",
                f"fps: {report['TEXT']['fps']}",
                "",
            ]
        )
    )
    print("PASS 1080x1920", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
