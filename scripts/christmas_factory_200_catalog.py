#!/usr/bin/env python3
"""Emit Library catalog entries for completed factory-200 clips and their source stills."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path("/workspace")
MANIFEST = ROOT / "generated/christmas-factory-200/generation_manifest.json"
OUT = ROOT / "src/features/admin-library/christmasFactory200Catalog.ts"
BATCH = "christmas-factory-200-alive-20260930"


def ts_str(value: str) -> str:
    return json.dumps(value)


def main() -> int:
    if not MANIFEST.exists():
        print("no manifest")
        return 1
    m = json.loads(MANIFEST.read_text())
    ready = [
        c
        for c in m.get("clips") or []
        if c.get("status") == "video_ready" and (ROOT / c.get("master", "")).exists()
    ]
    stills = [
        c
        for c in m.get("clips") or []
        if (ROOT / c.get("still", "")).exists() and (ROOT / c["still"]).stat().st_size >= 80_000
    ]
    lines = [
        'import type { LibraryVideo } from "./catalog";',
        "",
        "const CF200_TAGS = [",
        '  "christmas",',
        '  "christmas-factory-200",',
        '  "alive",',
        '  "raw-master",',
        '  "kling-3-pro",',
        '  "silent",',
        '  "AI-generated",',
        "] as const;",
        "",
        f"export const CF200_PRODUCTION_ID = {ts_str(BATCH)};",
        "",
        "export const CHRISTMAS_FACTORY_200_SHORTS: LibraryVideo[] = [",
    ]
    for c in ready:
        cid = c["id"]
        bucket = c.get("bucket") or "joy"
        duration = float(c.get("duration_seconds") or 5.04)
        lines.extend(
            [
                "  {",
                f"    id: {ts_str('short-' + cid.replace('_', '-'))},",
                f"    title: {ts_str('Factory · ' + c.get('title', cid))},",
                f"    description: {ts_str('Kling 3.0 Pro 5s silent RAW master. ' + (c.get('happening') or '')[:220])},",
                f"    src: {ts_str('/assets/christmas/christmas-factory-200/masters/' + cid + '.mp4')},",
                f"    filename: {ts_str(cid + '.mp4')},",
                '    category: "christmas_reels",',
                '    kind: "short",',
                f"    durationSeconds: {round(duration, 2)},",
                f"    poster: {ts_str('/assets/christmas/christmas-factory-200/posters/' + cid + '.jpg')},",
                "    width: 1080,",
                "    height: 1920,",
                "    tags: [...CF200_TAGS, " + ts_str(bucket) + ', "reel-source"],',
                '    model: "kling-video/v3.0/pro/image-to-video",',
                f"    jobId: {ts_str(str(c.get('video_job_id') or ''))},",
                f"    costUsd: {round(float(c.get('video_cost_usd') or 0) + float(c.get('image_cost_usd') or 0), 3)},",
                f"    sourceImage: {ts_str('/assets/christmas/christmas-factory-200/stills/' + cid + '.jpg')},",
                f"    productionId: {ts_str(BATCH)},",
                "  },",
            ]
        )
    lines.append("];")
    lines.append("")
    lines.append("export const CHRISTMAS_FACTORY_200_PHOTOS: LibraryVideo[] = [")
    for c in stills:
        cid = c["id"]
        bucket = c.get("bucket") or "joy"
        has_master = c.get("status") == "video_ready"
        lines.extend(
            [
                "  {",
                f"    id: {ts_str('photo-' + cid.replace('_', '-'))},",
                f"    title: {ts_str('Still · ' + c.get('title', cid))},",
                f"    description: {ts_str('Recraft v4.1 Pro source still for ' + cid + '. ' + (c.get('happening') or '')[:180])},",
                f"    src: {ts_str('/assets/christmas/christmas-factory-200/stills/' + cid + '.jpg')},",
                f"    filename: {ts_str(cid + '.jpg')},",
                '    category: "christmas_reels",',
                '    kind: "photo",',
                "    width: 1080,",
                "    height: 1920,",
                "    tags: [...CF200_TAGS, " + ts_str(bucket) + (", \"has-video\"]" if has_master else ", \"source-only\"]") + ",",
                '    model: "recraft/v4.1/pro/text-to-image",',
                f"    jobId: {ts_str(str(c.get('image_job_id') or ''))},",
                f"    costUsd: {round(float(c.get('image_cost_usd') or 0), 3)},",
                f"    productionId: {ts_str(BATCH)},",
                "  },",
            ]
        )
    lines.append("];")
    lines.append("")
    OUT.write_text("\n".join(lines) + "\n")
    print(f"wrote {len(ready)} shorts + {len(stills)} photos -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
