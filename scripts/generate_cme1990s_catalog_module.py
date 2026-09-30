#!/usr/bin/env python3
"""Emit src/features/admin-library/christmasMemoriesEurope1990sCatalog.ts from batch manifest."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path("/workspace")
MANIFEST = ROOT / "public/assets/christmas/christmas-memories-europe-1990s/generation_manifest.json"
OUT = ROOT / "src/features/admin-library/christmasMemoriesEurope1990sCatalog.ts"
BATCH_ID = "christmas-memories-europe-1990s-20260930"

SCENE_TITLES = {
    "cme1990s_01_london": "London Christmas 1994",
    "cme1990s_02_paris_cafe": "Paris Christmas café 1996",
    "cme1990s_03_alpine_chalet": "Alpine chalet 1992",
    "cme1990s_04_christmas_morning": "Christmas morning 1998",
    "cme1990s_05_christmas_train": "Christmas train 1993",
    "cme1990s_06_christmas_market": "Christmas market 1995",
    "cme1990s_07_nyc_apartment": "NYC apartment 1997",
    "cme1990s_08_toy_shop": "Toy shop 1994",
    "cme1990s_09_road_trip": "Road trip 1996",
    "cme1990s_10_eve_window": "Christmas Eve window 1995",
}


def ts_string(s: str) -> str:
    return json.dumps(s)


def public_src(rel: str) -> str:
    p = rel.replace("\\", "/").lstrip("/")
    if p.startswith("public/"):
        p = p[len("public/") :]
    return "/" + p


def main() -> int:
    m = json.loads(MANIFEST.read_text())
    lines = [
        'import type { LibraryVideo } from "./catalog";',
        "",
        "const CME1990S_TAGS = [",
        '  "christmas",',
        '  "reel-source",',
        '  "cinematic",',
        '  "viral",',
        '  "AI-generated",',
        '  "europe-1990s",',
        '  "nostalgia",',
        '  "christmas-memories",',
        '  "silent",',
        "] as const;",
        "",
        f"export const CME1990S_PRODUCTION_ID = {ts_string(BATCH_ID)};",
        "",
        "export const CHRISTMAS_MEMORIES_EUROPE_1990S_REELS: LibraryVideo[] = [",
    ]
    for reel in m.get("reels") or []:
        pr = reel.get("probe") or {}
        lines.extend(
            [
                "  {",
                f"    id: {ts_string(reel['id'])},",
                f"    title: {ts_string(reel['title'])},",
                f"    description: {ts_string('Silent 1080x1920 Reel · ' + reel['title'] + '. Campaign christmas_memories_europe_1990s.')},",
                f"    src: {ts_string(public_src(reel['file']))},",
                f"    filename: {ts_string(Path(reel['file']).name)},",
                '    category: "christmas_reels",',
                '    kind: "reel",',
                f"    durationSeconds: {round(float(pr.get('duration') or 0), 2)},",
                f"    poster: {ts_string('/assets/christmas/christmas-memories-europe-1990s/posters/' + reel['id'] + '.jpg')},",
                f"    width: {int(pr.get('width') or 1080)},",
                f"    height: {int(pr.get('height') or 1920)},",
                f"    fileSizeBytes: {int(pr.get('size') or 0)},",
                '    tags: [...CME1990S_TAGS, "ready-to-post", "reel"],',
                '    model: "kling-video/v3.0/pro/image-to-video",',
                f"    productionId: {ts_string(BATCH_ID)},",
                f"    clipsUsed: {json.dumps(reel.get('clips_used') or [])},",
                "  },",
            ]
        )
    lines.append("];")
    lines.append("")
    lines.append("export const CHRISTMAS_MEMORIES_EUROPE_1990S_SHORTS: LibraryVideo[] = [")
    for clip in m.get("clips") or []:
        cid = clip["id"]
        pr = clip.get("probe") or {}
        title = SCENE_TITLES.get(cid, cid)
        lines.extend(
            [
                "  {",
                f"    id: {ts_string('short-' + cid.replace('_', '-'))},",
                f"    title: {ts_string('Short · ' + title)},",
                f"    description: {ts_string('Higgsfield Kling 3.0 Pro I2V, 5s, silent. ' + title + '.')},",
                f"    src: {ts_string(public_src(clip['file']))},",
                f"    filename: {ts_string(Path(clip['file']).name)},",
                '    category: "christmas_reels",',
                '    kind: "short",',
                f"    durationSeconds: {round(float(pr.get('duration') or 5), 2)},",
                f"    poster: {ts_string('/assets/christmas/christmas-memories-europe-1990s/posters/' + cid + '.jpg')},",
                f"    width: {int(pr.get('width') or 1080)},",
                f"    height: {int(pr.get('height') or 1920)},",
                f"    fileSizeBytes: {int(pr.get('size') or 0)},",
                "    tags: [...CME1990S_TAGS, \"reel-source\"],",
                '    model: "kling-video/v3.0/pro/image-to-video",',
                f"    sourceImage: {ts_string(clip.get('source_still', ''))},",
                f"    jobId: {ts_string(str(clip.get('video_job_id') or ''))},",
                f"    costUsd: {round(float(clip.get('video_cost_usd') or 0), 2)},",
                f"    productionId: {ts_string(BATCH_ID)},",
                "  },",
            ]
        )
    lines.append("];")
    lines.append("")
    lines.append("export const CHRISTMAS_MEMORIES_EUROPE_1990S_PHOTOS: LibraryVideo[] = [")
    for img in m.get("images") or []:
        if img.get("qc_verdict") != "PASS":
            continue
        cid = img["id"]
        title = SCENE_TITLES.get(cid, cid)
        still = img.get("still", "")
        lines.extend(
            [
                "  {",
                f"    id: {ts_string('photo-' + cid.replace('_', '-'))},",
                f"    title: {ts_string(img.get('title') or ('Photo · ' + title))},",
                f"    description: {ts_string(title + ' · premium 1990s European Christmas still.')},",
                f"    src: {ts_string(public_src(still))},",
                f"    filename: {ts_string(Path(still).name)},",
                '    category: "christmas_reels",',
                '    kind: "photo",',
                "    tags: [...CME1990S_TAGS],",
                '    model: "recraft/v4.1/pro/text-to-image",',
                f"    jobId: {ts_string(str(img.get('image_job_id') or ''))},",
                f"    costUsd: {round(float(img.get('image_cost_usd') or 0), 2)},",
                f"    productionId: {ts_string(BATCH_ID)},",
                "  },",
            ]
        )
    lines.append("];")
    lines.append("")
    OUT.write_text("\n".join(lines) + "\n")
    print(f"Wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
