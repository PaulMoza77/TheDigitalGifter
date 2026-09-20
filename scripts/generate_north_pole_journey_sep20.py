#!/usr/bin/env python3
"""Generate 11 Higgsfield Kling 3.0 Pro I2V masters (5s, sound=off) for the North Pole journey stills.

Fails closed if Higgsfield credentials are missing. Never uses Replicate.
Resumes completed jobs from the generation log — never resubmits a successful request_id.
Credentials: HF_CREDENTIALS=KEY_ID:KEY_SECRET (or HF_API_KEY_ID + HF_API_KEY_SECRET).
Never print credential values.
"""

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

HIGGSFIELD_API_BASE = "https://api.higgsfield.ai"
MODEL_ID = "kling-video/v3.0/pro/image-to-video"
ESTIMATE_PATH = "/estimate/kling-video/v3.0/pro/image-to-video"
SUBMIT_PATH = "/kling-video/v3.0/pro/image-to-video"
DURATION = 5
# Eleven clips at the Sep 20 live rate (~$0.28) plus two technical retries.
BUDGET_USD = 4.20

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
SOURCE = Path(os.environ.get("TDG_SOURCE") or (ROOT / "source" / "batch-np-journey"))
MASTERS = Path(os.environ.get("TDG_MASTERS") or (ROOT / "public" / "assets" / "christmas" / "np-journey" / "masters"))
POSTERS = Path(os.environ.get("TDG_POSTERS") or (ROOT / "public" / "assets" / "christmas" / "np-journey" / "posters"))
QC = Path(os.environ.get("TDG_QC") or (ROOT / "generated" / "batch-np-journey" / "qc"))
LOG = Path(os.environ.get("TDG_LOG") or (ROOT / "public" / "assets" / "christmas" / "np-journey" / "generation_manifest.json"))
GENLOG = Path(os.environ.get("TDG_GENLOG") or (ROOT / "generated" / "batch-np-journey" / "generation_log.json"))

NEGATIVE = (
    " Do not morph faces, buildings, vehicles, animals, or text. No duplicated people, no extra limbs, "
    "no melting objects, no random text, logos, or captions appearing. No wild camera spins. "
    "No fake zoom-only animation. Subtle cinematic motion only. Keep hands, faces, and architecture stable."
)

