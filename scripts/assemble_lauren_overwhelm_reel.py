#!/usr/bin/env python3
"""Assemble Lauren Overwhelm MASTER / CLEAN / VISUAL 1080x1920 H.264 reels."""

from __future__ import annotations

import json
import math
import struct
import subprocess
import wave
from pathlib import Path

ROOT = Path("/workspace")
BASE = ROOT / "public" / "assets" / "christmas" / "lauren-overwhelm"
MASTERS = BASE / "masters"
AUDIO = BASE / "audio"
FINAL = BASE / "final"
POSTERS = BASE / "posters"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

CLIPS = [
    ("lauren_01_intro.mp4", "s1"),
    ("lauren_02_phone.mp4", "s2"),
    ("lauren_03_receipt.mp4", "s3"),
    ("lauren_04_peak.mp4", "s4"),
    ("lauren_05_discovery.mp4", "s5"),
    ("lauren_06_payoff.mp4", "s6"),
]

CAPTION_CUES = [
    ("s1", ["This is Lauren.", "She loves Christmas…"], ["Lauren", "Christmas"]),
    ("s1b", ["but every year,", "she has the same problem."], ["problem"]),
    ("s2", ["Gifts. Dinner.", "Decorations."], ["Gifts"]),
    ("s2b", ["School events. Family plans…", "she’s supposed to remember all of it."], ["remember"]),
    ("s3", ["The closer Christmas gets,", "the longer the list becomes…"], ["list"]),
    ("s3b", ["and the more expensive", "everything feels."], ["expensive"]),
    ("s4", ["She’s planning Christmas", "for everyone else…"], ["everyone"]),
    ("s4b", ["but she’s running out of time", "to actually enjoy it herself."], ["enjoy"]),
    ("s5", ["Then Lauren finds", "a simpler way"], ["simpler"]),
    ("s5b", ["to keep Christmas together."], ["together"]),
    ("s6", ["Gifts, budget, meals and plans", "finally have a place…"], ["place"]),
    ("s6b", ["so Lauren can", "enjoy Christmas too."], ["enjoy"]),
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
            "stream=width,height,codec_name",
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
    return {
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "duration": float(fmt.get("duration") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
        "bitrate": int(fmt.get("bit_rate") or 0),
        "codec": stream.get("codec_name"),
    }


def probe_audio(path: Path) -> float:
    raw = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)]
    )
    return float((json.loads(raw).get("format") or {}).get("duration") or 0)


def write_wav(path: Path, samples: list[float], rate: int = 48000) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        frames = b"".join(struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples)
        wf.writeframes(frames)


def synth_music(seconds: float, path: Path, rate: int = 48000) -> None:
    # Original soft bell-pad. Not a commercial recording.
    n = int(seconds * rate)
    samples = [0.0] * n
    notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 293.66, 349.23]
    for i in range(n):
        t = i / rate
        # Scene envelopes: dip 15–20s, lift 20–25, warm 25-end
        if t < 15:
            env = 0.055
        elif t < 20:
            env = 0.022
        elif t < 25:
            env = 0.07
        else:
            env = 0.085
        bar = notes[int(t / 1.7) % len(notes)]
        fifth = bar * 1.5
        pad = math.sin(2 * math.pi * bar * 0.5 * t) * 0.35
        bell = math.sin(2 * math.pi * bar * t) * math.exp(-((t % 1.7) * 2.4)) * 0.55
        spark = math.sin(2 * math.pi * fifth * t) * math.exp(-((t % 1.7) * 3.2)) * 0.22
        samples[i] = env * (pad + bell + spark)
    write_wav(path, samples, rate)


def synth_ambience(seconds: float, path: Path, rate: int = 48000) -> None:
    n = int(seconds * rate)
    samples = [0.0] * n
    # Deterministic quiet room + distant muffled life. No copyrighted material.
    state = 1234567
    for i in range(n):
        t = i / rate
        state = (1103515245 * state + 12345) & 0x7FFFFFFF
        noise = ((state / 0x7FFFFFFF) * 2 - 1) * 0.018
        # soft fireplace crackle ticks
        if state % 18000 < 40:
            noise += 0.04 * ((state % 97) / 97)
        # distant high-frequency 'play' murmur between 5–15s and 20–28s
        kids = 0.0
        if 5 < t < 15 or 20 < t < 28:
            kids = 0.006 * math.sin(2 * math.pi * 9.5 * t) * math.sin(2 * math.pi * 2.1 * t)
        samples[i] = noise * 0.35 + kids
    write_wav(path, samples, rate)


