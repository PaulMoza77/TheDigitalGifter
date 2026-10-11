#!/usr/bin/env python3
"""Assemble 10 Christmas Reels (mix of ~10s / ~20s / ~30s) from existing Library shorts.

No new AI generation. ffmpeg trim/concat/xfade + CC0 Christmas music.
Outputs public/assets/christmas/library-montage-oct11/ and catalog TS.
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
OUT = PUBLIC / "assets/christmas/library-montage-oct11"
FINALS = OUT / "final"
POSTERS = OUT / "posters"
SILENT = OUT / "silent"
MANIFEST = OUT / "montage_manifest.json"
CATALOG_TS = ROOT / "src/features/admin-library/libraryMontageOct11Catalog.ts"

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
    for lid, start, dur, zoom, mode in shots:
        src = shorts[lid]
        if not src.exists():
            raise FileNotFoundError(f"{lid} -> {src}")
        info = probe(src)
        max_dur = max(0.35, info["duration"] - start - 0.05)
        used = min(dur, max_dur)
        if used < 0.35:
            raise RuntimeError(f"{lid} too short after clamp ({info['duration']}s start={start})")
        out.append((src, start, used, zoom, lid, mode))
    return out


def export_silent_reel(dest: Path, clamped: list[tuple], xfade_default: float = 0.12) -> float:
    dest.parent.mkdir(parents=True, exist_ok=True)
    inputs: list[str] = []
    filters: list[str] = []
    durs: list[float] = []
    modes: list[str] = []
    for i, (src, start, dur, zoom, _lid, mode) in enumerate(clamped):
        inputs.extend(["-i", str(src)])
        filters.append(shot_filter(i, start, dur, zoom))
        durs.append(dur)
        modes.append(mode)

    n = len(clamped)
    if n == 1:
        filters.append("[v0]format=yuv420p[out]")
    else:
        current = "v0"
        acc = durs[0]
        for i in range(1, n):
            nxt = f"v{i}"
            out_label = "base" if i == n - 1 else f"c{i}"
            if modes[i] == "fade":
                fade_dur = min(0.28, xfade_default + 0.06)
                fade_at = max(0.04, acc - fade_dur)
                filters.append(
                    f"[{current}][{nxt}]xfade=transition=fade:duration={fade_dur:.3f}:offset={fade_at:.3f}[{out_label}]"
                )
                acc = acc + durs[i] - fade_dur
            else:
                tmp = f"t{i}"
                filters.append(f"[{current}][{nxt}]concat=n=2:v=1:a=0[{tmp}]")
                filters.append(f"[{tmp}]settb=1/30,fps=30[{out_label}]")
                acc = acc + durs[i]
            current = out_label
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
    fade_in, fade_out = 0.8, 1.8
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


# shots: (library_id, start, duration, zoom, transition cut|fade)
# target_band: "10" | "20" | "30" for QC windows
REELS = [
    {
        "id": "reel-lib-montage-11-europe-postcard",
        "filename": "reel-lib-montage-11-europe-postcard.mp4",
        "title": "Europe Postcard · 10s",
        "concept": "Fast 1990s Europe nostalgia — London → Paris → market → eve window",
        "mood": "nostalgic",
        "target_band": "10",
        "shots": [
            ("short-cme1990s-01-london", 0.04, 2.20, 1.03, "cut"),
            ("short-cme1990s-02-paris-cafe", 0.06, 2.00, 1.03, "cut"),
            ("short-cme1990s-06-christmas-market", 0.08, 2.20, 1.02, "cut"),
            ("short-cme1990s-10-eve-window", 0.10, 3.80, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-12-palace-flash",
        "filename": "reel-lib-montage-12-palace-flash.mp4",
        "title": "Palace Flash · 11s",
        "concept": "Luxury palace energy — establish → gates → hero hold",
        "mood": "cinematic",
        "target_band": "10",
        "shots": [
            ("short-palace-01-establish", 0.04, 2.40, 1.03, "cut"),
            ("short-palace-02-approach", 0.06, 1.80, 1.03, "cut"),
            ("short-palace-03-gates", 0.08, 2.00, 1.02, "cut"),
            ("short-palace-05-hero", 0.10, 4.80, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-13-train-spark",
        "filename": "reel-lib-montage-13-train-spark.mp4",
        "title": "Train Spark · 12s",
        "concept": "Compact Christmas Express punch — gifts hook, viaduct, station",
        "mood": "upbeat",
        "target_band": "10",
        "shots": [
            ("short-cx-05-santa-gifts", 0.04, 1.80, 1.04, "cut"),
            ("short-cx-02-sunset-viaduct", 0.06, 2.20, 1.03, "cut"),
            ("short-cx-04-aurora-viaduct", 0.08, 2.40, 1.03, "cut"),
            ("short-cx-03-station", 0.10, 5.40, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-14-nyc-1990-glow",
        "filename": "reel-lib-montage-14-nyc-1990-glow.mp4",
        "title": "NYC 1990 Glow · 20s",
        "concept": "Nostalgic Manhattan winter — dusk cab through Rockefeller to shopping glow",
        "mood": "cinematic",
        "target_band": "20",
        "shots": [
            ("short-nyc-winter-1990-01-manhattan-dusk", 0.04, 4.20, 1.02, "fade"),
            ("short-nyc-winter-1990-02-rockefeller-tree", 0.06, 3.60, 1.02, "cut"),
            ("short-nyc-winter-1990-03-townhouse", 0.08, 3.20, 1.02, "cut"),
            ("short-nyc-winter-1990-04-central-park-carriage", 0.08, 3.40, 1.02, "cut"),
            ("short-nyc-winter-1990-05-holiday-shopping", 0.10, 5.80, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-15-swiss-afterglow",
        "filename": "reel-lib-montage-15-swiss-afterglow.mp4",
        "title": "Swiss Afterglow · 19s",
        "concept": "Alpine luxury calm — sunrise, fireplace, ski entry, breakfast payoff",
        "mood": "warm",
        "target_band": "20",
        "shots": [
            ("short-swiss-alpine-01-sunrise-chalet", 0.04, 4.00, 1.02, "fade"),
            ("short-swiss-alpine-02-fireplace", 0.06, 3.80, 1.01, "cut"),
            ("short-swiss-alpine-03-christmas-tree", 0.08, 3.20, 1.02, "cut"),
            ("short-swiss-alpine-04-ski-entry", 0.08, 3.00, 1.02, "cut"),
            ("short-swiss-alpine-05-breakfast", 0.10, 5.20, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-16-family-hearth",
        "filename": "reel-lib-montage-16-family-hearth.mp4",
        "title": "Family Hearth · 21s",
        "concept": "Warm finished-batch cozy — library dog, stairs, dinner, alpine cabin",
        "mood": "emotional",
        "target_band": "20",
        "shots": [
            ("short-c20-16-library-dog-finished", 0.20, 4.40, 1.01, "fade"),
            ("short-c20-14-stairs-morning-finished", 0.15, 3.20, 1.02, "cut"),
            ("short-c20-13-home-alone-tv-finished", 0.12, 2.80, 1.02, "cut"),
            ("short-c20-15-family-dinner-finished", 0.18, 4.60, 1.02, "cut"),
            ("short-c20-12-alpine-cabin-finished", 0.22, 6.20, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-17-north-pole-arc",
        "filename": "reel-lib-montage-17-north-pole-arc.mp4",
        "title": "North Pole Arc · 22s",
        "concept": "Journey beat — train window to workshop street to village arrival",
        "mood": "magical",
        "target_band": "20",
        "shots": [
            ("short-npj-01-train-window", 0.08, 3.60, 1.03, "cut"),
            ("short-npj-03-aurora-window", 0.06, 3.80, 1.02, "cut"),
            ("short-npj-02-station", 0.10, 3.00, 1.02, "cut"),
            ("short-npj-06-workshop-street", 0.10, 3.20, 1.03, "cut"),
            ("short-npj-08-wrapping", 0.12, 2.80, 1.02, "cut"),
            ("short-npj-05-village-arrival", 0.14, 5.80, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-18-memories-europe-30",
        "filename": "reel-lib-montage-18-memories-europe-30.mp4",
        "title": "Memories of Europe · 30s",
        "concept": "Full 1990s Europe tour — ten cities/moments woven into one silent-to-music reel",
        "mood": "nostalgic",
        "target_band": "30",
        "shots": [
            ("short-cme1990s-01-london", 0.04, 2.80, 1.02, "cut"),
            ("short-cme1990s-02-paris-cafe", 0.06, 2.60, 1.02, "cut"),
            ("short-cme1990s-03-alpine-chalet", 0.06, 2.80, 1.02, "cut"),
            ("short-cme1990s-04-christmas-morning", 0.08, 2.80, 1.02, "cut"),
            ("short-cme1990s-05-christmas-train", 0.08, 3.00, 1.03, "cut"),
            ("short-cme1990s-06-christmas-market", 0.08, 2.80, 1.02, "cut"),
            ("short-cme1990s-07-nyc-apartment", 0.08, 2.60, 1.02, "cut"),
            ("short-cme1990s-08-toy-shop", 0.08, 2.80, 1.03, "cut"),
            ("short-cme1990s-09-road-trip", 0.10, 3.00, 1.02, "cut"),
            ("short-cme1990s-10-eve-window", 0.12, 5.00, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-19-manhattan-night-30",
        "filename": "reel-lib-montage-19-manhattan-night-30.mp4",
        "title": "Manhattan Night · 30s",
        "concept": "Premium NYC finished batch — Saks, Radio City, mansion, penthouse, brownstone",
        "mood": "cinematic",
        "target_band": "30",
        "shots": [
            ("short-c20-17-saks-rockefeller-finished", 0.08, 3.80, 1.03, "cut"),
            ("short-c20-08-radio-city-finished", 0.10, 3.40, 1.03, "cut"),
            ("short-c20-01-ny-awning-finished", 0.12, 3.00, 1.02, "cut"),
            ("short-c20-05-mansion-gwagon-finished", 0.14, 4.20, 1.02, "cut"),
            ("short-c20-10-penthouse-empire-finished", 0.12, 3.80, 1.02, "cut"),
            ("short-c20-11-mansion-gate-finished", 0.14, 3.40, 1.02, "cut"),
            ("short-c20-19-brownstone-vintage-finished", 0.16, 3.60, 1.02, "cut"),
            ("short-c20-10-penthouse-empire-finished", 2.20, 5.00, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-20-santa-workshop-30",
        "filename": "reel-lib-montage-20-santa-workshop-30.mp4",
        "title": "Santa Workshop Night · 30s",
        "concept": "Magical Santa arc — sleigh, workshop, London, wrapping, moon bedroom payoff",
        "mood": "magical",
        "target_band": "30",
        "shots": [
            ("short-santa-02-sleigh", 0.04, 3.60, 1.04, "cut"),
            ("short-cinematic-santa-london", 0.05, 3.40, 1.03, "cut"),
            ("short-santa-01-workshop", 0.08, 3.20, 1.03, "cut"),
            ("short-cinematic-workshop", 0.08, 3.00, 1.03, "cut"),
            ("short-npj-07-workshop-list", 0.10, 2.80, 1.03, "cut"),
            ("short-npj-09-window-sleigh", 0.10, 3.00, 1.03, "cut"),
            ("short-santa-03-desk", 0.10, 3.00, 1.02, "cut"),
            ("short-c20-20-bedroom-santa-moon-finished", 0.20, 5.80, 1.02, "fade"),
        ],
    },
]


def qc_window(band: str) -> tuple[float, float]:
    if band == "10":
        return 9.0, 13.5
    if band == "20":
        return 17.5, 23.5
    if band == "30":
        return 27.0, 32.5
    return 9.0, 32.5


def qc_reel(path: Path, planned_duration: float, clip_ids: list[str], band: str) -> dict:
    info = probe(path)
    issues: list[str] = []
    lo, hi = qc_window(band)
    if info["width"] != 1080 or info["height"] != 1920:
        issues.append(f"resolution {info['width']}x{info['height']}")
    if info["duration"] < lo or info["duration"] > hi:
        issues.append(f"duration {info['duration']:.2f}s outside {band}s window ({lo}-{hi})")
    if info["codec"] != "h264":
        issues.append(f"codec {info['codec']}")
    if not has_audio(path):
        issues.append("missing audio")
    blacks = blackdetect(path)
    if len(blacks) > 3:
        issues.append(f"blackdetect hits={len(blacks)}")
    if len(set(clip_ids)) < 3:
        issues.append("fewer than 3 distinct source clips")
    return {
        "pass": len(issues) == 0,
        "issues": issues,
        "probe": info,
        "planned_duration": planned_duration,
        "blackdetect": blacks,
        "target_band": band,
    }


def write_catalog_ts(rows: list[dict]) -> None:
    created = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = [
        "/** Library montage reels assembled 2026-10-11 from existing short clips only (no new AI video). */",
        'import type { LibraryVideo } from "./catalog";',
        "",
        'const TAGS = ["christmas", "library-montage-oct11", "has-music", "ready-to-post", "existing-clips-only"] as const;',
        "",
        "export const LIBRARY_MONTAGE_OCT11_REELS: LibraryVideo[] = [",
    ]
    for row in rows:
        clips = row["clips_used"]
        music_file = row["music"]
        lines.append("  {")
        lines.append(f'    id: "{row["id"]}",')
        lines.append(f'    title: "{row["title"]}",')
        lines.append(
            f'    description: "{row["concept"]} · {row["probe"]["duration"]:.1f}s 1080×1920 H.264 + AAC. '
            f'Music: {music_file}. Assembled from existing Library shorts — $0 generation.",'
        )
        lines.append(f'    src: "/assets/christmas/library-montage-oct11/final/{row["filename"]}",')
        lines.append(f'    filename: "{row["filename"]}",')
        lines.append('    category: "christmas_reels",')
        lines.append('    kind: "reel",')
        lines.append(f'    durationSeconds: {row["probe"]["duration"]:.2f},')
        lines.append(f'    poster: "/assets/christmas/library-montage-oct11/posters/{row["id"]}.jpg",')
        lines.append("    width: 1080,")
        lines.append("    height: 1920,")
        lines.append(f'    fileSizeBytes: {row["probe"]["size"]},')
        lines.append(f'    createdAt: "{created}",')
        lines.append(f"    tags: [...TAGS, \"{row['mood']}\", \"{row['target_band']}s\"],")
        lines.append("    costUsd: 0,")
        lines.append(f'    clipsUsed: {json.dumps(clips)},')
        lines.append('    productionId: "library-montage-oct11",')
        lines.append("  },")
    lines.append("];")
    lines.append("")
    CATALOG_TS.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    shorts = load_short_paths()
    missing = sorted({s[0] for r in REELS for s in r["shots"]} - set(shorts))
    if missing:
        print("Missing library ids:", missing, file=sys.stderr)
        return 2
    missing_files = [lid for lid in {s[0] for r in REELS for s in r["shots"]} if not shorts[lid].exists()]
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
        poster(final_path, POSTERS / f"{reel['id']}.jpg", t=min(1.2, silent_info["duration"] * 0.12))

        clip_ids = [s[4] for s in clamped]
        qc = qc_reel(final_path, planned, clip_ids, reel["target_band"])
        if not qc["pass"]:
            qc_failures += 1
            print("QC FAIL", reel["id"], qc["issues"], flush=True)
        else:
            print(
                f"QC PASS {reel['id']} {qc['probe']['duration']:.2f}s band={reel['target_band']} music={track}",
                flush=True,
            )

        report_rows.append(
            {
                **reel,
                "music": track,
                "clips_used": clip_ids,
                "shots_resolved": [
                    {"library_id": s[4], "start": s[1], "duration": s[2], "transition": s[5]} for s in clamped
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
                "reels_requested": 10,
                "reels_produced": len(report_rows),
                "qc_failures": qc_failures,
                "duration_mix": {"10s": 3, "20s": 4, "30s": 3},
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