CLIPS = [
    {
        "id": "npj_01_train_window",
        "filename": "npj_01_train_window.mp4",
        "image": SOURCE / "01_train_window_girl_1080x1920.png",
        "source_still": "np_journey_train_window_girl.jpg",
        "title": "Magical train window",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas night. This exact photograph comes alive for five seconds. "
            "Preserve the child in the red knit hat leaning from the lantern-lit red carriage, pine garland, "
            "warm string lights, steam locomotive, red passenger cars, stone viaduct, moon, snowy pines, "
            "and alpine village exactly as in the first frame. The train moves genuinely forward along the viaduct "
            "with physically correct wheel rotation. Thick steam billows from the stack and drifts naturally. "
            "Snow falls with depth and parallax. Coach lights flicker extremely subtly. Hair and knit hat react "
            "slightly to wind. Very gentle camera track along the carriage. Do not overanimate the child's face "
            "or hands. Architecture stays rigid. No extra cars or warped wheels."
            + NEGATIVE
        ),
    },
    {
        "id": "npj_02_station",
        "filename": "npj_02_station.mp4",
        "image": SOURCE / "02_north_pole_express_station_1080x1920.png",
        "source_still": "np_journey_north_pole_express_station.jpg",
        "title": "North Pole Express station",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas night at a station. This exact photograph comes alive for five seconds. "
            "Preserve the NORTH POLE EXPRESS sign, PLATFORM 1 plaque, clock, wreath-lit locomotive headlights, "
            "red carriages, child with backpack and suitcase, wet platform, luggage, and falling snow exactly as framed. "
            "The locomotive eases slowly forward a few meters with natural steam and wheel rotation. Headlights glow steadily. "
            "Sparse snow. Distant passengers take tiny natural steps. Clock hands stay readable. Sign lettering does not warp. "
            "Child remains mostly still with a subtle breath and coat shift — no face morphing, no extra limbs. "
            "Gentle cinematic push toward the train. Architecture stays rigid."
            + NEGATIVE
        ),
    },
    {
        "id": "npj_03_aurora_window",
        "filename": "npj_03_aurora_window.mp4",
        "image": SOURCE / "03_aurora_from_train_1080x1920.png",
        "source_still": "np_journey_aurora_from_train.jpg",
        "title": "Aurora from the train",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas night. This exact photograph comes alive for five seconds. "
            "Preserve the red train on the stone viaduct, warm carriage windows, steam, alpine village, lake, "
            "mountains, and green-purple aurora exactly as in the first frame. The train advances along the tracks "
            "with correct motion. Steam drifts. Aurora slowly ripples across the sky. Snow falls with parallax. "
            "Village lights twinkle very softly. Slow dolly along the viaduct railing. Architecture and arches stay rigid. "
            "No warped train geometry."
            + NEGATIVE
        ),
    },
    {
        "id": "npj_04_viaduct_wide",
        "filename": "npj_04_viaduct_wide.mp4",
        "image": SOURCE / "04_viaduct_aurora_wide_1080x1920.png",
        "source_still": "np_journey_viaduct_aurora_wide.jpg",
        "title": "Train on aurora viaduct",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas night. This exact photograph comes alive for five seconds. "
            "Preserve the steam locomotive, red carriages, high stone viaduct arches, frozen river, snowy pines, "
            "village lights, mountains, and aurora exactly as framed. The train travels forward across the viaduct "
            "with physically correct motion and natural steam. Aurora slowly moves. Snow falls with depth. "
            "Headlamp beam stays attached to the locomotive. Very slow cinematic push with slight tracking. "
            "Pines stay solid. No melting arches, no extra locomotives."
            + NEGATIVE
        ),
    },
    {
        "id": "npj_05_village_arrival",
        "filename": "npj_05_village_arrival.mp4",
        "image": SOURCE / "05_santa_village_arrival_1080x1920.png",
        "source_still": "np_journey_santa_village_arrival.jpg",
        "title": "North Pole Santa Village",
        "prompt": (
            "Photoreal cinematic 9:16 North Pole night. This exact photograph comes alive for five seconds. "
            "Preserve the child with backpack, lantern-lit train at left, NORTH POLE SANTA VILLAGE arch, "
            "wooden destination signs, elves, reindeer, clock-tower palace, giant Christmas tree, and aurora. "
            "Gentle walk-forward energy: the traveler is mostly still with a subtle coat shift. Elves take small "
            "believable steps carrying gifts. Reindeer make a tiny natural head movement. Lanterns flicker softly. "
            "Snow falls. Arch lettering stays readable and unwarped. Slow cinematic push through the lane. "
            "Do not morph faces or add extra limbs."
            + NEGATIVE
        ),
    },
    {
        "id": "npj_06_workshop_street",
        "filename": "npj_06_workshop_street.mp4",
        "image": SOURCE / "06_workshop_street_1080x1920.png",
        "source_still": "np_journey_workshop_street.jpg",
        "title": "Santa’s Workshop street",
        "prompt": (
            "Photoreal cinematic 9:16 North Pole street. This exact photograph comes alive for five seconds. "
            "Preserve the child from behind, lantern-lit train, SANTA'S WORKSHOP facade, reindeer, elves, gift stacks, "
            "giant tree, SANTA VILLAGE arch, and aurora. Reindeer shift weight naturally and breathe. Elves make small "
            "wrapping and walking motions. Tree lights sparkle. Snow falls. Workshop sign letters stay unchanged. "
            "Slow push past the child toward the workshop. Do not overanimate the child's face or hands. "
            "No disappearing reindeer, no extra antlers."
            + NEGATIVE
        ),
    },
    {
        "id": "npj_07_workshop_list",
        "filename": "npj_07_workshop_list.mp4",
        "image": SOURCE / "07_workshop_naughty_nice_1080x1920.png",
        "source_still": "np_journey_workshop_naughty_nice.jpg",
        "title": "Santa and the Naughty or Nice list",
        "prompt": (
            "Photoreal cinematic 9:16 Santa’s workshop interior. This exact photograph comes alive for five seconds. "
            "Preserve Santa from behind at the desk, Naughty or Nice parchment, wrapping elf, sleeping golden retriever, "
            "SANTA'S WORKSHOP banner, toy train, lantern, map, snow globe, and the window with sleigh silhouette. "
            "Santa’s hands make a tiny natural adjustment on the list. The elf wraps with small believable motions. "
            "Lantern firelight flickers. Steam rises from the cocoa. The dog breathes while sleeping. Background elves "
            "move slightly at the benches. Aurora drifts outside. Banner and list lettering stay readable. "
            "No face morphing, no extra fingers. Slow gentle push toward the desk."
            + NEGATIVE
        ),
    },
    {
        "id": "npj_08_wrapping",
        "filename": "npj_08_wrapping.mp4",
        "image": SOURCE / "08_workshop_wrapping_1080x1920.png",
        "source_still": "np_journey_workshop_wrapping.jpg",
        "title": "Elves wrapping with Santa",
        "prompt": (
            "Photoreal cinematic 9:16 Santa’s workshop. This exact photograph comes alive for five seconds. "
            "Preserve Santa tying a bow, two wrapping elves, toy train, teddy, lantern, Good Children Around the World "
            "scroll, snow globe, gift piles, and the window with reindeer sleigh. Santa’s hands finish a small ribbon tug "
            "without morphing. Elves make subtle wrapping motions. Lantern flickers. Background workshop stays busy but stable. "
            "Scroll lettering remains readable. Slow cinematic push. Do not add extra limbs or warp faces."
            + NEGATIVE
        ),
    },
    {
        "id": "npj_09_window_sleigh",
        "filename": "npj_09_window_sleigh.mp4",
        "image": SOURCE / "09_window_sleigh_payoff_1080x1920.png",
        "source_still": "np_journey_window_sleigh_payoff.jpg",
        "title": "Child watching Santa’s sleigh",
        "prompt": (
            "Photoreal cinematic 9:16 cozy Christmas night. This exact photograph comes alive for five seconds. "
            "Preserve the girl in red pajamas, teddy, golden retriever, mug, cookies, Christmas tree, and the window view "
            "of the moonlit village. Santa’s sleigh and reindeer actually travel across the sky from left toward the moon "
            "with anatomically stable reindeer motion — no extra legs. Village chimney smoke drifts. Tree lights twinkle. "
            "The dog’s ears shift slightly. Girl stays mostly still with a tiny breath. Do not morph faces. "
            "Camera almost locked-off with a very gentle push toward the window."
            + NEGATIVE
        ),
    },
    {
        "id": "npj_10_snowman",
        "filename": "npj_10_snowman.mp4",
        "image": SOURCE / "10_village_snowman_1080x1920.png",
        "source_still": "np_journey_village_snowman.jpg",
        "title": "Village square snowman",
        "prompt": (
            "Photoreal cinematic 9:16 alpine Christmas market. This exact photograph comes alive for five seconds. "
            "Preserve the child in the red coat placing the carrot, snowman, golden retriever with scarf, lantern, gifts, "
            "market stalls, clock tower, giant tree, and GOOD PEOPLE BRIGHTER TOMORROWS sign. Child’s hand makes a tiny "
            "natural finish on the carrot — no extra fingers. The dog looks up with a small head tilt. Sparse snowfall. "
            "Tree lights sparkle. Distant villagers shift slightly. Sign letters stay readable. Slow gentle push. "
            "Architecture stays rigid. No face morphing."
            + NEGATIVE
        ),
    },
    {
        "id": "npj_11_plaza",
        "filename": "npj_11_plaza.mp4",
        "image": SOURCE / "11_plaza_nyc_girl_dog_1080x1920.png",
        "source_still": "np_journey_plaza_nyc_girl_dog.jpg",
        "title": "The Plaza New York arrival",
        "prompt": (
            "Photoreal cinematic 9:16 Fifth Avenue Christmas night. This exact photograph comes alive for five seconds. "
            "Preserve the girl in the red coat holding a gift, golden retriever with bow, THE PLAZA canopy, doorman, "
            "red carpet, vintage cars, Chrysler Building, and street trees exactly as framed. Very slow street-level dolly. "
            "Doorman stands with a tiny natural shift. Distant pedestrians move slightly. Wet pavement reflections slide. "
            "Sparse snowfall. Canopy lettering THE PLAZA does not warp. Dog stays mostly still with a breath. "
            "Do not morph the child's face or add extra limbs. Facade stays rigid."
            + NEGATIVE
        ),
    },
]


