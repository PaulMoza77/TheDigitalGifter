#!/usr/bin/env python3
"""Generate 5 Kling 3.0 Pro I2V masters (1080p, 5s, silent) and 3 Reels."""

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

ROOT = Path("/workspace")
SOURCE = ROOT / "source" / "batch-sep18"
MASTERS = ROOT / "public" / "assets" / "christmas" / "reels" / "masters"
FINALS = ROOT / "public" / "assets" / "christmas" / "reels" / "final"
POSTERS = ROOT / "public" / "assets" / "christmas" / "reels" / "posters"
LOG = ROOT / "public" / "assets" / "christmas" / "reels" / "generation_manifest.json"
GENLOG = ROOT / "generated" / "batch-sep18" / "generation_log.json"

TOKEN = os.environ.get("REPLICATE_API_TOKEN") or ""
MODEL = "kwaivgi/kling-v3-video"
DURATION = 5
MODE = "pro"
# Previous TDG Kling 3.0 Pro 1080p silent tariff (GENERATION_LOG.md).
USD_PER_SECOND = 0.112
PREVIOUS_TOTAL = 2.80

NEG = (
    "slideshow, Ken Burns, camera-only motion, fake parallax, morphing faces, identity change, "
    "warped hands, extra fingers, disappearing limbs, duplicated people, melting objects, "
    "bending cars, bending buildings, changing clothing, changing background, sudden object appearance, "
    "excessive motion blur, AI shimmer, texture crawling, temporal flickering, surreal movement, "
    "random camera shake, cartoon motion, fake snow overlay covering the image, extra people, "
    "warped architecture, melting ice, identity drift, watermark, muddy image, plastic textures, "
    "jerky camera, fast zoom, aggressive orbit, dramatic drone, rapid pan"
)

