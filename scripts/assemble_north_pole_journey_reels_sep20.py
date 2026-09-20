#!/usr/bin/env python3
"""Assemble 5 vertical 1080x1920 Christmas Reels from North Pole journey masters + Library.

Silent masters (no copyrighted music) so platform-native audio can be added later.
Minimal short text overlays on long reels 1–2 only.
"""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
NEW = ROOT / "public/assets/christmas/np-journey/masters"
FINALS = ROOT / "public/assets/christmas/np-journey/final"
POSTERS = ROOT / "public/assets/christmas/np-journey/posters"
LOG = ROOT / "public/assets/christmas/np-journey/generation_manifest.json"
FONT = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"

LIB = {
    "c_train": ROOT / "public/assets/christmas/cinematic-sep20/masters/cinematic_01_polar_express.mp4",
    "c_london": ROOT / "public/assets/christmas/cinematic-sep20/masters/cinematic_06_santa_london.mp4",
    "c_workshop": ROOT / "public/assets/christmas/cinematic-sep20/masters/cinematic_07_workshop.mp4",
    "c_house": ROOT / "public/assets/christmas/cinematic-sep20/masters/cinematic_03_home_alone_house.mp4",
    "c_plaza": ROOT / "public/assets/christmas/cinematic-sep20/masters/cinematic_05_plaza_hotel.mp4",
    "c_rock": ROOT / "public/assets/christmas/cinematic-sep20/masters/cinematic_04_rockefeller.mp4",
    "santa_wrap": ROOT / "public/assets/christmas/north-pole-santa/masters/santa_01_workshop.mp4",
    "santa_sleigh": ROOT / "public/assets/christmas/north-pole-santa/masters/santa_02_sleigh.mp4",
    "santa_desk": ROOT / "public/assets/christmas/north-pole-santa/masters/santa_03_desk.mp4",
    "lapland": ROOT / "public/assets/christmas/global-reel/masters/global_01_lapland.mp4",
    "alps": ROOT / "public/assets/christmas/global-reel/masters/global_02_alps.mp4",
    "home": ROOT / "public/assets/christmas/global-reel/masters/global_03_home.mp4",
    "plaza_g": ROOT / "public/assets/christmas/global-reel/masters/global_04_plaza.mp4",
    "master06": ROOT / "public/assets/christmas/reels/masters/christmas_master_06.mp4",
    "master07": ROOT / "public/assets/christmas/reels/masters/christmas_master_07.mp4",
    "master08": ROOT / "public/assets/christmas/reels/masters/christmas_master_08.mp4",
    "kling_train": ROOT / "public/assets/christmas/instagram-reel-kling-1080p/clip_01_train_raw.mp4",
    "cozy1": ROOT / "public/assets/christmas/cozy-reel/clip1.mp4",
    "cozy3": ROOT / "public/assets/christmas/cozy-reel/clip3.mp4",
}

N = {
    "window": NEW / "npj_01_train_window.mp4",
    "station": NEW / "npj_02_station.mp4",
    "aurora_w": NEW / "npj_03_aurora_window.mp4",
    "viaduct": NEW / "npj_04_viaduct_wide.mp4",
    "village": NEW / "npj_05_village_arrival.mp4",
    "street": NEW / "npj_06_workshop_street.mp4",
    "list": NEW / "npj_07_workshop_list.mp4",
    "wrap": NEW / "npj_08_wrapping.mp4",
    "sleigh_win": NEW / "npj_09_window_sleigh.mp4",
    "snowman": NEW / "npj_10_snowman.mp4",
    "plaza": NEW / "npj_11_plaza.mp4",
}