def read_credentials() -> tuple[str, str]:
    combined = (os.environ.get("HF_CREDENTIALS") or os.environ.get("HF_KEY") or "").strip()
    if ":" in combined:
        key_id, secret = combined.split(":", 1)
        key_id, secret = key_id.strip(), secret.strip()
        if key_id and secret:
            return key_id, secret
    key_id = (os.environ.get("HF_API_KEY_ID") or os.environ.get("HF_API_KEY") or "").strip()
    secret = (
        os.environ.get("HF_API_KEY_SECRET") or os.environ.get("HF_SECRET") or os.environ.get("HF_API_SECRET") or ""
    ).strip()
    if key_id and secret:
        return key_id, secret
    print("BLOCKED: Higgsfield credentials missing. Fail closed — no Replicate fallback.", file=sys.stderr)
    raise SystemExit(2)


def auth_header() -> str:
    key_id, secret = read_credentials()
    return f"Key {key_id}:{secret}"


def hf_request(method: str, path_or_url: str, data: dict | None = None, timeout: int = 180) -> dict:
    url = path_or_url if path_or_url.startswith("http") else f"{HIGGSFIELD_API_BASE}{path_or_url}"
    body = None if data is None else json.dumps(data).encode()
    headers = {
        "Authorization": auth_header(),
        "User-Agent": "tdg-np-journey-sep20/higgsfield",
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"{method} {url} -> {e.code} {err[:800]}") from e


