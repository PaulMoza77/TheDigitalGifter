#!/usr/bin/env python3
"""Assemble 10 vertical Christmas Reels (10–12s) from existing Library short clips.

Hard cuts only (ffmpeg concat) — no xfade, no Higgsfield / new AI generation.
Outputs public/assets/christmas/library-montage-oct15/ + catalog TS.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
PUBLIC = ROOT / "public"
OUT = PUBLIC / "assets/christmas/library-montage-oct15"
FINALS = OUT / "final"
POSTERS = OUT / "posters"
SILENT = OUT / "silent"
MANIFEST = OUT / "montage_manifest.json"
CATALOG_TS = ROOT / "src/features/admin-library/libraryMontageOct15Catalog.ts"

MUSIC_DIR = PUBLIC / "assets/music/christmas"
MUSIC_BY_MOOD = {
    "calm": "silent-night-lofi.mp3",
    "cozy": "god-rest-ye-merry-gentlemen-synthwave.mp3",
    "nostalgic": "auld-lang-syne-lofi.mp3",
    "emotional": "o-holy-night-lofi.mp3",
    "warm": "angels-we-have-heard-lofi.mp3",
    "upbeat": "joy-to-the-world-synthwave.mp3",
    "magical": "the-first-noel-synthwave.mp3",
    "cinematic": "we-three-kings-synthwave.mp3",
}

CATALOG_SOURCES = [
    "src/features/admin-library/catalog.ts",
    "src/features/admin-library/christmas20BatchCatalog.ts",
    "src/features/admin-library/christmasMemoriesEurope1990sCatalog.ts",
]


def load_short_paths() -> dict[str, Path]:
    text = ""
    for rel in CATALOG_SOURCES:
        path = ROOT / rel
        if path.exists():
            text += path.read_text(encoding="utf-8")
    pairs = re.findall(r'id: "(short-[^"]+)"[\s\S]*?src: "(/assets/[^"]+\.mp4)"', text)
    out: dict[str, Path] = {}
    for lid, src in pairs:
        out.setdefault(lid, PUBLIC / src.lstrip("/"))
    return out


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
        "duration": float(fmt.get("duration") or 0),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "codec": stream.get("codec_name"),
        "fps": round(fps, 3),
        "bitrate": int(fmt.get("bit_rate") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
    }


def has_audio(path: Path) -> bool:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a",
            "-show_entries",
            "stream=codec_type",
            "-of",
            "csv=p=0",
            str(path),
        ],
        stderr=subprocess.DEVNULL,
    )
    return b"audio" in raw


def shot_filter(i: int, start: float, dur: float, zoom: float) -> str:
    z = max(1.0, min(zoom, 1.08))
    return (
        f"[{i}:v]trim=start={start}:duration={dur},setpts=PTS-STARTPTS,"
        f"fps=30,scale=1080*{z:.3f}:1920*{z:.3f}:flags=lanczos,"
        f"crop=1080:1920:x='(in_w-1080)*t/{dur:.3f}*0.82':y='(in_h-1920)*t/{dur:.3f}*0.42',"
        f"setsar=1,eq=contrast=1.03:saturation=1.04:gamma=0.98,unsharp=5:5:0.32:5:5:0.0,"
        f"format=yuv420p,settb=1/30,fps=30[v{i}]"
    )


def clamp_shots(shorts: dict[str, Path], shots: list[tuple]) -> list[tuple]:
    out = []
    for lid, start, dur, zoom in shots:
        src = shorts[lid]
        if not src.exists():
            raise FileNotFoundError(f"{lid} -> {src}")
        info = probe(src)
        max_dur = max(0.35, info["duration"] - start - 0.05)
        used = min(dur, max_dur)
        if used < 0.35:
            raise RuntimeError(f"{lid} too short after clamp ({info['duration']}s start={start})")
        out.append((src, start, used, zoom, lid))
    return out


def export_silent_reel(dest: Path, clamped: list[tuple]) -> float:
    """Hard-cut concat only — no xfade."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    inputs: list[str] = []
    filters: list[str] = []
    durs: list[float] = []
    for i, (src, start, dur, zoom, _lid) in enumerate(clamped):
        inputs.extend(["-i", str(src)])
        filters.append(shot_filter(i, start, dur, zoom))
        durs.append(dur)

    n = len(clamped)
    if n == 1:
        filters.append("[v0]format=yuv420p[out]")
    else:
        concat_in = "".join(f"[v{i}]" for i in range(n))
        filters.append(f"{concat_in}concat=n={n}:v=1:a=0[base]")
        filters.append("[base]format=yuv420p[out]")

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
        "medium",
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
    print("+ ffmpeg silent", dest.name, flush=True)
    subprocess.check_call(cmd)
    return sum(durs)