CLIPS = [
    {
        "id": "christmas_master_01",
        "filename": "christmas_master_01.mp4",
        "image": SOURCE / "alpine_chalet_hot_tub_1080x1920.png",
        "source_still": "alpine_chalet_hot_tub.jpg",
        "title": "Alpine chalet hot tub",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas dusk. This exact luxury Alpine chalet photograph comes alive "
            "for five seconds. Preserve the house, glass gable, stone chimney, interior Christmas tree, "
            "fireplace, dining table, outdoor fire pit seating, wooden hot tub, lanterns, candles, "
            "snow-covered stones, pine trees, and mountain range exactly as in the first frame. "
            "Hot-tub water ripples gently with steam rising naturally. Candle flames and lanterns flicker "
            "extremely subtly. Fairy lights on the eaves twinkle very softly. Distant fireplace flames breathe. "
            "A few pine needles shift in a cold breeze. Natural sparse snowfall, not a fake overlay. "
            "Very slow cinematic push-in toward the chalet with tiny lens breathing. Architecture stays rigid. "
            "No new people. No morphing. Archival-cinematic luxury Christmas footage."
        ),
    },
    {
        "id": "christmas_master_02",
        "filename": "christmas_master_02.mp4",
        "image": SOURCE / "nyc_ice_skater_1080x1920.png",
        "source_still": "nyc_ice_skater.jpg",
        "title": "NYC ice skater",
        "prompt": (
            "Photoreal cinematic 9:16 New York Christmas night. This exact photograph of the young woman "
            "ice skating comes alive for five seconds. Preserve her face, long brown hair, cream knit sweater, "
            "red scarf, white ruffled skirt, black tights, cream gloves, white ice skates, brownstone wreaths, "
            "streetlamps, and Empire State Building exactly as in the first frame. "
            "She continues one natural skating stride forward on the ice with realistic weight shift, "
            "arm balance, and a small natural blink. Hair and scarf drift slightly in cold air. "
            "Ice reflections slide. Distant lights twinkle. Soft natural snowfall. "
            "Very subtle tracking / slow push-in matching her glide. Skyline and buildings stay structurally stable. "
            "No extra people, no face morph, no warped skates. Genuine cinematic Christmas footage."
        ),
    },
    {
        "id": "christmas_master_03",
        "filename": "christmas_master_03.mp4",
        "image": SOURCE / "village_kids_sledding_1080x1920.png",
        "source_still": "village_kids_sledding.jpg",
        "title": "Village kids sledding",
        "prompt": (
            "Photoreal cinematic 9:16 Alpine Christmas village at sunset. This exact photograph comes alive "
            "for five seconds. Preserve the three children, wooden sleds, golden retriever, stone houses, "
            "garlands, lake, church steeple, bridge, and mountains exactly as in the first frame. "
            "The girl in the green coat and red hat slides a little farther down the lane with realistic sled "
            "physics and joyful body motion. The boy in the blue coat follows on his sled. The child behind "
            "continues naturally. The golden retriever trots beside them with realistic gait. "
            "Chimney smoke rises. Warm window lights twinkle. Natural snowfall. Footsteps and sleds lightly "
            "disturb the snow. Very slow cinematic push-in. Houses and mountains stay rigid. "
            "Preserve all faces and clothing. No extra children. No warped sleds."
        ),
    },
    {
        "id": "christmas_master_04",
        "filename": "christmas_master_04.mp4",
        "image": SOURCE / "prague_cafe_cookies_1080x1920.png",
        "source_still": "prague_cafe_cookies.jpg",
        "title": "Prague cafe cookies",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas bakery cafe. This exact photograph comes alive for five seconds. "
            "Preserve the gingerbread cookies, linzer cookies, cinnamon roll, bundt cake, muffins, floral cocoa "
            "mug with whipped cream, lantern candle, plaid scarf on the chair, pastry case, window, and the "
            "snowy Prague Charles Bridge / Old Town towers outside exactly as in the first frame. "
            "Candle flame flickers extremely subtly. Faint steam rises from the cocoa. Warm fairy lights twinkle. "
            "Tiny snow drift visible through the window. Distant pedestrians outside take a few slow steps only "
            "if they stay sharp. Very slow cinematic push-in toward the cookie plate. Food, mug, and architecture "
            "remain structurally stable. No melting pastry, no morphing cookies, no new objects."
        ),
    },
    {
        "id": "christmas_master_05",
        "filename": "christmas_master_05.mp4",
        "image": SOURCE / "vintage_snowman_1080x1920.png",
        "source_still": "vintage_snowman.jpg",
        "title": "Vintage snowman",
        "prompt": (
            "Photoreal vintage Christmas home-movie 9:16. This exact photograph of three children building a "
            "snowman comes alive for five seconds. Preserve the boy in the red coat, the girl in the green coat, "
            "the kneeling child in the navy coat, the snowman with top hat and red plaid scarf, the vintage sled, "
            "the cream house with wreath and garland, the parked vintage cars, and the neighboring houses "
            "exactly as in the first frame. "
            "The standing boy makes a small natural adjustment to the snowman's face. The girl smiles and "
            "steadies the scarf with realistic hand motion. The kneeling child packs a little snow at the base. "
            "Natural blinking. Clothing shifts slightly. Soft snowfall. Porch lights glow steadily. "
            "Very subtle cinematic push-in with tiny handheld breathing, like a high-quality scan of archival film. "
            "Cars and house stay completely structurally stable. Preserve all faces and period clothing. "
            "No extra people, no morphing snowman, no bending vehicles."
        ),
    },
]


def api(method: str, url: str, data: dict | None = None, timeout: int = 120) -> dict:
    body = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "tdg-christmas-batch-sep18/1.0",
        },
    )
    for _ in range(8):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            if e.code == 429:
                retry_after = 12
                try:
                    retry_after = int(json.loads(err).get("retry_after") or 12) + 2
                except Exception:
                    pass
                print(f"  429 throttled, waiting {retry_after}s...", flush=True)
                time.sleep(retry_after)
                continue
            raise RuntimeError(f"{method} {url} -> {e.code} {err[:800]}") from e
    raise RuntimeError(f"{method} {url} still throttled after retries")


