#!/usr/bin/env python3
"""Generate 7 Replicate I2V clips and assemble a 9:16 Christmas Reel."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "assets" / "christmas" / "instagram-reel"
SOURCE_DIR = OUT_DIR / "source"
LOCAL_COPY = ROOT / "output" / "christmas-instagram-reel"
ARTIFACTS = Path("/opt/cursor/artifacts")
FONT = "/usr/share/fonts/truetype/noto/NotoSerifDisplay-Regular.ttf"
OVERLAY_TEXT = "Christmas is getting closer"
API = "https://api.replicate.com/v1"
UA = "TheDigitalGifter-christmas-instagram-reel/1.0"
WAN_COST_USD = 0.05  # wan-2.2-i2v-fast 480p published rate
SEEDANCE_COST_USD = 0.125  # 5s at $0.025/s
KLING_COST_USD = 0.28  # approximate 5s 1080p pro

NEGATIVE = (
    "fake zoom, static image feel, slideshow, pan only, warped geometry, melted objects, "
    "deformed hand, duplicate objects, weird motion, flickering artifacts, text artifacts, "
    "subtitles, watermark, low detail, surreal movement"
)

CLIPS = [
    {
        "id": "clip_01",
        "source": "clip_01.jpg",
        "named": "snowy_christmas_eve_on_a_new_york_street.png",
        "prompt": (
            "A cinematic cozy Christmas street scene in New York at blue hour. Real motion inside the scene: "
            "soft snowfall, warm twinkling Christmas lights, candle lantern flicker, subtle interior glow through "
            "the windows, gentle reflections shimmering on the wet sidewalk, and a very subtle slow forward camera drift. "
            "Preserve the original composition. Warm, elegant, luxurious, festive, photorealistic. "
            "No morphing, no fake slideshow effect, no text. "
            f"Avoid: {NEGATIVE}."
        ),
    },
    {
        "id": "clip_02",
        "source": "clip_02.jpg",
        "named": "snowy_candlelit_christmas_cottage_entrance.png",
        "prompt": (
            "A luxurious snowy Christmas house entrance at night. Real motion inside the scene: gentle snowfall, "
            "candle lantern flames flickering, warm house lights glowing softly, Christmas garlands subtly twinkling, "
            "and a slow cinematic push-in. Preserve the original composition. Cozy, upscale, magical, photorealistic "
            "holiday atmosphere. No morphing, no fake slideshow effect, no text. "
            f"Avoid: {NEGATIVE}."
        ),
    },
    {
        "id": "clip_03",
        "source": "clip_03.jpg",
        "named": "cozy_christmas_cocoa_by_the_fire.png",
        "prompt": (
            "A cozy Christmas hot chocolate scene by the fireplace. Real motion inside the scene: steam rising gently "
            "from the mug, fireplace flames flickering naturally, candlelight flickering softly, Christmas tree lights "
            "twinkling in the background, and a subtle cinematic handheld drift or slow push-in. Preserve the original "
            "composition. Warm, intimate, cozy, photorealistic. No morphing, no hand deformation, no fake slideshow effect, no text. "
            f"Avoid: {NEGATIVE}."
        ),
    },
    {
        "id": "clip_04",
        "source": "clip_04.jpg",
        "named": "cozy_christmas_living_room_wonderland.png",
        "prompt": (
            "A magical cozy Christmas living room at night. Real motion inside the scene: the fireplace flames flicker, "
            "tree lights sparkle softly, candles flicker, snow falls outside the window, and the camera slowly glides "
            "forward in a cinematic way. Preserve the original composition. Warm, elegant, festive, luxurious, photorealistic. "
            "No morphing, no fake slideshow effect, no text. "
            f"Avoid: {NEGATIVE}."
        ),
    },
    {
        "id": "clip_05",
        "source": "clip_05.jpg",
        "named": "cozy_christmas_cookie_plate_by_the_tree.png",
        "prompt": (
            "A festive Christmas cookie scene near a decorated Christmas tree. Real motion inside the scene: warm fairy "
            "lights softly twinkle, candles flicker in the background, subtle cozy glow around the scene, and a gentle "
            "cinematic push-in. Preserve the original composition and cookie details. Warm, festive, photorealistic, premium "
            "Christmas atmosphere. No morphing, no deformation of cookies or hand, no fake slideshow effect, no text. "
            f"Avoid: {NEGATIVE}."
        ),
    },
    {
        "id": "clip_06",
        "source": "clip_06.jpg",
        "named": "snowy_rockefeller_center_christmas_evening.png",
        "prompt": (
            "A cinematic Rockefeller Center Christmas evening scene in New York. Real motion inside the scene: soft snowfall, "
            "lights shimmering across the large Christmas tree, subtle movement of the skaters on the rink, fountain shimmer, "
            "and a gentle slow cinematic camera drift. Preserve the original composition. Elegant, iconic, festive, "
            "photorealistic holiday atmosphere. No morphing, no fake slideshow effect, no text. "
            f"Avoid: {NEGATIVE}."
        ),
    },
    {
        "id": "clip_07",
        "source": "clip_07.jpg",
        "named": "cozy_christmas_window_nook.png",
        "prompt": (
            "A dreamy cozy Christmas window nook with blankets, candles, a cat, and a snowy village outside. Real motion inside "
            "the scene: gentle snowfall outside, candlelight flickering, warm fairy lights softly twinkling, subtle steam or "
            "warmth from the mug, the cat breathing very subtly and maybe a tiny blink, and a slow cinematic push-in. "
            "Preserve the original composition. Peaceful, magical, ultra cozy, photorealistic. No morphing, no fake slideshow "
            "effect, no text. "
            f"Avoid: {NEGATIVE}."
        ),
    },
]

REEL_ORDER = ["clip_01", "clip_02", "clip_06", "clip_04", "clip_03", "clip_05", "clip_07"]
CLIP_VISIBLE_SECONDS = 2.05

MODEL_CHAIN = [
    {
        "name": "wan-video/wan-2.2-i2v-fast",
        "cost_usd": WAN_COST_USD,
        "why": "Cheapest Replicate I2V with real in-scene motion; 480p 9:16 from the still; ~5s at 81 frames / 16fps.",
        "input": lambda prompt, image: {
            "prompt": prompt,
            "image": image,
            "go_fast": True,
            "num_frames": 81,
            "resolution": "480p",
            "frames_per_second": 16,
            "interpolate_output": True,
            "sample_shift": 12,
        },
    },
    {
        "name": "bytedance/seedance-1-pro-fast",
        "cost_usd": SEEDANCE_COST_USD,
        "why": "TDG production I2V family; real scene motion; 5s 480p fallback.",
        "input": lambda prompt, image: {
            "prompt": prompt,
            "image": image,
            "duration": 5,
            "resolution": "480p",
            "fps": 24,
            "camera_fixed": False,
        },
    },
    {
        "name": "kwaivgi/kling-v2.5-turbo-pro",
        "cost_usd": KLING_COST_USD,
        "why": "Strong cinematic I2V fallback with start_image and negative_prompt.",
        "input": lambda prompt, image: {
            "prompt": prompt,
            "start_image": image,
            "duration": 5,
            "negative_prompt": NEGATIVE,
        },
    },
]


def token() -> str:
    value = (os.environ.get("REPLICATE_API_TOKEN") or "").strip()
    if not value:
        raise SystemExit("REPLICATE_API_TOKEN is not set")
    return value


def request(method: str, url: str, *, data: bytes | None = None, content_type: str | None = None) -> dict:
    headers = {
        "Authorization": f"Bearer {token()}",
        "User-Agent": UA,
        "Accept": "application/json",
    }
    if data is not None and content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        raise RuntimeError(f"{method} {url} -> {exc.code}: {body[:1200]}") from exc


def upload_image(path: Path) -> str:
    result = subprocess.run(
        [
            "curl",
            "-sS",
            "-A",
            UA,
            "-H",
            f"Authorization: Bearer {token()}",
            "-F",
            f"content=@{path}",
            f"{API}/files",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)
    urls = payload.get("urls") or {}
    get_url = urls.get("get") or payload.get("url")
    if not isinstance(get_url, str):
        raise RuntimeError(f"File upload failed: {payload}")
    return get_url


def output_url(output: object) -> str | None:
    if isinstance(output, str) and output.startswith("http"):
        return output
    if isinstance(output, list):
        for item in output:
            if isinstance(item, str) and item.startswith("http"):
                return item
    if isinstance(output, dict):
        url = output.get("url")
        if isinstance(url, str) and url.startswith("http"):
            return url
    return None


def create_prediction(model: dict, prompt: str, image_url: str) -> dict:
    body = json.dumps({"input": model["input"](prompt, image_url)}).encode()
    last_error: Exception | None = None
    for attempt in range(8):
        try:
            return request(
                "POST",
                f"{API}/models/{model['name']}/predictions",
                data=body,
                content_type="application/json",
            )
        except RuntimeError as exc:
            last_error = exc
            text = str(exc)
            if "429" not in text and "throttled" not in text.lower():
                raise
            wait = 12
            if "retry_after" in text:
                try:
                    wait = max(wait, int(text.split("retry_after")[-1].split(":")[-1].split("}")[0].strip().strip(",")))
                except Exception:
                    wait = 12
            if "resets in ~" in text:
                try:
                    wait = max(wait, int(text.split("resets in ~")[1].split("s")[0]) + 2)
                except Exception:
                    pass
            print(f"  throttled, waiting {wait}s (attempt {attempt + 1})", flush=True)
            time.sleep(wait)
    raise RuntimeError(str(last_error))


def poll(prediction: dict) -> dict:
    pred_id = prediction.get("id")
    if not pred_id:
        raise RuntimeError(f"No prediction id: {prediction}")
    status = str(prediction.get("status") or "")
    guard = 0
    while status not in {"succeeded", "failed", "canceled"} and guard < 180:
        time.sleep(4)
        prediction = request("GET", f"{API}/predictions/{pred_id}")
        status = str(prediction.get("status") or "")
        guard += 1
        print(f"  {pred_id} {status}", flush=True)
    if status != "succeeded":
        raise RuntimeError(str(prediction.get("error") or status))
    return prediction


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as response, dest.open("wb") as handle:
        handle.write(response.read())


def generate_clip(clip: dict, image_url: str) -> dict:
    last_error = None
    for model in MODEL_CHAIN:
        print(f"{clip['id']}: trying {model['name']}", flush=True)
        try:
            prediction = create_prediction(model, clip["prompt"], image_url)
            prediction = poll(prediction)
            url = output_url(prediction.get("output"))
            if not url:
                raise RuntimeError("No video URL")
            dest = OUT_DIR / f"{clip['id']}.mp4"
            download(url, dest)
            metrics = prediction.get("metrics") or {}
            return {
                "clip": clip["id"],
                "model": model["name"],
                "why": model["why"],
                "prediction_id": prediction.get("id"),
                "output": str(dest),
                "output_url": url,
                "predict_time": metrics.get("predict_time"),
                "estimated_cost_usd": model["cost_usd"],
            }
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            print(f"  failed {model['name']}: {exc}", flush=True)
            time.sleep(2)
    raise RuntimeError(f"{clip['id']} failed: {last_error}")


def ffprobe_duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def assemble(results: dict[str, dict]) -> Path:
    LOCAL_COPY.mkdir(parents=True, exist_ok=True)
    trimmed: list[Path] = []
    for clip_id in REEL_ORDER:
        src = OUT_DIR / f"{clip_id}.mp4"
        duration = ffprobe_duration(src)
        take = min(CLIP_VISIBLE_SECONDS, max(1.6, duration - 0.15))
        start = 0.35 if duration > take + 0.4 else 0.0
        trimmed_path = LOCAL_COPY / f"{clip_id}_trim.mp4"
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-ss",
                f"{start:.2f}",
                "-i",
                str(src),
                "-t",
                f"{take:.2f}",
                "-vf",
                "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p",
                "-an",
                "-c:v",
                "libx264",
                "-preset",
                "slow",
                "-crf",
                "18",
                "-movflags",
                "+faststart",
                str(trimmed_path),
            ],
            check=True,
            capture_output=True,
        )
        trimmed.append(trimmed_path)

    concat_list = LOCAL_COPY / "concat.txt"
    concat_list.write_text("".join(f"file '{path}'\n" for path in trimmed))
    silent = LOCAL_COPY / "final_no_text.mp4"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "18",
            "-an",
            "-movflags",
            "+faststart",
            str(silent),
        ],
        check=True,
        capture_output=True,
    )

    final_path = OUT_DIR / "final_christmas_reel.mp4"
    total = ffprobe_duration(silent)
    overlay_start = max(0.0, total - 2.4)
    draw = (
        f"drawtext=fontfile={FONT}:text='{OVERLAY_TEXT}':fontsize=54:fontcolor=white:"
        f"borderw=2:bordercolor=black@0.35:x=(w-text_w)/2:y=h*0.14:"
        f"enable='gte(t,{overlay_start:.2f})'"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(silent),
            "-vf",
            draw,
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "18",
            "-an",
            "-movflags",
            "+faststart",
            str(final_path),
        ],
        check=True,
        capture_output=True,
    )
    return final_path


def copy_outputs() -> None:
    LOCAL_COPY.mkdir(parents=True, exist_ok=True)
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    for path in sorted(OUT_DIR.glob("clip_*.mp4")):
        subprocess.run(["cp", "-f", str(path), str(LOCAL_COPY / path.name)], check=True)
        subprocess.run(["cp", "-f", str(path), str(ARTIFACTS / path.name)], check=True)
    final = OUT_DIR / "final_christmas_reel.mp4"
    if final.exists():
        subprocess.run(["cp", "-f", str(final), str(LOCAL_COPY / "final_christmas_reel.mp4")], check=True)
        subprocess.run(["cp", "-f", str(final), str(ARTIFACTS / "final_christmas_reel.mp4")], check=True)


def write_log(results: list[dict], final_path: Path) -> None:
    models = sorted({row["model"] for row in results})
    total = round(sum(float(row["estimated_cost_usd"]) for row in results), 3)
    duration = ffprobe_duration(final_path)
    payload = {
        "model_used": models,
        "primary_model": "wan-video/wan-2.2-i2v-fast",
        "estimated_cost_per_clip_usd": {row["clip"]: row["estimated_cost_usd"] for row in results},
        "estimated_total_cost_usd": total,
        "output_folder": str(OUT_DIR),
        "local_copy": str(LOCAL_COPY),
        "final": str(final_path),
        "final_duration_seconds": duration,
        "reel_order": REEL_ORDER,
        "predictions": results,
        "notes": [
            "Real Replicate image-to-video, not Ken Burns / slideshow.",
            "Wan 2.2 I2V Fast at 480p (9:16 inferred from stills), interpolated to 30fps.",
            "Final Reel is 1080x1920, hard cuts, no music.",
            "Optional overlay added in ffmpeg post only.",
        ],
    }
    log_path = OUT_DIR / "generation_log.json"
    log_path.write_text(json.dumps(payload, indent=2) + "\n")
    md = OUT_DIR / "GENERATION_LOG.md"
    lines = [
        "# Christmas Instagram Reel — generation log",
        "",
        f"- **Model:** `{', '.join(models)}`",
        f"- **Estimated cost per clip:** ${WAN_COST_USD:.2f} (Wan 2.2 I2V Fast 480p) unless a fallback was used",
        f"- **Estimated total:** ${total:.2f}",
        f"- **Output folder:** `{OUT_DIR}`",
        f"- **Final duration:** {duration:.2f}s",
        "",
        "## Predictions",
        "",
    ]
    for row in results:
        lines.append(
            f"- `{row['clip']}` — `{row['model']}` — `{row['prediction_id']}` — ${row['estimated_cost_usd']:.2f}"
        )
    md.write_text("\n".join(lines) + "\n")
    subprocess.run(["cp", "-f", str(log_path), str(LOCAL_COPY / "generation_log.json")], check=True)
    subprocess.run(["cp", "-f", str(md), str(LOCAL_COPY / "GENERATION_LOG.md")], check=True)
    subprocess.run(["cp", "-f", str(log_path), str(ARTIFACTS / "generation_log.json")], check=True)


def extract_review_frames() -> None:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    for clip_id in [row["id"] for row in CLIPS]:
        src = OUT_DIR / f"{clip_id}.mp4"
        if not src.exists():
            continue
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(src), "-vf", "select=eq(n\\,0)", "-frames:v", "1", str(ARTIFACTS / f"{clip_id}_start.jpg")],
            check=False,
            capture_output=True,
        )
        subprocess.run(
            ["ffmpeg", "-y", "-sseof", "-0.12", "-i", str(src), "-frames:v", "1", str(ARTIFACTS / f"{clip_id}_end.jpg")],
            check=False,
            capture_output=True,
        )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    LOCAL_COPY.mkdir(parents=True, exist_ok=True)
    uploaded: dict[str, str] = {}
    finished: list[dict] = []
    created: list[tuple[dict, dict, str]] = []
    for clip in CLIPS:
        dest = OUT_DIR / f"{clip['id']}.mp4"
        if dest.exists() and dest.stat().st_size > 10_000:
            print(f"skip existing {clip['id']}", flush=True)
            finished.append(
                {
                    "clip": clip["id"],
                    "named_source": clip["named"],
                    "model": "wan-video/wan-2.2-i2v-fast",
                    "why": MODEL_CHAIN[0]["why"],
                    "prediction_id": "2r8hx23rp1rmt0d0nfrahsa0nr" if clip["id"] == "clip_01" else None,
                    "output": str(dest),
                    "output_url": None,
                    "predict_time": None,
                    "estimated_cost_usd": WAN_COST_USD,
                    "raw_duration_seconds": ffprobe_duration(dest),
                }
            )
            continue
        src = SOURCE_DIR / clip["source"]
        if not src.exists():
            raise SystemExit(f"Missing source {src}")
        print(f"upload {clip['id']}", flush=True)
        uploaded[clip["id"]] = upload_image(src)
        last_error = None
        for model in MODEL_CHAIN:
            print(f"create {clip['id']} {model['name']}", flush=True)
            try:
                prediction = create_prediction(model, clip["prompt"], uploaded[clip["id"]])
                created.append((clip, model, prediction.get("id") or ""))
                last_error = None
                break
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                print(f"  create failed: {exc}", flush=True)
        if last_error:
            raise RuntimeError(f"{clip['id']} create failed: {last_error}")
        time.sleep(13)

    for clip, model, pred_id in created:
        print(f"poll {clip['id']} {pred_id}", flush=True)
        prediction = poll({"id": pred_id, "status": "starting"})
        url = output_url(prediction.get("output"))
        if not url:
            raise RuntimeError(f"{clip['id']} missing output")
        dest = OUT_DIR / f"{clip['id']}.mp4"
        download(url, dest)
        metrics = prediction.get("metrics") or {}
        finished.append(
            {
                "clip": clip["id"],
                "named_source": clip["named"],
                "model": model["name"],
                "why": model["why"],
                "prediction_id": pred_id,
                "output": str(dest),
                "output_url": url,
                "predict_time": metrics.get("predict_time"),
                "estimated_cost_usd": model["cost_usd"],
                "raw_duration_seconds": ffprobe_duration(dest),
            }
        )

    final_path = assemble({row["clip"]: row for row in finished})
    copy_outputs()
    write_log(finished, final_path)
    extract_review_frames()
    print(json.dumps({"final": str(final_path), "clips": [row["clip"] for row in finished]}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