def mix_music(video: Path, music: Path, out: Path, duration: float) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    fade_in, fade_out = 0.6, 1.4
    fade_out_start = max(0, duration - fade_out)
    filt = (
        f"[1:a]afade=t=in:st=0:d={fade_in},afade=t=out:st={fade_out_start}:d={fade_out},"
        f"atrim=0:{duration},asetpts=PTS-STARTPTS,volume=0.88[aout]"
    )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video),
            "-stream_loop",
            "-1",
            "-i",
            str(music),
            "-filter_complex",
            filt,
            "-map",
            "0:v:0",
            "-map",
            "[aout]",
            "-t",
            str(duration),
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(out),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def blackdetect(path: Path) -> list[dict]:
    proc = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-i",
            str(path),
            "-vf",
            "blackdetect=d=0.08:pix_th=0.10",
            "-an",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
    )
    hits = []
    for line in (proc.stderr or "").splitlines():
        if "blackdetect" in line and "black_start" in line:
            hits.append({"line": line.strip()})
    return hits


def poster(src: Path, dest: Path, t: float = 0.45) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


# shots: (library_id, start, duration, zoom) — all hard cuts
# Target each reel ~10–12s (sum of durations)
REELS = [
    {
        "id": "reel-cut-01-express-punch",
        "filename": "reel-cut-01-express-punch.mp4",
        "title": "Express Punch · 11s",
        "concept": "Hard-cut Christmas Express — gifts hook, viaduct flashes, station hold",
        "mood": "upbeat",
        "shots": [
            ("short-cx-05-santa-gifts", 0.04, 1.60, 1.04),
            ("short-cx-02-sunset-viaduct", 0.06, 1.80, 1.03),
            ("short-cx-04-aurora-viaduct", 0.08, 2.00, 1.03),
            ("short-npj-04-viaduct-wide", 0.10, 1.80, 1.03),
            ("short-cx-03-station", 0.10, 3.80, 1.02),
        ],
    },
    {
        "id": "reel-cut-02-santa-night",
        "filename": "reel-cut-02-santa-night.mp4",
        "title": "Santa Night · 11s",
        "concept": "Santa sprint — sleigh, workshop, London, moon bedroom payoff",
        "mood": "magical",
        "shots": [
            ("short-santa-02-sleigh", 0.04, 1.80, 1.05),
            ("short-santa-01-workshop", 0.08, 1.80, 1.03),
            ("short-cinematic-santa-london", 0.05, 2.00, 1.04),
            ("short-npj-09-window-sleigh", 0.10, 1.80, 1.03),
            ("short-c20-20-bedroom-santa-moon-finished", 0.20, 3.60, 1.02),
        ],
    },
    {
        "id": "reel-cut-03-nyc-flash",
        "filename": "reel-cut-03-nyc-flash.mp4",
        "title": "NYC Flash · 11s",
        "concept": "Manhattan holiday punch — Saks, Radio City, Rockefeller, penthouse",
        "mood": "cinematic",
        "shots": [
            ("short-c20-17-saks-rockefeller-finished", 0.08, 2.00, 1.04),
            ("short-c20-08-radio-city-finished", 0.10, 1.80, 1.03),
            ("short-nyc-winter-1990-02-rockefeller-tree", 0.06, 1.80, 1.03),
            ("short-c20-01-ny-awning-finished", 0.12, 1.80, 1.02),
            ("short-c20-10-penthouse-empire-finished", 0.12, 3.60, 1.02),
        ],
    },
    {
        "id": "reel-cut-04-alpine-cut",
        "filename": "reel-cut-04-alpine-cut.mp4",
        "title": "Alpine Cut · 11s",
        "concept": "Swiss dawn hard cuts — sunrise, fireplace, ski, breakfast",
        "mood": "warm",
        "shots": [
            ("short-swiss-alpine-01-sunrise-chalet", 0.04, 2.20, 1.03),
            ("short-swiss-alpine-02-fireplace", 0.06, 2.00, 1.01),
            ("short-swiss-alpine-03-christmas-tree", 0.08, 1.80, 1.02),
            ("short-swiss-alpine-04-ski-entry", 0.08, 1.80, 1.02),
            ("short-swiss-alpine-05-breakfast", 0.10, 3.20, 1.02),
        ],
    },
    {
        "id": "reel-cut-05-europe-post",
        "filename": "reel-cut-05-europe-post.mp4",
        "title": "Europe Post · 11s",
        "concept": "1990s Europe postcard — London, Paris, market, eve window",
        "mood": "nostalgic",
        "shots": [
            ("short-cme1990s-01-london", 0.04, 2.00, 1.03),
            ("short-cme1990s-02-paris-cafe", 0.06, 2.00, 1.03),
            ("short-cme1990s-06-christmas-market", 0.08, 2.20, 1.02),
            ("short-cme1990s-05-christmas-train", 0.08, 1.80, 1.03),
            ("short-cme1990s-10-eve-window", 0.10, 3.00, 1.02),
        ],
    },
    {
        "id": "reel-cut-06-hearth-snap",
        "filename": "reel-cut-06-hearth-snap.mp4",
        "title": "Hearth Snap · 11s",
        "concept": "Cozy family hard cuts — dog, stairs, dinner, alpine cabin",
        "mood": "emotional",
        "shots": [
            ("short-c20-16-library-dog-finished", 0.20, 2.40, 1.01),
            ("short-c20-14-stairs-morning-finished", 0.15, 1.80, 1.02),
            ("short-c20-13-home-alone-tv-finished", 0.12, 1.60, 1.02),
            ("short-c20-15-family-dinner-finished", 0.18, 2.40, 1.02),
            ("short-c20-12-alpine-cabin-finished", 0.22, 2.80, 1.02),
        ],
    },
    {
        "id": "reel-cut-07-palace-hit",
        "filename": "reel-cut-07-palace-hit.mp4",
        "title": "Palace Hit · 11s",
        "concept": "Luxury palace energy — establish, approach, gates, hero",
        "mood": "cinematic",
        "shots": [
            ("short-palace-01-establish", 0.04, 2.20, 1.03),
            ("short-palace-02-approach", 0.06, 1.80, 1.03),
            ("short-palace-03-gates", 0.08, 2.00, 1.02),
            ("short-palace-04-entrance", 0.08, 1.80, 1.02),
            ("short-palace-05-hero", 0.10, 3.20, 1.02),
        ],
    },
    {
        "id": "reel-cut-08-north-pole-beat",
        "filename": "reel-cut-08-north-pole-beat.mp4",
        "title": "North Pole Beat · 11s",
        "concept": "Journey beat — train window, aurora, workshop, village",
        "mood": "magical",
        "shots": [
            ("short-npj-01-train-window", 0.08, 2.00, 1.03),
            ("short-npj-03-aurora-window", 0.06, 2.20, 1.02),
            ("short-npj-06-workshop-street", 0.10, 1.80, 1.03),
            ("short-npj-08-wrapping", 0.12, 1.60, 1.02),
            ("short-npj-05-village-arrival", 0.14, 3.40, 1.02),
        ],
    },
    {
        "id": "reel-cut-09-movie-nostalgia",
        "filename": "reel-cut-09-movie-nostalgia.mp4",
        "title": "Movie Nostalgia · 11s",
        "concept": "Iconic Christmas movie energy — Home Alone, Polar Express, Rockefeller",
        "mood": "nostalgic",
        "shots": [
            ("short-cinematic-home-alone-house", 0.06, 2.20, 1.04),
            ("short-cinematic-polar-express", 0.08, 2.00, 1.03),
            ("short-cinematic-rockefeller", 0.10, 2.00, 1.03),
            ("short-cinematic-plaza-hotel", 0.08, 1.80, 1.03),
            ("short-christmas-master-07", 0.20, 3.00, 1.02),
        ],
    },
    {
        "id": "reel-cut-10-world-tour",
        "filename": "reel-cut-10-world-tour.mp4",
        "title": "World Tour · 11s",
        "concept": "Global Christmas flash — Lapland, Alps, plaza, White House",
        "mood": "upbeat",
        "shots": [
            ("short-global-01-lapland", 0.06, 2.00, 1.03),
            ("short-global-02-alps", 0.06, 1.80, 1.03),
            ("short-global-03-home", 0.08, 1.80, 1.02),
            ("short-global-04-plaza", 0.08, 2.20, 1.03),
            ("short-global-05-white-house", 0.10, 3.20, 1.02),
        ],
    },
]