def upload_file(path: Path) -> str:
    boundary = "----TdgBatchSep18"
    data = path.read_bytes()
    parts = [
        (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"content\"; "
            f"filename=\"{path.name}\"\r\nContent-Type: image/png\r\n\r\n"
        ).encode(),
        data,
        f"\r\n--{boundary}--\r\n".encode(),
    ]
    req = urllib.request.Request(
        "https://api.replicate.com/v1/files",
        data=b"".join(parts),
        method="POST",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        payload = json.loads(resp.read().decode())
    url = (payload.get("urls") or {}).get("get")
    if not url:
        raise RuntimeError(f"file upload missing url: {payload}")
    return url


def output_url(output) -> str | None:
    if isinstance(output, str) and output.startswith("http"):
        return output
    if isinstance(output, list):
        for item in output:
            if isinstance(item, str) and item.startswith("http"):
                return item
            if isinstance(item, dict) and isinstance(item.get("url"), str):
                return item["url"]
    if isinstance(output, dict) and isinstance(output.get("url"), str):
        return output["url"]
    return None


def create_prediction(image_url: str, prompt: str) -> dict:
    return api(
        "POST",
        f"https://api.replicate.com/v1/models/{MODEL}/predictions",
        {
            "input": {
                "prompt": prompt,
                "start_image": image_url,
                "mode": MODE,
                "duration": DURATION,
                "generate_audio": False,
                "negative_prompt": NEG,
            }
        },
    )


def poll(pred_id: str, timeout_s: int = 1200) -> dict:
    start = time.time()
    while time.time() - start < timeout_s:
        current = api("GET", f"https://api.replicate.com/v1/predictions/{pred_id}")
        status = str(current.get("status"))
        print(f"  {pred_id} {status}", flush=True)
        if status in {"succeeded", "failed", "canceled"}:
            return current
        time.sleep(8)
    raise TimeoutError(f"prediction {pred_id} timed out")


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-christmas-batch-sep18/1.0"})
    with urllib.request.urlopen(req, timeout=180) as resp, dest.open("wb") as f:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            f.write(chunk)


def ffprobe(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,avg_frame_rate,codec_name,duration,bit_rate",
            "-show_entries",
            "format=duration,bit_rate,size",
            "-of",
            "json",
            str(path),
        ]
    )
    return json.loads(raw)


def probe_summary(path: Path) -> dict:
    data = ffprobe(path)
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
        "path": str(path),
        "duration": float(fmt.get("duration") or stream.get("duration") or 0),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "codec": stream.get("codec_name"),
        "fps": round(fps, 3),
        "bitrate": int(fmt.get("bit_rate") or stream.get("bit_rate") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
    }


def validate_master(info: dict) -> None:
    if info["width"] != 1080 or info["height"] != 1920:
        raise RuntimeError(f"{info['filename']} not 1080x1920: {info['width']}x{info['height']}")
    if info["duration"] < 4.5 or info["duration"] > 6.5:
        raise RuntimeError(f"{info['filename']} duration {info['duration']}")
    if info["size"] < 200_000:
        raise RuntimeError(f"{info['filename']} looks empty/corrupt ({info['size']} bytes)")
    if info["codec"] not in {"h264", "hevc", "vp9", "av1"}:
        raise RuntimeError(f"{info['filename']} unexpected codec {info['codec']}")