def parse_estimate(body: object) -> dict:
    if not isinstance(body, dict):
        raise RuntimeError(f"estimate response not an object: {body!r}")
    usd_raw = body.get("usd")
    usd = float(usd_raw) if usd_raw is not None else float("nan")
    if not (usd >= 0):
        raise RuntimeError(f"live estimate missing usd: {body}")
    credits = body.get("credits")
    return {"usd": usd, "credits": None if credits is None else str(credits), "raw": body}


def video_url_from_status(body: dict) -> str | None:
    video = body.get("video")
    if isinstance(video, dict) and isinstance(video.get("url"), str):
        return video["url"]
    if isinstance(body.get("video_url"), str):
        return body["video_url"]
    images = body.get("images")
    if isinstance(images, list) and images:
        first = images[0]
        if isinstance(first, dict) and isinstance(first.get("url"), str):
            return first["url"]
    return None


def upload_image(path: Path) -> str:
    ctype = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    meta = hf_request("POST", "/files/generate-upload-url", {"content_type": ctype})
    public_url = meta.get("public_url")
    upload_url = meta.get("upload_url")
    if not public_url or not upload_url:
        raise RuntimeError(f"upload URL missing fields: keys={list(meta.keys())}")
    headers = dict(meta.get("upload_headers") or {"Content-Type": ctype})
    data = path.read_bytes()
    req = urllib.request.Request(str(upload_url), data=data, method="PUT", headers=headers)
    with urllib.request.urlopen(req, timeout=180) as resp:
        resp.read()
    return str(public_url)


