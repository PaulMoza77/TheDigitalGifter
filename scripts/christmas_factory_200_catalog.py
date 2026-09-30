#!/usr/bin/env python3
"""Emit Library catalog entries for completed factory-200 clips only."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path("/workspace")
MANIFEST = ROOT / "generated/christmas-factory-200/generation_manifest.json"
OUT = ROOT / "src/features/admin-library/christmasFactory200Catalog.ts"
BATCH = "christmas-factory-200-alive-20260930"


def main() -> int:
    if not MANIFEST.exists():
        print("no manifest")
        return 1
    m = json.loads(MANIFEST.read_text())
    ready = [c for c in m.get("clips") or [] if c.get("status") == "video_ready"]
    lines = [
        'import type { LibraryVideo } from "./catalog";',
        "",
        "const CF200_TAGS = [",
        '  "christmas",',
        '  "christmas-factory-200",',
        '  "alive",',
        '  "reel-source",',
        '  "kling-3-pro",',
        '  "silent",',
        '  "AI-generated",',
        "] as const;",
        "",
        f"export const CF200_PRODUCTION_ID = {json.dumps(BATCH)};",
        "",
        "export const CHRISTMAS_FACTORY_200_SHORTS: LibraryVideo[] = [",
    ]
    for c in ready:
        cid = c["id"]
        lines.extend(
            [
                "  {",
                f"    id: {json.dumps('short-' + cid.replace('_', '-'))},",
                f"    title: {json.dumps('Factory · ' + c.get('title', cid))},",
                f"    description: {json.dumps('Kling 3.0 Pro 5s silent. ' + c.get('happening', '')[:180])},",
                f"    src: {json.dumps('/assets/christmas/christmas-factory-200/masters/' + cid + '.mp4')},",
                f"    filename: {json.dumps(cid + '.mp4')},",
                '    category: "christmas_reels",',
                '    kind: "short",',
                "    durationSeconds: 5.04,",
                f"    poster: {json.dumps('/assets/christmas/christmas-factory-200/posters/' + cid + '.jpg')},",
                "    width: 1080,",
                "    height: 1920,",
                "    tags: [...CF200_TAGS, " + json.dumps(c.get("bucket", "joy")) + "],",
                '    model: "kling-video/v3.0/pro/image-to-video",',
                f"    jobId: {json.dumps(str(c.get('video_job_id') or ''))},",
                f"    costUsd: {round(float(c.get('video_cost_usd') or 0), 3)},",
                f"    productionId: {json.dumps(BATCH)},",
                "  },",
            ]
        )
    lines.append("];")
    lines.append("")
    OUT.write_text("\n".join(lines) + "\n")
    print(f"wrote {len(ready)} shorts -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