def print_estimate() -> float:
    per = USD_PER_SECOND * DURATION
    total = per * len(CLIPS)
    print("=" * 72)
    print("HIGGSFIELD STATUS: NOT CONFIGURED in this environment")
    print("  No HF_API_KEY / HIGGSFIELD secrets present.")
    print("  Configured video API: Replicate REPLICATE_API_TOKEN")
    print("MODEL: kwaivgi/kling-v3-video")
    print("MODE: pro (1080p)  — not standard/720p, not a cheaper/faster model")
    print("DURATION: 5s each  AUDIO: generate_audio=false")
    print("ASPECT: 9:16 from 1080x1920 start frames")
    print(f"PREVIOUS TDG KLING 3.0 PRO TARIFF: ${USD_PER_SECOND:.3f}/s silent 1080p")
    print(f"ESTIMATED COST PER CLIP: ${per:.2f}")
    print(f"MASTER CLIPS REQUESTED: {len(CLIPS)}")
    print(f"TOTAL ESTIMATED COST FOR ALL 5 GENERATIONS: ${total:.2f}")
    print(f"PREVIOUS BATCH TOTAL: ${PREVIOUS_TOTAL:.2f}")
    delta = abs(total - PREVIOUS_TOTAL)
    print(f"DELTA VS PREVIOUS: ${delta:.2f}")
    if total > PREVIOUS_TOTAL * 1.5:
        print("STOP: major unexpected price increase")
        raise SystemExit(2)
    print("PRICE CHECK: consistent with previous Kling 3.0 Pro pricing — proceeding")
    print("=" * 72, flush=True)
    return total