def clip_payload(image_url: str, prompt: str) -> dict:
    return {
        "image_url": image_url,
        "prompt": prompt,
        "duration": DURATION,
        "sound": "off",
    }


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-np-journey-sep20/higgsfield"})
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
    if info["width"] < 1080 or info["height"] < 1080:
        raise RuntimeError(f"{info['filename']} too small: {info['width']}x{info['height']}")
    if info["duration"] < 4.5 or info["duration"] > 6.5:
        raise RuntimeError(f"{info['filename']} duration {info['duration']}")
    if info["size"] < 200_000:
        raise RuntimeError(f"{info['filename']} looks empty/corrupt ({info['size']} bytes)")


def extract_qc_frames(src: Path) -> list[Path]:
    QC.mkdir(parents=True, exist_ok=True)
    out = []
    for label, t in (("first", 0.12), ("mid", 2.4), ("last", 4.7)):
        dest = QC / f"{src.stem}_{label}.jpg"
        subprocess.check_call(
            ["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        out.append(dest)
    return out


def poster(src: Path, dest: Path, t: float = 0.4) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def verify_auth() -> None:
    print("HIGGSFIELD_AUTH: ping generate-upload-url", flush=True)
    meta = hf_request("POST", "/files/generate-upload-url", {"content_type": "image/png"})
    if not meta.get("upload_url"):
        raise RuntimeError("HIGGSFIELD_AUTH FAIL: upload URL response missing upload_url")
    print("HIGGSFIELD_AUTH: PASS", flush=True)
    print(f"MODEL: {MODEL_ID}", flush=True)


def poll_job(request_id: str, timeout_s: int = 1200) -> dict:
    start = time.time()
    while time.time() - start < timeout_s:
        current = hf_request("GET", f"/requests/{request_id}/status")
        status = str(current.get("status") or "")
        print(f"  {request_id} {status}", flush=True)
        if status.lower() in {"completed", "succeeded", "failed", "nsfw", "canceled", "cancelled", "error"}:
            return current
        time.sleep(8)
    raise TimeoutError(f"Higgsfield job {request_id} timed out")


def load_log() -> dict:
    for path in (LOG, GENLOG):
        if path.exists():
            try:
                data = json.loads(path.read_text())
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                pass
    return {}


def existing_clip(log: dict, clip_id: str) -> dict | None:
    for row in log.get("clips") or []:
        if row.get("id") == clip_id and row.get("job_id") and Path(row.get("file") or "").exists():
            try:
                validate_master(probe_summary(Path(row["file"])))
            except Exception:
                continue
            return row
    dest = MASTERS / next(c["filename"] for c in CLIPS if c["id"] == clip_id)
    if dest.exists():
        try:
            validate_master(probe_summary(dest))
            return {"id": clip_id, "file": str(dest), "job_id": "existing-file", "generation_cost_usd": 0, "resumed": True}
        except Exception:
            return None
    return None


def write_logs(log: dict) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    GENLOG.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(log, indent=2) + "\n"
    LOG.write_text(text)
    GENLOG.write_text(text)


def finish_local_assets(clip: dict, dest: Path, request_id: str, est: dict, prompt: str) -> dict:
    info = probe_summary(dest)
    validate_master(info)
    print(
        f"FFPROBE {info['filename']} {info['width']}x{info['height']} "
        f"{info['duration']:.3f}s {info['codec']} {info['fps']}fps",
        flush=True,
    )
    frames = extract_qc_frames(dest)
    poster(dest, POSTERS / f"{clip['id']}.jpg")
    return {
        "id": clip["id"],
        "title": clip["title"],
        "source_image": clip["source_still"],
        "job_id": str(request_id),
        "model": MODEL_ID,
        "prompt": prompt,
        "generation_cost_usd": est["usd"],
        "credits": est["credits"],
        "file": str(dest),
        "probe": info,
        "qc_frames": [str(p) for p in frames],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def submit_and_download(clip: dict, est: dict, pending_job: str | None = None) -> dict:
    dest = MASTERS / clip["filename"]
    if pending_job:
        print(f"Resuming poll {clip['id']} job={pending_job}", flush=True)
        done = poll_job(pending_job)
        request_id = pending_job
    else:
        payload = clip_payload(clip["_image_url"], clip["prompt"])
        print(f"Submitting {clip['id']}...", flush=True)
        submitted = hf_request("POST", SUBMIT_PATH, payload)
        request_id = submitted.get("request_id")
        if not request_id:
            raise RuntimeError(f"submit missing request_id: {submitted}")
        print(f"  job={request_id} status={submitted.get('status')}", flush=True)
        done = poll_job(str(request_id))
    status = str(done.get("status") or "").lower()
    if status not in {"completed", "succeeded"}:
        raise RuntimeError(f"{clip['id']} failed: status={done.get('status')} error={done.get('error')} job={request_id}")
    url = video_url_from_status(done)
    if not url:
        raise RuntimeError(f"{clip['id']} missing video url: keys={list(done.keys())}")
    print(f"Downloading {clip['id']} -> {dest}", flush=True)
    download(url, dest)
    return finish_local_assets(clip, dest, str(request_id), est, clip["prompt"])


def pending_job_id(log: dict, clip_id: str) -> str | None:
    for row in log.get("pending") or []:
        if row.get("id") == clip_id and row.get("job_id"):
            return str(row["job_id"])
    return None


def upsert_pending(log: dict, clip_id: str, job_id: str) -> None:
    pending = [row for row in (log.get("pending") or []) if row.get("id") != clip_id]
    pending.append({"id": clip_id, "job_id": job_id, "at": datetime.now(timezone.utc).isoformat()})
    log["pending"] = pending
    write_logs(log)


def main() -> int:
    estimate_only = "--estimate-only" in sys.argv
    only_ids = [a.split("=", 1)[1] for a in sys.argv if a.startswith("--only=")]
    only_set = set(only_ids[0].split(",")) if only_ids else None
    read_credentials()
    verify_auth()

    MASTERS.mkdir(parents=True, exist_ok=True)
    GENLOG.parent.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)

    work = [c for c in CLIPS if only_set is None or c["id"] in only_set]
    if not work:
        raise SystemExit("no clips selected")

    prev = load_log()
    uploads: dict[str, str] = {}
    for clip in work:
        if not clip["image"].exists():
            raise SystemExit(f"missing still {clip['image']}")
        if existing_clip(prev, clip["id"]) and not estimate_only:
            print(f"SKIP upload {clip['id']} — master already on disk", flush=True)
            continue
        print(f"Uploading {clip['image'].name}...", flush=True)
        uploads[clip["id"]] = upload_image(clip["image"])
        clip["_image_url"] = uploads[clip["id"]]

    estimates = []
    total_usd = 0.0
    print("=" * 72)
    print("LIVE HIGGSFIELD ESTIMATE")
    print(f"MODEL: {MODEL_ID}")
    for clip in work:
        if clip["id"] in uploads:
            payload = clip_payload(uploads[clip["id"]], clip["prompt"])
            body = hf_request("POST", ESTIMATE_PATH, payload)
            est = parse_estimate(body)
        else:
            prior = next((c for c in (prev.get("clips") or []) if c.get("id") == clip["id"]), None)
            usd = float((prior or {}).get("generation_cost_usd") or 0)
            est = {"usd": usd, "credits": (prior or {}).get("credits"), "raw": {"resumed": True}}
        estimates.append({"id": clip["id"], **est})
        total_usd += est["usd"]
        print(f"  {clip['id']}: ${est['usd']:.4f}  credits={est['credits']}", flush=True)
    print(f"ESTIMATED_COST (new + resumed): ${total_usd:.4f}")
    print("=" * 72, flush=True)

    new_usd = sum(e["usd"] for e, c in zip(estimates, work) if c["id"] in uploads)
    if new_usd > BUDGET_USD:
        print(f"STOP: live Higgsfield new total ${new_usd:.4f} exceeds ${BUDGET_USD:.2f}", flush=True)
        write_logs(
            {
                "status": "BLOCKED_PRICE",
                "provider": "higgsfield",
                "model": MODEL_ID,
                "estimated_total_usd": new_usd,
                "estimates": [{k: v for k, v in row.items() if k != "raw"} for row in estimates],
            }
        )
        return 3

    if estimate_only:
        print("estimate-only: not submitting paid jobs", flush=True)
        write_logs(
            {
                "status": "ESTIMATE_ONLY",
                "provider": "higgsfield",
                "model": MODEL_ID,
                "estimated_total_usd": new_usd,
                "estimates": [{k: v for k, v in row.items() if k != "raw"} for row in estimates],
            }
        )
        return 0

    print(f"PRICE CHECK: new ${new_usd:.4f} <= ${BUDGET_USD:.2f} — proceeding", flush=True)
    log = {
        "created_at": prev.get("created_at") or datetime.now(timezone.utc).isoformat(),
        "provider": "higgsfield",
        "model": MODEL_ID,
        "duration": DURATION,
        "sound": "off",
        "estimated_total_usd": new_usd,
        "regenerations": int(prev.get("regenerations") or 0),
        "clips": [c for c in (prev.get("clips") or []) if existing_clip(prev, c.get("id") or "")],
        "pending": prev.get("pending") or [],
        "failed": prev.get("failed") or [],
        "reels": prev.get("reels") or [],
    }

    est_by_id = {e["id"]: e for e in estimates}

    # Submit all missing jobs first so Higgsfield can run them in parallel.
    for clip in work:
        already = next((c for c in log["clips"] if c.get("id") == clip["id"]), None)
        if already:
            continue
        if pending_job_id(log, clip["id"]):
            continue
        payload = clip_payload(clip["_image_url"], clip["prompt"])
        print(f"Submitting {clip['id']}...", flush=True)
        submitted = hf_request("POST", SUBMIT_PATH, payload)
        request_id = submitted.get("request_id")
        if not request_id:
            raise RuntimeError(f"submit missing request_id: {submitted}")
        upsert_pending(log, clip["id"], str(request_id))
        print(f"  job={request_id} status={submitted.get('status')}", flush=True)
        time.sleep(0.4)

    for clip in work:
        already = next((c for c in log["clips"] if c.get("id") == clip["id"]), None)
        if already:
            print(f"RESUME skip paid submit {clip['id']} job={already.get('job_id')}", flush=True)
            continue
        pending = pending_job_id(log, clip["id"])
        est = est_by_id[clip["id"]]
        try:
            entry = submit_and_download(clip, est, pending_job=pending)
        except Exception as err:
            print(f"TECHNICAL FAIL {clip['id']}: {err} — retrying once only if no live job remains", flush=True)
            log["regenerations"] += 1
            log.setdefault("failed", []).append(
                {"id": clip["id"], "error": str(err)[:500], "at": datetime.now(timezone.utc).isoformat()}
            )
            write_logs(log)
            time.sleep(4)
            pending2 = pending_job_id(log, clip["id"])
            reuse = None
            if pending2:
                try:
                    status_body = hf_request("GET", f"/requests/{pending2}/status")
                    st = str(status_body.get("status") or "").lower()
                    if st in {"completed", "succeeded"} or st not in {
                        "failed",
                        "nsfw",
                        "canceled",
                        "cancelled",
                        "error",
                    }:
                        reuse = pending2
                except Exception:
                    reuse = pending2
            if reuse:
                entry = submit_and_download(clip, est, pending_job=reuse)
            else:
                entry = submit_and_download(clip, est, pending_job=None)
        log["clips"] = [c for c in log["clips"] if c.get("id") != clip["id"]] + [entry]
        log["pending"] = [p for p in (log.get("pending") or []) if p.get("id") != clip["id"]]
        write_logs(log)
        time.sleep(1)

    log["status"] = "MASTERS_READY"
    log["actual_cost_usd"] = round(sum(float(c.get("generation_cost_usd") or 0) for c in log["clips"]), 4)
    log["success_count"] = len(log["clips"])
    log["failed_count"] = max(0, len(CLIPS) - len(log["clips"]))
    write_logs(log)
    print(f"Masters ready. success={log['success_count']} failed={log['failed_count']} cost=${log['actual_cost_usd']}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
