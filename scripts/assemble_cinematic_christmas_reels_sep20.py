#!/usr/bin/env python3
"""Assemble three distinct 1080x1920 Christmas Reels from Sep 20 masters + Library.

Silent exports (no copyrighted music). Minimal text overlay on reels 1–2 only.
"""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
NEW = ROOT / "public/assets/christmas/cinematic-sep20/masters"
FINALS = ROOT / "public/assets/christmas/cinematic-sep20/final"
POSTERS = ROOT / "public/assets/christmas/cinematic-sep20/posters"
LOG = ROOT / "public/assets/christmas/cinematic-sep20/generation_manifest.json"
FONT = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"

LIB = {
    "master06": ROOT / "public/assets/christmas/reels/masters/christmas_master_06.mp4",
    "master07": ROOT / "public/assets/christmas/reels/masters/christmas_master_07.mp4",
    "master08": ROOT / "public/assets/christmas/reels/masters/christmas_master_08.mp4",
    "master01": ROOT / "public/assets/christmas/reels/masters/christmas_master_01.mp4",
    "master03": ROOT / "public/assets/christmas/reels/masters/christmas_master_03.mp4",
    "master04": ROOT / "public/assets/christmas/reels/masters/christmas_master_04.mp4",
    "train": ROOT / "public/assets/christmas/instagram-reel-kling-1080p/clip_01_train_raw.mp4",
    "cozy1": ROOT / "public/assets/christmas/cozy-reel/clip1.mp4",
    "cozy3": ROOT / "public/assets/christmas/cozy-reel/clip3.mp4",
    "plaza": ROOT / "public/assets/christmas/global-reel/masters/global_04_plaza.mp4",
    "alps": ROOT / "public/assets/christmas/global-reel/masters/global_02_alps.mp4",
    "home": ROOT / "public/assets/christmas/global-reel/masters/global_03_home.mp4",
    "palace": ROOT / "public/assets/christmas/luxury-palace/masters/palace_05_hero.mp4",
    "living": ROOT / "public/assets/christmas/instagram-reel/clip_04.mp4",
    "cocoa": ROOT / "public/assets/christmas/instagram-reel/clip_03.mp4",
}

N = {
    "train": NEW / "cinematic_01_polar_express.mp4",
    "truck": NEW / "cinematic_02_coca_cola_truck.mp4",
    "house": NEW / "cinematic_03_home_alone_house.mp4",
    "rock": NEW / "cinematic_04_rockefeller.mp4",
    "plaza": NEW / "cinematic_05_plaza_hotel.mp4",
    "london": NEW / "cinematic_06_santa_london.mp4",
    "workshop": NEW / "cinematic_07_workshop.mp4",
    "grinch": NEW / "cinematic_08_grinch.mp4",
}