def export_reel(dest: Path, specs: list[tuple[Path, float, float]]) -> dict:
    """specs: (src, start, duration) using hard cuts, 1080x1920, 30fps, high bitrate."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    inputs: list[str] = []
    filters: list[str] = []
    for i, (src, start, dur) in enumerate(specs):
        inputs.extend(["-i", str(src)])
        filters.append(
            f"[{i}:v]trim=start={start}:duration={dur},setpts=PTS-STARTPTS,"
            "fps=30,scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p[v{i}]".format(i=i)
        )
    n = len(specs)
    concat_in = "".join(f"[v{i}]" for i in range(n))
    filters.append(f"{concat_in}concat=n={n}:v=1:a=0[out]")
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
    info = probe_summary(dest)
    if info["width"] != 1080 or info["height"] != 1920:
        raise RuntimeError(f"{dest.name} not 1080x1920")
    if info["duration"] < 11.5 or info["duration"] > 16.5:
        raise RuntimeError(f"{dest.name} duration {info['duration']} outside 12–15s target window")
    return info


def poster(src: Path, dest: Path, t: float = 0.4) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-ss",
            str(t),
            "-i",
            str(src),
            "-frames:v",
            "1",
            "-q:v",
            "3",
            str(dest),
        ]
    )


def main() -> int:
    if not TOKEN:
        print("REPLICATE_API_TOKEN missing", file=sys.stderr)
        return 1
    estimated_total = print_estimate()
    MASTERS.mkdir(parents=True, exist_ok=True)
    FINALS.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)
    GENLOG.parent.mkdir(parents=True, exist_ok=True)

    uploads = {}
    for clip in CLIPS:
        if not clip["image"].exists():
            raise SystemExit(f"missing still {clip['image']}")
        print(f"Uploading {clip['image'].name}...", flush=True)
        uploads[clip["id"]] = upload_file(clip["image"])

    jobs = []
    for clip in CLIPS:
        print(f"Creating {clip['id']}...", flush=True)
        pred = create_prediction(uploads[clip["id"]], clip["prompt"])
        print(f"  id={pred.get('id')} status={pred.get('status')}", flush=True)
        jobs.append({"clip": clip, "pred": pred})
        time.sleep(8)

    log = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "provider": "replicate",
        "higgsfield_configured": False,
        "model": MODEL,
        "mode": MODE,
        "duration": DURATION,
        "generate_audio": False,
        "estimated_total_usd": estimated_total,
        "usd_per_second": USD_PER_SECOND,
        "clips": [],
        "reels": [],
    }

    actual_total = 0.0
    for item in jobs:
        clip = item["clip"]
        pred_id = str(item["pred"].get("id"))
        print(f"Polling {clip['id']} {pred_id}...", flush=True)
        done = poll(pred_id)
        if str(done.get("status")) != "succeeded":
            raise RuntimeError(f"{clip['id']} failed: {done.get('error')}")
        url = output_url(done.get("output"))
        if not url:
            raise RuntimeError(f"{clip['id']} missing output: {done.get('output')}")
        dest = MASTERS / clip["filename"]
        print(f"Downloading {url} -> {dest}", flush=True)
        download(url, dest)
        info = probe_summary(dest)
        validate_master(info)
        print(
            f"FFPROBE {info['filename']} {info['width']}x{info['height']} "
            f"{info['duration']:.3f}s {info['codec']} {info['fps']}fps",
            flush=True,
        )
        metrics = done.get("metrics") or {}
        cost = USD_PER_SECOND * float(metrics.get("video_output_duration_seconds") or DURATION)
        actual_total += cost
        poster(dest, POSTERS / f"{clip['id']}.jpg")
        entry = {
            "id": clip["id"],
            "title": clip["title"],
            "source_image": clip["source_still"],
            "prediction_id": done.get("id"),
            "model": MODEL,
            "mode": MODE,
            "prompt": clip["prompt"],
            "generation_cost_usd": cost,
            "output_url": url,
            "file": f"/assets/christmas/reels/masters/{clip['filename']}",
            "probe": info,
            "metrics": metrics,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        log["clips"].append(entry)
        GENLOG.write_text(json.dumps(log, indent=2))
        LOG.write_text(json.dumps(log, indent=2))

    m = {c["id"]: MASTERS / c["filename"] for c in CLIPS}
    # Cinematic / emotional: dusk luxury → family village joy → bakery warmth → ice romance → home memory
    cinematic = export_reel(
        FINALS / "christmas_reel_cinematic_01.mp4",
        [
            (m["christmas_master_01"], 0.20, 3.00),
            (m["christmas_master_03"], 0.15, 3.00),
            (m["christmas_master_05"], 0.20, 3.00),
            (m["christmas_master_04"], 0.15, 3.00),
            (m["christmas_master_02"], 0.15, 3.00),
        ],
    )
    # Fast social hook: skater first frame, quicker cuts, ~12s
    social = export_reel(
        FINALS / "christmas_reel_social_hook_02.mp4",
        [
            (m["christmas_master_02"], 0.05, 2.20),
            (m["christmas_master_03"], 0.10, 2.40),
            (m["christmas_master_01"], 0.15, 2.40),
            (m["christmas_master_04"], 0.10, 2.50),
            (m["christmas_master_05"], 0.15, 2.50),
        ],
    )
    # Nostalgic memory: home-movie snowman → sledding → bakery → chalet → skate
    nostalgic = export_reel(
        FINALS / "christmas_reel_nostalgic_03.mp4",
        [
            (m["christmas_master_05"], 0.25, 3.20),
            (m["christmas_master_03"], 0.20, 3.00),
            (m["christmas_master_04"], 0.20, 2.80),
            (m["christmas_master_01"], 0.25, 2.80),
            (m["christmas_master_02"], 0.20, 2.70),
        ],
    )
    for name, info in [
        ("christmas_reel_cinematic_01", cinematic),
        ("christmas_reel_social_hook_02", social),
        ("christmas_reel_nostalgic_03", nostalgic),
    ]:
        poster(FINALS / f"{name}.mp4", POSTERS / f"{name}.jpg")
        log["reels"].append({"id": name, "probe": info, "file": f"/assets/christmas/reels/final/{name}.mp4"})

    log["actual_estimated_total_usd"] = round(actual_total, 4)
    GENLOG.write_text(json.dumps(log, indent=2) + "\n")
    LOG.write_text(json.dumps(log, indent=2) + "\n")
    print("TOTAL GENERATION COST (tariff):", f"${actual_total:.2f}", flush=True)
    print("All masters and reels written.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
