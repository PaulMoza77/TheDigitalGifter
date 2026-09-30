#!/usr/bin/env python3
"""Christmas Memories — Europe in the 1990s: 10 stills → 10×5s Kling shorts → ingest.

Batch ID: christmas-memories-europe-1990s-20260930
Campaign: christmas_memories_europe_1990s

Phases: estimate | images | videos | ingest | report | all
Reels: run assemble_christmas_memories_europe_1990s_reels.py after videos pass QC.

Resumable via public/assets/christmas/christmas-memories-europe-1990s/generation_manifest.json
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
IMAGE_MODEL = "recraft/v4.1/pro/text-to-image"
VIDEO_MODEL = "kling-video/v3.0/pro/image-to-video"
DURATION = 5
BATCH_ID = "christmas-memories-europe-1990s-20260930"
CAMPAIGN = "christmas_memories_europe_1990s"

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
BATCH = ROOT / "public/assets/christmas/christmas-memories-europe-1990s"
SOURCE = ROOT / "source/batch-christmas-memories-europe-1990s-sep30"
STILLS = ROOT / "public/assets/christmas/library-stills"
MASTERS = BATCH / "masters"
POSTERS = BATCH / "posters"
QC = BATCH / "qc"
MANIFEST = BATCH / "generation_manifest.json"
INGEST_JSON = STILLS / "ingest_cme1990s_sep30.json"

MAX_IMAGE_ATTEMPTS = 4

VISUAL_SUFFIX = (
    " Vertical 9:16 photorealistic cinematic photograph, 35mm film character, natural grain. "
    "Premium 1990s European Christmas — warm, nostalgic, emotional, cozy, authentic. "
    "Realistic human anatomy, hands, faces, skin, proportions. Immediate Christmas atmosphere. "
    "NOT illustration, cartoon, AI plastic skin, excessive bokeh, orange grading, fake snow overload, "
    "readable text, logos, watermarks, modern 2026 objects, smartphones, modern LED billboards."
)

NEGATIVE = (
    " Do not morph faces, buildings, vehicles, or text. No duplicated people, no extra limbs, "
    "no melting objects, no random text or logos. No wild camera spins or aggressive zoom. "
    "Subtle cinematic motion only. Preserve composition from the first frame."
)

SCENES = [
    {
        "num": 1,
        "id": "cme1990s_01_london",
        "still": "cme1990s_london_christmas_1994.jpg",
        "gen": "01_london_christmas_1994_1080x1920.png",
        "title": "Photo · London Christmas 1994",
        "scene": "london_1994",
        "image": (
            "Magical snowy Christmas evening in central London in 1994. Street-level cinematic view. "
            "Classic black London taxi passing slowly through a wet snowy street. Warm Christmas lights "
            "suspended above the street. Beautiful decorated shop windows. People in elegant 1990s winter "
            "coats carrying wrapped Christmas gifts. Light snowfall against the dark evening. Wet pavement "
            "reflecting warm golden Christmas lights. Small atmospheric mist. Strong depth, realistic lighting. "
            "No modern cars, no smartphones."
        ),
        "motion": (
            "Photoreal cinematic 9:16 London Christmas 1994 night. This exact photograph comes alive for five seconds. "
            "Preserve the black taxi, wet snowy street, Christmas lights, shop windows, pedestrians, and reflections "
            "exactly as framed. The taxi rolls forward slowly with natural wheel rotation. Gentle snowfall with depth. "
            "Christmas lights twinkle subtly. Pedestrians make tiny natural steps — no face morphing. Very slow street-level "
            "dolly. Wet pavement reflections slide naturally. Architecture stays rigid."
        ),
    },
    {
        "num": 2,
        "id": "cme1990s_02_paris_cafe",
        "still": "cme1990s_paris_cafe_christmas_1996.jpg",
        "gen": "02_paris_cafe_christmas_1996_1080x1920.png",
        "title": "Photo · Paris Christmas café 1996",
        "scene": "paris_cafe_1996",
        "image": (
            "Paris, December 1996. Exterior of an intimate Parisian café on a snowy Christmas evening. "
            "Warm amber light through windows, small decorated Christmas tree inside, traditional red café awning. "
            "Fresh snow on tables and pavement. A couple near the window drinking hot chocolate with wrapped gifts "
            "beside them, steam from drinks. Elegant Paris street architecture, subtle Christmas lights. "
            "Rich shadows, natural warm highlights, extremely photorealistic 35mm."
        ),
        "motion": (
            "Photoreal cinematic 9:16 Paris café Christmas 1996. This exact photograph comes alive for five seconds. "
            "Preserve the café awning, windows, couple, steam, gifts, snow, and street exactly as framed. "
            "Steam rises naturally from hot drinks. Sparse snowfall. Warm interior light flickers subtly through glass. "
            "The couple makes tiny natural movements — sipping, no face morph. Very slow gentle push-in. "
            "Awning and architecture stay rigid. Reflections in windows stay stable."
        ),
    },
    {
        "num": 3,
        "id": "cme1990s_03_alpine_chalet",
        "still": "cme1990s_alpine_chalet_1992.jpg",
        "gen": "03_alpine_chalet_1992_1080x1920.png",
        "title": "Photo · Alpine Christmas chalet 1992",
        "scene": "alpine_chalet_1992",
        "image": (
            "Swiss/Austrian Alps, Christmas Eve 1992. Beautiful wooden chalet in deep fresh snow. Warm yellow light "
            "from windows, large Christmas tree visible through a window. Smoke gently from chimney. Heavy snow-covered "
            "pines. Mountains through soft evening snowfall. Old European station wagon parked outside with snow on roof. "
            "Silence, warmth, family, nostalgia. Ultra realistic cinematic wide vertical composition."
        ),
        "motion": (
            "Photoreal cinematic 9:16 alpine chalet Christmas Eve 1992. This exact photograph comes alive for five seconds. "
            "Preserve the chalet, wagon, pines, mountains, and window glow exactly as framed. Smoke drifts gently from chimney. "
            "Soft snowfall with parallax. Window light flickers very subtly. Very slow cinematic push toward the chalet. "
            "No warped timber or melting snow. Station wagon stays parked — no impossible motion."
        ),
    },
    {
        "num": 4,
        "id": "cme1990s_04_christmas_morning",
        "still": "cme1990s_christmas_morning_1998.jpg",
        "gen": "04_christmas_morning_1998_1080x1920.png",
        "title": "Photo · Christmas morning 1998",
        "scene": "christmas_morning_1998",
        "image": (
            "European family home, Christmas morning 1998. View from slightly behind the Christmas tree toward a cozy living room. "
            "Natural Christmas tree, warm incandescent lights, wrapped presents, fireplace, soft winter daylight through window. "
            "Child in pajamas on the floor opening a present while parents watch naturally in background. "
            "Authentic late-1990s interior details. Premium cinematic composition, emotional unstaged family memory on film."
        ),
        "motion": (
            "Photoreal cinematic 9:16 Christmas morning 1998 interior. This exact photograph comes alive for five seconds. "
            "Preserve tree, child, parents, presents, fireplace, and window light exactly as framed. "
            "Child makes small natural movements opening a gift. Parents shift subtly. Tree lights twinkle softly. "
            "Fireplace embers glow. Daylight stays consistent. Very slow gentle push-in. No face morph or extra people."
        ),
    },
    {
        "num": 5,
        "id": "cme1990s_05_christmas_train",
        "still": "cme1990s_christmas_train_1993.jpg",
        "gen": "05_christmas_train_1993_1080x1920.png",
        "title": "Photo · Christmas train 1993",
        "scene": "christmas_train_1993",
        "image": (
            "European railway station during Christmas 1993. Old passenger train at a snowy platform at blue hour. "
            "Warm yellow light from carriage windows. Families with suitcases and wrapped gifts. Steam and cold breath in air. "
            "Christmas decorations at the historic station. Snow falling gently. One person looking through a train window. "
            "Premium European Christmas movie atmosphere, not fantasy."
        ),
        "motion": (
            "Photoreal cinematic 9:16 Christmas train station 1993 blue hour. This exact photograph comes alive for five seconds. "
            "Preserve locomotive, carriages, platform, travelers, station architecture, and window figure exactly as framed. "
            "Train eases forward slightly with believable wheel motion. Steam and breath drift. Sparse snowfall. "
            "Warm window light steady. Travelers make tiny steps. Very slow platform-level dolly. No warped train geometry."
        ),
    },
    {
        "num": 6,
        "id": "cme1990s_06_christmas_market",
        "still": "cme1990s_christmas_market_1995.jpg",
        "gen": "06_christmas_market_1995_1080x1920.png",
        "title": "Photo · Christmas market 1995",
        "scene": "christmas_market_1995",
        "image": (
            "Traditional European Christmas market, December 1995. Narrow historic town square, wooden stalls, "
            "warm incandescent Christmas lights, snow, people in authentic 1990s winter clothing, hot drinks, "
            "roasted chestnuts, handmade decorations, large natural Christmas tree in distance. "
            "Camera among the crowd, immersive warm/cold contrast, photoreal documentary cinematic photography."
        ),
        "motion": (
            "Photoreal cinematic 9:16 Christmas market 1995. This exact photograph comes alive for five seconds. "
            "Preserve stalls, tree, crowd, lights, and square exactly as framed. Gentle snowfall. Market lights shimmer. "
            "Crowd makes natural small movements — no duplicated faces. Steam from drinks. Very slow handheld-style drift "
            "through the market. Architecture and stall structures stay rigid."
        ),
    },
    {
        "num": 7,
        "id": "cme1990s_07_nyc_apartment",
        "still": "cme1990s_nyc_apartment_1997.jpg",
        "gen": "07_nyc_apartment_1997_1080x1920.png",
        "title": "Photo · NYC Christmas apartment 1997",
        "scene": "nyc_apartment_1997",
        "image": (
            "Manhattan apartment, Christmas Eve 1997. Through a slightly frosted window into an extremely cozy apartment. "
            "Natural Christmas tree, warm lamps, old CRT television subtly visible, wrapped gifts, snow falling outside "
            "over Manhattan buildings. Person near window holding a warm drink. No modern electronics. "
            "Premium 1990s Christmas film atmosphere, intimate and emotional."
        ),
        "motion": (
            "Photoreal cinematic 9:16 NYC apartment Christmas Eve 1997. This exact photograph comes alive for five seconds. "
            "Preserve window frost, interior tree, lamps, CRT TV silhouette, person, gifts, and skyline snow exactly as framed. "
            "Snow falls outside with depth. Person makes a tiny natural shift with mug steam rising. Interior lights flicker subtly. "
            "Very slow push through the window glass. No modern devices appear. No face morph."
        ),
    },
    {
        "num": 8,
        "id": "cme1990s_08_toy_shop",
        "still": "cme1990s_toy_shop_1994.jpg",
        "gen": "08_toy_shop_1994_1080x1920.png",
        "title": "Photo · Christmas toy shop 1994",
        "scene": "toy_shop_1994",
        "image": (
            "Beautiful European toy shop window at Christmas 1994, view from outside. Snow-covered pavement, warm golden interior, "
            "wooden toys, teddy bears, model train, wrapped presents behind glass, garlands and incandescent lights. "
            "Child in winter clothing outside looking through the glass. Natural reflection of Christmas street lights in window. "
            "Emotional nostalgic cinematic. Absolutely no readable text."
        ),
        "motion": (
            "Photoreal cinematic 9:16 toy shop window Christmas 1994. This exact photograph comes alive for five seconds. "
            "Preserve toys, train, child, window reflections, and street lights exactly as framed. "
            "Child makes a small natural shift looking at toys — no face morph. Sparse snowfall. Interior lights twinkle. "
            "Reflections slide subtly with micro camera movement. Very slow push-in. No text appears on glass."
        ),
    },
    {
        "num": 9,
        "id": "cme1990s_09_road_trip",
        "still": "cme1990s_road_trip_1996.jpg",
        "gen": "09_road_trip_1996_1080x1920.png",
        "title": "Photo · Christmas road trip 1996",
        "scene": "road_trip_1996",
        "image": (
            "Snowy European countryside at dusk, Christmas 1996. Classic 1990s European family car driving toward a small "
            "illuminated village. Christmas tree tied securely to roof. Snow-covered road and pine forest, warm village lights "
            "in distance, soft snowfall, blue winter twilight. Low camera slightly behind the car. "
            "Driving home for Christmas. Premium automotive cinematography, realistic tire and road interaction."
        ),
        "motion": (
            "Photoreal cinematic 9:16 Christmas road trip dusk 1996. This exact photograph comes alive for five seconds. "
            "Preserve the car, roof tree, road, forest, and village lights exactly as framed. Car moves forward naturally "
            "with believable wheel rotation and tire-snow interaction. Snowfall with parallax. Village lights steady. "
            "Very slow tracking from low rear angle. No impossible snow physics or warped car body."
        ),
    },
    {
        "num": 10,
        "id": "cme1990s_10_eve_window",
        "still": "cme1990s_christmas_eve_window_1995.jpg",
        "gen": "10_christmas_eve_window_1995_1080x1920.png",
        "title": "Photo · Christmas Eve window 1995",
        "scene": "christmas_eve_window_1995",
        "image": (
            "Intimate European Christmas Eve 1995. Outside a snow-covered house looking through a large window. Inside: family "
            "around a decorated Christmas tree, warm incandescent lighting, fireplace, wrapped gifts, dinner table partially visible. "
            "Outside: soft snow, dark blue winter night, snow on window ledge. Strong contrast cold exterior and warm interior. "
            "Hero frame believable as premium Christmas advertising photography."
        ),
        "motion": (
            "Photoreal cinematic 9:16 Christmas Eve window 1995. This exact photograph comes alive for five seconds. "
            "Preserve exterior snow, window frame, family, tree, fireplace, and interior warmth exactly as framed. "
            "Gentle snowfall outside. Family makes tiny natural movements inside — no face morph. Firelight flickers. "
            "Tree lights twinkle. Very slow push toward the window. Strong interior/exterior contrast maintained."
        ),
    },
]


def try_load_hf_from_mozas_vps() -> None:
    if (os.environ.get("HF_CREDENTIALS") or os.environ.get("HF_KEY") or "").strip():
        return
    loader = ROOT / "scripts" / "_load_hf_credentials.sh"
    if not loader.exists():
        return
    proc = subprocess.run(["bash", str(loader)], capture_output=True, text=True, check=False)
    val = (proc.stdout or "").strip()
    if val and ":" in val:
        os.environ["HF_CREDENTIALS"] = val


def try_load_openai_from_mozas_vps() -> None:
    if (os.environ.get("OPENAI_API_KEY") or "").strip():
        return
    if not (os.environ.get("MOZAS_SSH_HOST") and os.environ.get("MOZAS_SSH_PRIVATE_KEY")):
        return
    script = ROOT / "scripts" / "mozas-ssh.sh"
    if not script.exists():
        return
    proc = subprocess.run(
        ["bash", "-c", f'source "{script}" && mozas_prepare_ssh && mozas_ssh "grep ^OPENAI_API_KEY= /opt/mozas/projects/thedigitalgifter/secrets/app.env | cut -d= -f2-"'],
        capture_output=True,
        text=True,
        check=False,
        cwd=str(ROOT),
    )
    val = (proc.stdout or "").strip().strip('"').strip("'")
    if val.startswith("sk-"):
        os.environ["OPENAI_API_KEY"] = val


def read_credentials() -> tuple[str, str]:
    try_load_hf_from_mozas_vps()
    combined = (os.environ.get("HF_CREDENTIALS") or os.environ.get("HF_KEY") or "").strip()
    if ":" in combined:
        key_id, secret = combined.split(":", 1)
        if key_id.strip() and secret.strip():
            return key_id.strip(), secret.strip()
    raise SystemExit("BLOCKED: Higgsfield credentials missing.")


def auth_header() -> str:
    kid, sec = read_credentials()
    return f"Key {kid}:{sec}"


def hf_request(method: str, path: str, data: dict | None = None, timeout: int = 180) -> dict:
    url = path if path.startswith("http") else f"{HIGGSFIELD_API_BASE}{path}"
    body = None if data is None else json.dumps(data).encode()
    headers = {"Authorization": auth_header(), "Accept": "application/json", "User-Agent": "tdg-cme1990s/higgsfield"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {url} -> {e.code} {e.read().decode()[:500]}") from e


def poll_job(request_id: str, timeout_s: int = 1200) -> dict:
    start = time.time()
    while time.time() - start < timeout_s:
        cur = hf_request("GET", f"/requests/{request_id}/status")
        status = str(cur.get("status") or "")
        print(f"  poll {request_id} {status}", flush=True)
        if status.lower() in {"completed", "succeeded", "failed", "error", "cancelled", "canceled", "nsfw"}:
            return cur
        time.sleep(6)
    raise TimeoutError(request_id)


def image_url_from(body: dict) -> str | None:
    for img in body.get("images") or []:
        if isinstance(img, dict) and img.get("url"):
            return str(img["url"])
        if isinstance(img, str) and img.startswith("http"):
            return img
    if body.get("image_url"):
        return str(body["image_url"])
    return None


def video_url_from(body: dict) -> str | None:
    vid = body.get("video")
    if isinstance(vid, dict) and vid.get("url"):
        return str(vid["url"])
    if body.get("video_url"):
        return str(body["video_url"])
    return None


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-cme1990s/higgsfield"})
    with urllib.request.urlopen(req, timeout=180) as resp, dest.open("wb") as f:
        while True:
            chunk = resp.read(256 * 1024)
            if not chunk:
                break
            f.write(chunk)


def upload_image(path: Path) -> str:
    ctype = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    meta = hf_request("POST", "/files/generate-upload-url", {"content_type": ctype})
    upload_url, public_url = meta.get("upload_url"), meta.get("public_url")
    if not upload_url or not public_url:
        raise RuntimeError("upload url missing")
    headers = dict(meta.get("upload_headers") or {"Content-Type": ctype})
    req = urllib.request.Request(str(upload_url), data=path.read_bytes(), method="PUT", headers=headers)
    with urllib.request.urlopen(req, timeout=180) as resp:
        resp.read()
    return str(public_url)


def probe_image(path: Path) -> tuple[int, int]:
    raw = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", str(path)]
    )
    stream = (json.loads(raw).get("streams") or [{}])[0]
    return int(stream.get("width") or 0), int(stream.get("height") or 0)


def scale_to_1080x1920(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", str(src), "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", "-frames:v", "1", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def run_image_qc(image_path: Path, prompt: str) -> dict:
    try_load_openai_from_mozas_vps()
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        w, h = probe_image(image_path)
        ok = w >= 1000 and h >= 1700 and image_path.stat().st_size > 120_000
        return {"verdict": "PASS" if ok else "REGENERATE", "reason": "dimension_heuristic", "w": w, "h": h}
    import base64

    b64 = base64.b64encode(image_path.read_bytes()).decode()
    mime = "image/png" if image_path.suffix.lower() == ".png" else "image/jpeg"
    payload = {
        "model": "gpt-4o-mini",
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "Strict photoreal Christmas 1990s Europe QC. JSON { verdict: PASS|REGENERATE|REJECT, reason }. "
                    "REJECT broken hands, distorted faces, AI text, modern objects in 1990s scenes, plastic skin, "
                    "missing Christmas atmosphere, wrong aspect feel."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": f"Prompt:\n{prompt}\nEvaluate for publishable premium reel still."},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                ],
            },
        ],
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode())
    content = data["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    verdict = str(parsed.get("verdict") or "REGENERATE").upper()
    if verdict not in {"PASS", "REGENERATE", "REJECT"}:
        verdict = "REGENERATE"
    return {"verdict": verdict, "reason": parsed.get("reason", "")}


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {
        "batch_id": BATCH_ID,
        "campaign": CAMPAIGN,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "models": {"image": IMAGE_MODEL, "video": VIDEO_MODEL},
        "costs": {"image_usd": 0.0, "video_usd": 0.0, "total_usd": 0.0},
        "images": [],
        "clips": [],
        "status": "pending",
    }


def save_manifest(m: dict) -> None:
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(m, indent=2) + "\n")


def phase_estimate() -> None:
    read_credentials()
    img_est = hf_request("POST", f"/estimate/{IMAGE_MODEL}", {"prompt": "test", "aspect_ratio": "9:16"})
    print(f"IMAGE_ESTIMATE_USD={img_est.get('usd')} x10 ~= {float(img_est.get('usd',0))*10:.2f}")
    print(f"VIDEO_ESTIMATE_USD≈0.308 x10 ~= 3.08")


def phase_images(m: dict) -> None:
    for scene in SCENES:
        gen_path = SOURCE / scene["gen"]
        still_path = STILLS / scene["still"]
        prompt = scene["image"] + VISUAL_SUFFIX
        existing = next((r for r in m.get("images", []) if r.get("id") == scene["id"] and r.get("qc_verdict") == "PASS"), None)
        if existing and gen_path.exists() and still_path.exists():
            print(f"SKIP image {scene['id']} (qc pass)", flush=True)
            continue
        for attempt in range(1, MAX_IMAGE_ATTEMPTS + 1):
            print(f"IMAGE {scene['id']} attempt {attempt}", flush=True)
            est = hf_request("POST", f"/estimate/{IMAGE_MODEL}", {"prompt": prompt, "aspect_ratio": "9:16"})
            m["costs"]["image_usd"] += float(est.get("usd") or 0)
            sub = hf_request("POST", f"/{IMAGE_MODEL}", {"prompt": prompt, "aspect_ratio": "9:16"})
            req_id = str(sub.get("request_id") or "")
            if not req_id:
                raise RuntimeError(f"image submit failed {scene['id']}")
            done = poll_job(req_id)
            if str(done.get("status")).lower() not in {"completed", "succeeded"}:
                if attempt >= MAX_IMAGE_ATTEMPTS:
                    raise RuntimeError(f"image failed {scene['id']}")
                continue
            url = image_url_from(done)
            if not url:
                continue
            tmp = BATCH / "qc" / f"{scene['id']}_raw.jpg"
            download(url, tmp)
            scale_to_1080x1920(tmp, gen_path)
            if not still_path.exists():
                subprocess.check_call(["cp", "-f", str(gen_path), str(still_path)])
            qc = run_image_qc(gen_path, prompt)
            print(f"  QC {scene['id']} {qc}", flush=True)
            row = {
                "id": scene["id"],
                "scene": scene["scene"],
                "title": scene["title"],
                "still": str(still_path.relative_to(ROOT)),
                "generation_still": str(gen_path.relative_to(ROOT)),
                "image_prompt": prompt,
                "image_job_id": req_id,
                "image_cost_usd": float(est.get("usd") or 0),
                "qc_verdict": qc["verdict"],
                "qc_reason": qc.get("reason"),
                "attempt": attempt,
            }
            m["images"] = [r for r in m.get("images", []) if r.get("id") != scene["id"]] + [row]
            save_manifest(m)
            if qc["verdict"] == "PASS":
                poster = POSTERS / f"{scene['id']}.jpg"
                poster.parent.mkdir(parents=True, exist_ok=True)
                subprocess.check_call(["ffmpeg", "-y", "-i", str(gen_path), "-frames:v", "1", "-q:v", "3", str(poster)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                break
            if qc["verdict"] == "REJECT" and attempt >= MAX_IMAGE_ATTEMPTS:
                raise RuntimeError(f"image qc reject {scene['id']}: {qc.get('reason')}")
    passed = sum(1 for s in SCENES if any(r.get("id") == s["id"] and r.get("qc_verdict") == "PASS" for r in m.get("images", [])))
    if passed != len(SCENES):
        raise RuntimeError(f"images incomplete: {passed}/{len(SCENES)} pass")


def probe_video(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-show_entries",
            "format=duration,size",
            "-of",
            "json",
            str(path),
        ]
    )
    data = json.loads(raw)
    stream = (data.get("streams") or [{}])[0]
    fmt = data.get("format") or {}
    return {
        "duration": float(fmt.get("duration") or 0),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
    }


def phase_videos(m: dict) -> None:
    for scene in SCENES:
        gen_path = SOURCE / scene["gen"]
        dest = MASTERS / f"{scene['id']}.mp4"
        if dest.exists():
            pr = probe_video(dest)
            if 4.5 <= pr["duration"] <= 6.5 and pr["height"] >= 1800:
                print(f"SKIP video {scene['id']}", flush=True)
                continue
        img_row = next((r for r in m.get("images", []) if r.get("id") == scene["id"]), None)
        if not img_row or img_row.get("qc_verdict") != "PASS":
            raise RuntimeError(f"missing approved image for {scene['id']}")
        if not gen_path.exists():
            raise RuntimeError(f"missing gen still {gen_path}")
        motion = scene["motion"] + NEGATIVE
        public = upload_image(gen_path)
        est = hf_request(
            "POST",
            f"/estimate/{VIDEO_MODEL}",
            {"image_url": public, "prompt": motion, "duration": DURATION, "sound": "off"},
        )
        m["costs"]["video_usd"] += float(est.get("usd") or 0)
        sub = hf_request(
            "POST",
            f"/{VIDEO_MODEL}",
            {"image_url": public, "prompt": motion, "duration": DURATION, "sound": "off"},
        )
        req_id = str(sub.get("request_id") or "")
        done = poll_job(req_id, timeout_s=1800)
        if str(done.get("status")).lower() not in {"completed", "succeeded"}:
            raise RuntimeError(f"video failed {scene['id']}")
        vurl = video_url_from(done)
        if not vurl:
            raise RuntimeError(f"video url missing {scene['id']}")
        download(vurl, dest)
        pr = probe_video(dest)
        if pr["duration"] < 4.5 or pr["size"] < 200_000:
            raise RuntimeError(f"clip qc fail {scene['id']} {pr}")
        poster = POSTERS / f"{scene['id']}.jpg"
        subprocess.check_call(["ffmpeg", "-y", "-ss", "0.4", "-i", str(dest), "-frames:v", "1", "-q:v", "3", str(poster)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        row = {
            "id": scene["id"],
            "file": str(dest.relative_to(ROOT)),
            "source_still": scene["still"],
            "video_job_id": req_id,
            "video_cost_usd": float(est.get("usd") or 0),
            "probe": pr,
            "motion_prompt": motion,
        }
        m["clips"] = [r for r in m.get("clips", []) if r.get("id") != scene["id"]] + [row]
        m["costs"]["total_usd"] = m["costs"]["image_usd"] + m["costs"]["video_usd"]
        save_manifest(m)
        print(f"CLIP OK {scene['id']} {pr['duration']:.2f}s", flush=True)


def phase_ingest(m: dict) -> None:
    TAGS = ["christmas", "reel-source", "cinematic", "viral", "recognizable-scene", "AI-generated", "europe-1990s", "nostalgia"]
    assets = []
    for scene in SCENES:
        img = next((r for r in m.get("images", []) if r.get("id") == scene["id"]), None)
        if not img:
            continue
        w, h = probe_image(ROOT / img["generation_still"])
        assets.append(
            {
                "id": f"photo-{scene['id'].replace('_', '-')}",
                "title": scene["title"],
                "description": scene["image"][:240],
                "tags": TAGS + [CAMPAIGN, scene["scene"]],
                "original": img["still"],
                "generation_still": img["generation_still"],
                "output_wh": [w, h],
                "campaign": CAMPAIGN,
                "batch_id": BATCH_ID,
                "image_model": IMAGE_MODEL,
                "image_job_id": img.get("image_job_id"),
                "qc_status": img.get("qc_verdict"),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    INGEST_JSON.write_text(json.dumps({"status": "INGESTED", "batch_id": BATCH_ID, "campaign": CAMPAIGN, "count": len(assets), "assets": assets}, indent=2) + "\n")
    m["ingest_json"] = str(INGEST_JSON.relative_to(ROOT))
    m["status"] = "clips_ready"
    save_manifest(m)
    print(f"INGEST JSON {len(assets)} photos", flush=True)


def main() -> int:
    phase = sys.argv[1] if len(sys.argv) > 1 else "all"
    m = load_manifest()
    if phase in {"estimate", "all"}:
        phase_estimate()
    if phase in {"images", "all"}:
        phase_images(m)
        m = load_manifest()
    if phase in {"videos", "all"}:
        phase_videos(m)
        m = load_manifest()
    if phase in {"ingest", "all"}:
        phase_ingest(m)
    if phase in {"report", "all"}:
        m = load_manifest()
        print(json.dumps({"batch_id": BATCH_ID, "costs": m.get("costs"), "images": len(m.get("images", [])), "clips": len(m.get("clips", []))}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