def ass_time(seconds: float) -> str:
    t = max(0, seconds)
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    cs = int(round((t - int(t)) * 100))
    if cs == 100:
        s += 1
        cs = 0
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def build_ass(timeline: list[tuple[float, float, list[str], list[str]]], dest: Path) -> None:
    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1080",
        "PlayResY: 1920",
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: Default,DejaVu Sans,62,&H00FFFFFF,&H000000FF,&H66101010,&H00000000,0,0,0,0,100,100,0,0,1,4,0,2,70,70,210,1",
        "Style: Hit,DejaVu Sans,62,&H00C8E6FF,&H000000FF,&H66101010,&H00000000,1,0,0,0,100,100,0,0,1,4,0,2,70,70,210,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for start, end, texts, hits in timeline:
        styled = []
        for line in texts[:2]:
            words = []
            for w in line.split(" "):
                clean = w.strip(".,…")
                if clean in hits:
                    words.append(r"{\c&HC8E6FF&}" + w + r"{\c&HFFFFFF&}")
                else:
                    words.append(w)
            styled.append(" ".join(words))
        text = r"\N".join(styled)
        lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Default,,0,0,0,,{text}")
    dest.write_text("\n".join(lines) + "\n")


def run(cmd: list[str]) -> None:
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main() -> int:
    FINAL.mkdir(parents=True, exist_ok=True)
    AUDIO.mkdir(parents=True, exist_ok=True)
    for name, _ in CLIPS:
        p = MASTERS / name
        if not p.exists():
            raise SystemExit(f"missing master {p}")
        info = probe(p)
        if info["width"] != 1080 or info["height"] != 1920:
            raise SystemExit(f"{name} is {info['width']}x{info['height']}, expected 1080x1920")

    vo = AUDIO / "vo_lauren_overwhelm_full.wav"
    vo_dur = probe_audio(vo)

    # Normalize each clip, concat, freeze-tail if VO is longer.
    normalized = []
    for i, (name, _) in enumerate(CLIPS):
        src = MASTERS / name
        out = FINAL / f"_norm_{i}.mp4"
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(src),
                "-vf",
                "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=24",
                "-an",
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                str(out),
            ]
        )
        normalized.append(out)

    concat_list = FINAL / "_concat.txt"
    concat_list.write_text("".join(f"file '{p}'\n" for p in normalized))
    visual_raw = FINAL / "_visual_raw.mp4"
    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-c",
            "copy",
            str(visual_raw),
        ]
    )
    vis_info = probe(visual_raw)
    total = max(vis_info["duration"], vo_dur + 0.15)
    pad = max(0.0, total - vis_info["duration"])
    visual = FINAL / "lauren_overwhelm_visual.mp4"
    if pad > 0.05:
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(visual_raw),
                "-vf",
                f"tpad=stop_mode=clone:stop_duration={pad:.3f}",
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                "-an",
                "-movflags",
                "+faststart",
                str(visual),
            ]
        )
    else:
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(visual_raw),
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                "-an",
                "-movflags",
                "+faststart",
                str(visual),
            ]
        )

    vis_dur = probe(visual)["duration"]
    music_wav = AUDIO / "music_original_bed.wav"
    amb_wav = AUDIO / "ambience_room.wav"
    synth_music(vis_dur + 0.3, music_wav)
    synth_ambience(vis_dur + 0.3, amb_wav)

    mixed = AUDIO / "mix_vo_music_ambience.wav"
    # VO primary; music/ambience very under. Scene 4 music already dipped in synth.
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(vo),
            "-i",
            str(music_wav),
            "-i",
            str(amb_wav),
            "-filter_complex",
            "[0:a]aformat=sample_rates=48000:channel_layouts=mono,loudnorm=I=-16:TP=-1.5:LRA=11[vo];"
            "[1:a]aformat=sample_rates=48000:channel_layouts=mono,volume=0.22[mu];"
            "[2:a]aformat=sample_rates=48000:channel_layouts=mono,volume=0.35[am];"
            "[vo][mu][am]amix=inputs=3:duration=longest:dropout_transition=2,alimiter=limit=0.95[a]",
            "-map",
            "[a]",
            str(mixed),
        ]
    )

    # Caption timeline from per-cue wavs
    cue_files = [
        ("s1", AUDIO / "vo_s1.wav"),
        ("s2", AUDIO / "vo_s2.wav"),
        ("s3", AUDIO / "vo_s3.wav"),
        ("s4", AUDIO / "vo_s4.wav"),
        ("s5", AUDIO / "vo_s5.wav"),
        ("s6", AUDIO / "vo_s6.wav"),
    ]
    gaps = {"s1": 0.16, "s2": 0.14, "s3": 0.14, "s4": 0.42, "s5": 0.16, "s6": 0.12}
    t = 0.0
    dur_map = {}
    for cid, path in cue_files:
        d = probe_audio(path)
        dur_map[cid] = (t, t + d)
        t += d + gaps[cid]

    # Split each scene VO into two caption beats
    timeline = []
    pairs = [
        ("s1", "s1", "s1b"),
        ("s2", "s2", "s2b"),
        ("s3", "s3", "s3b"),
        ("s4", "s4", "s4b"),
        ("s5", "s5", "s5b"),
        ("s6", "s6", "s6b"),
    ]
    lookup = {row[0]: row for row in CAPTION_CUES}
    for cid, a, b in pairs:
        start, end = dur_map[cid]
        if b is None:
            timeline.append((start, end, lookup[a][1], lookup[a][2]))
        else:
            mid = start + (end - start) * 0.48
            timeline.append((start, mid, lookup[a][1], lookup[a][2]))
            timeline.append((mid, end, lookup[b][1], lookup[b][2]))

    ass_path = FINAL / "captions.ass"
    cta_start = max(0.0, vis_dur - 2.05)
    timeline = [(s, min(e, cta_start - 0.08), txt, hits) for s, e, txt, hits in timeline if s < cta_start - 0.2]
    build_ass(timeline, ass_path)

    cta_start = max(0.0, vis_dur - 2.05)
    drawtext = (
        f"drawtext=fontfile={FONT}:text='THE DIGITAL GIFTER':fontsize=44:fontcolor=white:"
        f"x=(w-text_w)/2:y=h*0.72:enable='gte(t,{cta_start:.3f})':shadowcolor=black@0.6:shadowx=0:shadowy=2,"
        f"drawtext=fontfile={FONT_REG}:text='Your Christmas. Finally organized.':fontsize=30:fontcolor=white@0.94:"
        f"x=(w-text_w)/2:y=h*0.77:enable='gte(t,{cta_start:.3f})':shadowcolor=black@0.55:shadowx=0:shadowy=1,"
        f"drawtext=fontfile={FONT}:text='Open My Christmas Planner':fontsize=32:fontcolor=#F4E4C1:"
        f"x=(w-text_w)/2:y=h*0.82:enable='gte(t,{cta_start:.3f})':shadowcolor=black@0.6:shadowx=0:shadowy=2"
    )
    scene5_text = (
        f"drawtext=fontfile={FONT_REG}:text='One place. Everything Christmas.':fontsize=28:fontcolor=white@0.92:"
        f"x=(w-text_w)/2:y=h*0.70:enable='between(t,20.6,24.4)':shadowcolor=black@0.5:shadowx=0:shadowy=1"
    )

    def encode(src_vis: Path, audio: Path | None, dest: Path, captions: bool, overlays: bool) -> None:
        vf = [scene5_text, drawtext] if overlays else []
        if captions:
            vf.append(f"ass={ass_path}")
        vf_arg = ",".join(vf) if vf else "null"
        cmd = ["ffmpeg", "-y", "-i", str(src_vis)]
        if audio is not None:
            cmd += ["-i", str(audio)]
        cmd += ["-vf", vf_arg]
        if audio is not None:
            cmd += ["-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "192k", "-shortest"]
        else:
            cmd += ["-an"]
        cmd += [
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(dest),
        ]
        run(cmd)

    master = FINAL / "lauren_overwhelm_master.mp4"
    clean = FINAL / "lauren_overwhelm_clean.mp4"
    encode(visual, mixed, master, captions=True, overlays=True)
    encode(visual, mixed, clean, captions=False, overlays=True)

    for src, t in ((master, 1.0), (clean, 1.0), (visual, 1.0)):
        poster = POSTERS / f"{src.stem}.jpg"
        run(["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(poster)])

    report = {
        "master": {"file": str(master.relative_to(ROOT)), **probe(master)},
        "clean": {"file": str(clean.relative_to(ROOT)), **probe(clean)},
        "visual": {"file": str(visual.relative_to(ROOT)), **probe(visual)},
        "vo_duration": vo_dur,
    }
    (FINAL / "assemble_report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    for tmp in list(FINAL.glob("_norm_*.mp4")) + [concat_list, visual_raw]:
        tmp.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