def qc_reel(path: Path, planned_duration: float, clip_ids: list[str]) -> dict:
    info = probe(path)
    issues: list[str] = []
    lo, hi = 10.0, 12.5
    if info["width"] != 1080 or info["height"] != 1920:
        issues.append(f"resolution {info['width']}x{info['height']}")
    if info["duration"] < lo or info["duration"] > hi:
        issues.append(f"duration {info['duration']:.2f}s outside 10–12s window ({lo}-{hi})")
    if info["codec"] != "h264":
        issues.append(f"codec {info['codec']}")
    if not has_audio(path):
        issues.append("missing audio")
    blacks = blackdetect(path)
    if len(blacks) > 3:
        issues.append(f"blackdetect hits={len(blacks)}")
    if len(set(clip_ids)) < 4:
        issues.append("fewer than 4 distinct source clips")
    return {
        "pass": len(issues) == 0,
        "issues": issues,
        "probe": info,
        "planned_duration": planned_duration,
        "blackdetect": blacks,
    }


def write_catalog_ts(rows: list[dict]) -> None:
    created = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = [
        "/** Library cut reels assembled 2026-10-15 from existing short clips only (hard cuts, no new AI video). */",
        'import type { LibraryVideo } from "./catalog";',
        "",
        'const TAGS = ["christmas", "library-montage-oct15", "hard-cuts", "has-music", "ready-to-post", "existing-clips-only", "10s"] as const;',
        "",
        "export const LIBRARY_MONTAGE_OCT15_REELS: LibraryVideo[] = [",
    ]
    for row in rows:
        clips = row["clips_used"]
        music_file = row["music"]
        lines.append("  {")
        lines.append(f'    id: "{row["id"]}",')
        lines.append(f'    title: "{row["title"]}",')
        lines.append(
            f'    description: "{row["concept"]} · {row["probe"]["duration"]:.1f}s 1080×1920 H.264 + AAC. '
            f'Music: {music_file}. Hard-cut montage from existing Library shorts — $0 generation.",'
        )
        lines.append(f'    src: "/assets/christmas/library-montage-oct15/final/{row["filename"]}",')
        lines.append(f'    filename: "{row["filename"]}",')
        lines.append('    category: "christmas_reels",')
        lines.append('    kind: "reel",')
        lines.append(f'    durationSeconds: {row["probe"]["duration"]:.2f},')
        lines.append(f'    poster: "/assets/christmas/library-montage-oct15/posters/{row["id"]}.jpg",')
        lines.append("    width: 1080,")
        lines.append("    height: 1920,")
        lines.append(f'    fileSizeBytes: {row["probe"]["size"]},')
        lines.append(f'    createdAt: "{created}",')
        lines.append(f"    tags: [...TAGS, \"{row['mood']}\"],")
        lines.append("    costUsd: 0,")
        lines.append(f'    clipsUsed: {json.dumps(clips)},')
        lines.append('    productionId: "library-montage-oct15",')
        lines.append("  },")
    lines.append("];")
    lines.append("")
    CATALOG_TS.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    shorts = load_short_paths()
    needed = {s[0] for r in REELS for s in r["shots"]}
    missing = sorted(needed - set(shorts))
    if missing:
        print("Missing library ids:", missing, file=sys.stderr)
        return 2
    missing_files = [lid for lid in needed if not shorts[lid].exists()]
    if missing_files:
        print("Missing files:", missing_files, file=sys.stderr)
        return 2

    FINALS.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)
    SILENT.mkdir(parents=True, exist_ok=True)

    recent_music: list[str] = []
    report_rows: list[dict] = []
    qc_failures = 0

    for reel in REELS:
        clamped = clamp_shots(shorts, reel["shots"])
        planned = sum(s[2] for s in clamped)
        silent_path = SILENT / reel["filename"]
        export_silent_reel(silent_path, clamped)
        silent_info = probe(silent_path)

        mood = reel["mood"]
        track = MUSIC_BY_MOOD[mood]
        if track in recent_music[-2:]:
            track = next(t for t in MUSIC_BY_MOOD.values() if t not in recent_music[-2:])
        recent_music.append(track)
        music_path = MUSIC_DIR / track
        if not music_path.exists():
            print("Missing music", music_path, file=sys.stderr)
            return 2

        final_path = FINALS / reel["filename"]
        mix_music(silent_path, music_path, final_path, silent_info["duration"])
        poster(final_path, POSTERS / f"{reel['id']}.jpg", t=min(1.0, silent_info["duration"] * 0.12))

        clip_ids = [s[4] for s in clamped]
        qc = qc_reel(final_path, planned, clip_ids)
        if not qc["pass"]:
            qc_failures += 1
            print("QC FAIL", reel["id"], qc["issues"], flush=True)
        else:
            print(
                f"QC PASS {reel['id']} {qc['probe']['duration']:.2f}s music={track}",
                flush=True,
            )

        report_rows.append(
            {
                **reel,
                "music": track,
                "clips_used": clip_ids,
                "shots_resolved": [
                    {"library_id": s[4], "start": s[1], "duration": s[2], "transition": "cut"} for s in clamped
                ],
                "probe": qc["probe"],
                "qc": qc,
                "path": str(final_path.relative_to(ROOT)),
            }
        )

    MANIFEST.write_text(
        json.dumps(
            {
                "assembled_at": datetime.now(timezone.utc).isoformat(),
                "ai_generation_cost_usd": 0,
                "edit_style": "hard_cuts_only",
                "reels_requested": 10,
                "reels_produced": len(report_rows),
                "qc_failures": qc_failures,
                "duration_target": "10-12s",
                "disk_note": "assembled on agent VM; public assets shipped with deploy",
                "publishing": "READY_FOR_LIBRARY",
                "reels": report_rows,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    passed = [r for r in report_rows if r["qc"]["pass"]]
    write_catalog_ts(passed if len(passed) == 10 else report_rows)

    if qc_failures:
        return 1
    if len(report_rows) != 10:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