# shots: src, start, duration, zoom, library_id, transition_from_prev (cut|fade)
REELS = [
    {
        "id": "reel-np-journey-01",
        "filename": "the_journey_north_pole_reel_01.mp4",
        "title": "The Journey — Magical Train to the North Pole",
        "kind": "long-reel",
        "theme": "the-journey",
        "overlay": "Where is this train going?",
        "overlay_end": 2.2,
        "xfade": 0.18,
        "min_dur": 30.0,
        "max_dur": 46.0,
        "shots": [
            (N["viaduct"], 0.04, 3.15, 1.04, "npj_04_viaduct_wide", "cut"),
            (N["window"], 0.08, 2.85, 1.03, "npj_01_train_window", "cut"),
            (N["aurora_w"], 0.08, 3.05, 1.03, "npj_03_aurora_window", "fade"),
            (LIB["c_train"], 0.12, 2.55, 1.03, "short-cinematic-polar-express", "cut"),
            (N["station"], 0.10, 2.70, 1.03, "npj_02_station", "fade"),
            (N["village"], 0.08, 2.85, 1.03, "npj_05_village_arrival", "cut"),
            (N["street"], 0.10, 2.70, 1.03, "npj_06_workshop_street", "cut"),
            (N["list"], 0.10, 2.65, 1.02, "npj_07_workshop_list", "fade"),
            (N["wrap"], 0.12, 2.55, 1.03, "npj_08_wrapping", "cut"),
            (LIB["santa_sleigh"], 0.15, 2.45, 1.04, "short-santa-02-sleigh", "cut"),
            (N["sleigh_win"], 0.08, 2.90, 1.03, "npj_09_window_sleigh", "fade"),
            (N["plaza"], 0.10, 2.80, 1.03, "npj_11_plaza", "fade"),
        ],
    },
    {
        "id": "reel-follow-santa-02",
        "filename": "follow_santa_reel_02.mp4",
        "title": "Follow Santa — Christmas Eve",
        "kind": "long-reel",
        "theme": "follow-santa",
        "overlay": "Christmas Eve has begun…",
        "overlay_end": 2.0,
        "xfade": 0.14,
        "min_dur": 30.0,
        "max_dur": 46.0,
        "shots": [
            (N["list"], 0.06, 2.85, 1.03, "npj_07_workshop_list", "cut"),
            (LIB["santa_wrap"], 0.10, 2.55, 1.03, "short-santa-01-workshop", "cut"),
            (N["wrap"], 0.10, 2.55, 1.03, "npj_08_wrapping", "cut"),
            (N["street"], 0.08, 2.70, 1.03, "npj_06_workshop_street", "fade"),
            (LIB["santa_sleigh"], 0.08, 2.70, 1.04, "short-santa-02-sleigh", "cut"),
            (LIB["c_london"], 0.06, 2.85, 1.05, "short-cinematic-santa-london", "cut"),
            (LIB["master08"], 0.20, 2.45, 1.04, "short-christmas-master-08", "cut"),
            (LIB["c_rock"], 0.15, 2.35, 1.03, "short-cinematic-rockefeller", "fade"),
            (N["plaza"], 0.10, 2.45, 1.03, "npj_11_plaza", "cut"),
            (LIB["c_house"], 0.10, 2.35, 1.04, "short-cinematic-home-alone-house", "fade"),
            (N["sleigh_win"], 0.06, 3.15, 1.03, "npj_09_window_sleigh", "fade"),
            (LIB["cozy1"], 0.20, 2.55, 1.03, "reel-cozy-01", "fade"),
        ],
    },
    {
        "id": "reel-magical-night-03",
        "filename": "one_magical_christmas_night_reel_03.mp4",
        "title": "One Magical Christmas Night",
        "kind": "long-reel",
        "theme": "magical-christmas-night",
        "overlay": None,
        "overlay_end": 0,
        "xfade": 0.20,
        "min_dur": 30.0,
        "max_dur": 46.0,
        "shots": [
            (N["snowman"], 0.08, 2.85, 1.04, "npj_10_snowman", "cut"),
            (LIB["home"], 0.12, 2.35, 1.03, "short-global-03-home", "fade"),
            (LIB["lapland"], 0.10, 2.55, 1.04, "short-global-01-lapland", "cut"),
            (N["viaduct"], 0.06, 2.70, 1.04, "npj_04_viaduct_wide", "cut"),
            (N["window"], 0.10, 2.45, 1.03, "npj_01_train_window", "fade"),
            (N["village"], 0.10, 2.45, 1.03, "npj_05_village_arrival", "cut"),
            (LIB["c_workshop"], 0.12, 2.35, 1.03, "short-cinematic-workshop", "fade"),
            (LIB["c_london"], 0.08, 2.55, 1.05, "short-cinematic-santa-london", "cut"),
            (LIB["alps"], 0.15, 2.25, 1.03, "short-global-02-alps", "cut"),
            (LIB["plaza_g"], 0.12, 2.25, 1.03, "short-global-04-plaza", "fade"),
            (LIB["master07"], 0.20, 2.45, 1.04, "short-christmas-master-07", "fade"),
            (N["sleigh_win"], 0.20, 2.90, 1.03, "npj_09_window_sleigh", "fade"),
        ],
    },
    {
        "id": "reel-viral-short-04",
        "filename": "viral_train_north_pole_short_04.mp4",
        "title": "Viral Cut — Where is this train going?",
        "kind": "short-reel",
        "theme": "viral-train-hook",
        "overlay": None,
        "overlay_end": 0,
        "xfade": 0.08,
        "min_dur": 13.5,
        "max_dur": 16.8,
        "shots": [
            (N["viaduct"], 0.04, 2.15, 1.06, "npj_04_viaduct_wide", "cut"),
            (N["aurora_w"], 0.10, 1.95, 1.04, "npj_03_aurora_window", "cut"),
            (N["village"], 0.08, 1.90, 1.04, "npj_05_village_arrival", "cut"),
            (LIB["c_london"], 0.08, 1.95, 1.06, "short-cinematic-santa-london", "cut"),
            (N["sleigh_win"], 0.10, 2.15, 1.04, "npj_09_window_sleigh", "fade"),
            (N["viaduct"], 0.20, 1.85, 1.05, "npj_04_viaduct_wide", "cut"),
        ],
    },
    {
        "id": "reel-viral-night-05",
        "filename": "viral_most_magical_night_short_05.mp4",
        "title": "Viral Cut — The most magical Christmas night",
        "kind": "short-reel",
        "theme": "most-magical-night",
        "overlay": None,
        "overlay_end": 0,
        "xfade": 0.10,
        "min_dur": 13.5,
        "max_dur": 16.8,
        "shots": [
            (N["snowman"], 0.06, 2.05, 1.05, "npj_10_snowman", "cut"),
            (N["street"], 0.10, 1.90, 1.04, "npj_06_workshop_street", "cut"),
            (N["wrap"], 0.12, 1.80, 1.03, "npj_08_wrapping", "cut"),
            (LIB["santa_sleigh"], 0.10, 1.90, 1.05, "short-santa-02-sleigh", "cut"),
            (N["plaza"], 0.08, 1.90, 1.04, "npj_11_plaza", "cut"),
            (N["sleigh_win"], 0.08, 2.25, 1.04, "npj_09_window_sleigh", "fade"),
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
    z = max(1.0, min(zoom, 1.12))
    return (
        f"[{i}:v]trim=start={start}:duration={dur},setpts=PTS-STARTPTS,"
        f"fps=30,scale=1080*{z:.3f}:1920*{z:.3f}:flags=lanczos,"
        f"crop=1080:1920:x='(in_w-1080)*t/{dur:.3f}*0.55':y='(in_h-1920)*t/{dur:.3f}*0.35',"
        f"setsar=1,eq=contrast=1.03:saturation=1.04:gamma=0.98,unsharp=5:5:0.30:5:5:0.0,format=yuv420p,settb=1/30,fps=30[v{i}]"
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
                fade_dur = xfade
            else:
                fade_dur = min(0.08, xfade)
            fade_at = max(0.05, offset - fade_dur)
            filters.append(
                f"[{current}][{nxt}]xfade=transition=fade:duration={fade_dur:.3f}:offset={fade_at:.3f}[{out}]"
            )
            offset = offset + durs[i] - fade_dur
            current = out

    overlay = reel.get("overlay")
    if overlay:
        text = overlay.replace(":", r"\:").replace("'", r"\'")
        end = float(reel.get("overlay_end") or 2.0)
        filters.append(
            f"[base]drawtext=fontfile={FONT}:text='{text}':fontsize=42:"
            f"fontcolor=white@0.92:borderw=2:bordercolor=black@0.45:"
            f"x=(w-text_w)/2:y=h*0.12:enable='between(t,0.28,{end:.2f})',format=yuv420p[out]"
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
    if info["duration"] < reel["min_dur"] or info["duration"] > reel["max_dur"]:
        raise RuntimeError(f"{dest.name} duration {info['duration']} outside {reel['min_dur']}–{reel['max_dur']}s")
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
            "kind": reel["kind"],
            "theme": reel["theme"],
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
    print("All 5 reels written.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