# shots: src, start, duration, zoom (1.0–1.08), id, transition_from_prev (cut|fade)
REELS = [
    {
        "id": "reel-nostalgia-01",
        "filename": "christmas_movie_nostalgia_reel_01.mp4",
        "title": "Christmas Movie Nostalgia — Reel 01",
        "overlay": "Christmas felt different back then.",
        "overlay_end": 2.4,
        "xfade": 0.28,
        "shots": [
            (N["house"], 0.08, 2.70, 1.05, "cinematic_03_home_alone_house", "cut"),
            (N["train"], 0.10, 2.65, 1.03, "cinematic_01_polar_express", "fade"),
            (N["rock"], 0.12, 2.55, 1.04, "cinematic_04_rockefeller", "fade"),
            (N["plaza"], 0.10, 2.55, 1.03, "cinematic_05_plaza_hotel", "fade"),
            (LIB["cozy1"], 0.25, 2.55, 1.04, "reel-cozy-01", "fade"),
            (LIB["master07"], 0.30, 2.70, 1.05, "short-christmas-master-07", "fade"),
        ],
    },
    {
        "id": "reel-magic-02",
        "filename": "christmas_magic_reel_02.mp4",
        "title": "Christmas Magic — Reel 02",
        "overlay": "POV: Christmas is real.",
        "overlay_end": 1.8,
        "xfade": 0.12,
        "shots": [
            (N["london"], 0.04, 2.35, 1.06, "cinematic_06_santa_london", "cut"),
            (N["train"], 0.08, 2.20, 1.04, "cinematic_01_polar_express", "cut"),
            (N["workshop"], 0.10, 2.25, 1.03, "cinematic_07_workshop", "cut"),
            (LIB["master06"], 0.15, 2.20, 1.04, "short-christmas-master-06", "cut"),
            (N["truck"], 0.08, 2.25, 1.03, "cinematic_02_coca_cola_truck", "cut"),
            (N["rock"], 0.20, 2.55, 1.06, "cinematic_04_rockefeller", "fade"),
        ],
    },
    {
        "id": "reel-perfect-03",
        "filename": "the_perfect_christmas_reel_03.mp4",
        "title": "The Perfect Christmas — Reel 03",
        "overlay": None,
        "overlay_end": 0,
        "xfade": 0.22,
        "shots": [
            (N["house"], 0.06, 2.45, 1.04, "cinematic_03_home_alone_house", "cut"),
            (LIB["cozy1"], 0.20, 2.35, 1.03, "reel-cozy-01", "fade"),
            (LIB["master04"], 0.15, 2.25, 1.03, "short-christmas-master-04", "fade"),
            (LIB["alps"], 0.18, 2.30, 1.04, "short-global-02-alps", "cut"),
            (LIB["home"], 0.12, 2.35, 1.03, "short-global-03-home", "fade"),
            (N["house"], 2.20, 2.55, 1.06, "cinematic_03_home_alone_house", "fade"),
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


def shot_filter(i: int, start: float, dur: float, zoom: float) -> str:
    # Gentle Ken Burns: scale slightly larger then crop with a slow pan.
    z = max(1.0, min(zoom, 1.12))
    return (
        f"[{i}:v]trim=start={start}:duration={dur},setpts=PTS-STARTPTS,"
        f"fps=30,scale=1080*{z:.3f}:1920*{z:.3f}:flags=lanczos,"
        f"crop=1080:1920:x='(in_w-1080)*t/{dur:.3f}*0.85':y='(in_h-1920)*t/{dur:.3f}*0.45',"
        f"setsar=1,eq=contrast=1.03:saturation=1.04:gamma=0.98,unsharp=5:5:0.35:5:5:0.0,format=yuv420p[v{i}]"
    )


def export_reel(reel: dict) -> dict:
    dest = FINALS / reel["filename"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    shots = reel["shots"]
    xfade = float(reel["xfade"])
    inputs: list[str] = []
    filters: list[str] = []
    durs: list[float] = []
    modes: list[str] = []
    for i, (src, start, dur, zoom, _lid, mode) in enumerate(shots):
        if not Path(src).exists():
            raise FileNotFoundError(src)
        inputs.extend(["-i", str(src)])
        filters.append(shot_filter(i, start, dur, zoom))
        durs.append(dur)
        modes.append(mode)

    n = len(shots)
    if n == 1:
        filters.append("[v0]copy[base]")
    else:
        current = "v0"
        offset = durs[0]
        for i in range(1, n):
            nxt = f"v{i}"
            out = "base" if i == n - 1 else f"x{i}"
            if modes[i] == "fade":
                fade_at = max(0.05, offset - xfade)
                filters.append(
                    f"[{current}][{nxt}]xfade=transition=fade:duration={xfade:.3f}:offset={fade_at:.3f}[{out}]"
                )
                offset = offset + durs[i] - xfade
            else:
                filters.append(f"[{current}][{nxt}]concat=n=2:v=1:a=0[{out}]")
                offset = offset + durs[i]
            current = out

    overlay = reel.get("overlay")
    if overlay:
        text = overlay.replace(":", r"\:").replace("'", r"\'")
        end = float(reel.get("overlay_end") or 2.0)
        filters.append(
            f"[base]drawtext=fontfile={FONT}:text='{text}':fontsize=44:"
            f"fontcolor=white@0.92:borderw=2:bordercolor=black@0.45:"
            f"x=(w-text_w)/2:y=h*0.14:enable='between(t,0.35,{end:.2f})',format=yuv420p[out]"
        )
        mapped = "[out]"
    else:
        filters.append("[base]format=yuv420p[out]")
        mapped = "[out]"

    cmd = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filters),
        "-map",
        mapped,
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
    if info["duration"] < 12.0 or info["duration"] > 15.4:
        raise RuntimeError(f"{dest.name} duration {info['duration']} outside 12–15s window")
    poster = POSTERS / f"{reel['id']}.jpg"
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", "0.35", "-i", str(dest), "-frames:v", "1", "-q:v", "3", str(poster)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    info["poster"] = str(poster)
    return info


def main() -> int:
    FINALS.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)
    report = []
    for reel in REELS:
        info = export_reel(reel)
        used = [s[4] for s in reel["shots"]]
        row = {
            "id": reel["id"],
            "title": reel["title"],
            "file": str(FINALS / reel["filename"]),
            "probe": info,
            "clips_used": used,
            "overlay": reel.get("overlay"),
            "audio": "none",
        }
        report.append(row)
        print(
            f"{reel['id']} {info['duration']:.3f}s {info['width']}x{info['height']} "
            f"{info['bitrate']/1e6:.2f}Mbps clips={used}",
            flush=True,
        )

    log = json.loads(LOG.read_text()) if LOG.exists() else {}
    log["reels"] = report
    log["reels_assembled_at"] = datetime.now(timezone.utc).isoformat()
    log["status"] = "COMPLETE"
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(log, indent=2) + "\n")
    print("All 3 reels written.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
