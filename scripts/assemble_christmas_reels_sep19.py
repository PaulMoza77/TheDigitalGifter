#!/usr/bin/env python3
"""Assemble 5 vertical 1080x1920 Christmas Reels from Sep 19 Kling masters + Library."""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
MASTERS = ROOT / "public/assets/christmas/reels/masters"
KLING = ROOT / "public/assets/christmas/instagram-reel-kling-1080p"
COZY = ROOT / "public/assets/christmas/cozy-reel"
FINALS = ROOT / "public/assets/christmas/reels/final"
POSTERS = ROOT / "public/assets/christmas/reels/posters"
LOG = ROOT / "public/assets/christmas/reels/generation_manifest_sep19.json"

N06 = MASTERS / "christmas_master_06.mp4"
N07 = MASTERS / "christmas_master_07.mp4"
N08 = MASTERS / "christmas_master_08.mp4"
N09 = MASTERS / "christmas_master_09.mp4"
N10 = MASTERS / "christmas_master_10.mp4"
L_TRAIN = KLING / "clip_01_train_raw.mp4"
L_SANTA = KLING / "clip_02_santa_raw.mp4"
L_MARKET = KLING / "clip_03_market_raw.mp4"
L_CHALET = MASTERS / "christmas_master_01.mp4"
L_SLED = MASTERS / "christmas_master_03.mp4"
L_COOKIES = MASTERS / "christmas_master_04.mp4"
L_COZY = COZY / "clip1.mp4"

# (src, start, duration, library_id_or_new)
REELS = [
    {
        "id": "reel-01",
        "filename": "reel-01.mp4",
        "title": "Polar Express arrival",
        "xfade": 0.22,
        "shots": [
            (N10, 0.06, 3.35, "christmas_master_10"),
            (N09, 0.18, 3.20, "christmas_master_09"),
            (L_TRAIN, 0.10, 3.10, "reel-kling-01-train"),
            (N06, 0.25, 3.55, "christmas_master_06"),
        ],
    },
    {
        "id": "reel-02",
        "filename": "reel-02.mp4",
        "title": "Santa's village night",
        "xfade": 0.20,
        "shots": [
            (N06, 0.08, 3.30, "christmas_master_06"),
            (L_SLED, 0.18, 3.05, "short-christmas-master-03"),
            (N08, 0.12, 3.25, "christmas_master_08"),
            (N07, 0.20, 3.40, "christmas_master_07"),
        ],
    },
    {
        "id": "reel-03",
        "filename": "reel-03.mp4",
        "title": "Alps to fireside",
        "xfade": 0.28,
        "shots": [
            (N08, 0.10, 3.35, "christmas_master_08"),
            (L_CHALET, 0.20, 3.25, "short-christmas-master-01"),
            (L_COZY, 0.20, 3.30, "reel-cozy-01"),
            (L_COOKIES, 0.15, 3.20, "short-christmas-master-04"),
        ],
    },
    {
        "id": "reel-04",
        "filename": "reel-04.mp4",
        "title": "Sleigh ride home",
        "xfade": 0.22,
        "shots": [
            (N08, 0.05, 3.40, "christmas_master_08"),
            (L_SANTA, 0.10, 3.05, "reel-kling-02-santa"),
            (L_MARKET, 0.12, 3.00, "reel-kling-03-market"),
            (N07, 0.25, 3.45, "christmas_master_07"),
        ],
    },
    {
        "id": "reel-05",
        "filename": "reel-05.mp4",
        "title": "Believe — Christmas trailer",
        "xfade": 0.18,
        "shots": [
            (N10, 0.04, 2.85, "christmas_master_10"),
            (N08, 0.08, 2.70, "christmas_master_08"),
            (L_TRAIN, 0.08, 2.55, "reel-kling-01-train"),
            (N06, 0.15, 2.70, "christmas_master_06"),
            (N07, 0.35, 2.95, "christmas_master_07"),
        ],
    },
]


def probe(path: Path) -> dict:
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
    fps_txt = stream.get("avg_frame_rate") or "0/1"
    if "/" in str(fps_txt):
        num, den = str(fps_txt).split("/")
        fps = float(num) / float(den) if float(den) else 0.0
    else:
        fps = float(fps_txt or 0)
    return {
        "filename": path.name,
        "duration": float(fmt.get("duration") or 0),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "codec": stream.get("codec_name"),
        "fps": round(fps, 3),
        "bitrate": int(fmt.get("bit_rate") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
    }


def export_reel(dest: Path, shots: list, xfade: float) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    inputs: list[str] = []
    filters: list[str] = []
    durs: list[float] = []
    for i, (src, start, dur, _lid) in enumerate(shots):
        if not src.exists():
            raise FileNotFoundError(src)
        inputs.extend(["-i", str(src)])
        filters.append(
            f"[{i}:v]trim=start={start}:duration={dur},setpts=PTS-STARTPTS,"
            f"fps=30,scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p[v{i}]"
        )
        durs.append(dur)

    n = len(shots)
    if n == 1:
        filters.append("[v0]copy[out]")
    else:
        current = "v0"
        offset = durs[0] - xfade
        for i in range(1, n):
            nxt = f"v{i}"
            out = "out" if i == n - 1 else f"x{i}"
            filters.append(
                f"[{current}][{nxt}]xfade=transition=fade:duration={xfade}:offset={offset:.3f}[{out}]"
            )
            current = out
            if i < n - 1:
                offset = offset + durs[i] - xfade

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
        "30",
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
        "-movflags",
        "+faststart",
        str(dest),
    ]
    print("+ ffmpeg", dest.name, flush=True)
    subprocess.check_call(cmd)
    info = probe(dest)
    if info["width"] != 1080 or info["height"] != 1920:
        raise RuntimeError(f"{dest.name} not 1080x1920")
    if info["duration"] < 11.5 or info["duration"] > 16.5:
        raise RuntimeError(f"{dest.name} duration {info['duration']} outside 12–15s window")
    return info


def poster(src: Path, dest: Path, t: float = 0.35) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> int:
    FINALS.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)
    report = []
    for reel in REELS:
        dest = FINALS / reel["filename"]
        info = export_reel(dest, reel["shots"], reel["xfade"])
        poster(dest, POSTERS / f"{reel['id']}.jpg")
        new_used = [s[3] for s in reel["shots"] if str(s[0]).endswith(tuple(f"christmas_master_{n}.mp4" for n in ("06", "07", "08", "09", "10")))]
        lib_used = [s[3] for s in reel["shots"] if s[3] not in new_used]
        row = {
            "id": reel["id"],
            "title": reel["title"],
            "file": str(dest),
            "probe": info,
            "new_clips": new_used,
            "library_clips": lib_used,
            "shots": [
                {"src": s[0].name, "start": s[1], "duration": s[2], "id": s[3]} for s in reel["shots"]
            ],
        }
        report.append(row)
        print(
            f"{reel['id']} {info['duration']:.3f}s {info['width']}x{info['height']} "
            f"{info['bitrate']/1e6:.2f}Mbps new={new_used} lib={lib_used}",
            flush=True,
        )

    if LOG.exists():
        log = json.loads(LOG.read_text())
    else:
        log = {}
    log["reels"] = report
    log["reels_assembled_at"] = datetime.now(timezone.utc).isoformat()
    log["status"] = "COMPLETE"
    LOG.write_text(json.dumps(log, indent=2) + "\n")
    print("All 5 reels written.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
