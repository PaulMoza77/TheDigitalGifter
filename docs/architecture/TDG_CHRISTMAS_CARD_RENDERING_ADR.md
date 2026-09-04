# Christmas Card Rendering ADR

**Task:** `tdg-christmas-cards-messages-011`  
**Status:** Accepted for V1

## Decision

Use **client-side Canvas 2D** composition to produce a real **PNG** blob (`toBlob("image/png")`).

Flow:

1. Semantic card config (style key, layout key, message, optional photo, optional to/from)
2. Deterministic template fill (gradient + accent frame + optional photo cover crop + text panel)
3. Adaptive font sizing + line wrapping with safe margins
4. Download / Web Share file API (download fallback)

## Why not alternatives

| Option | Why not for V1 |
|--------|----------------|
| html2canvas / DOM screenshot | Extra dependency; CSS/layout drift; harder diacritic/font control |
| SVG → raster server-side | Needs Edge/Deno canvas or external service; more ops cost |
| Replicate / AI borders | Unnecessary spend; decorative styles are CSS/canvas templates |
| HTML-only “preview as card” | Does not meet “actual image file” DoD |

## Cost

`render_cost = $0` local composition. No AI provider for styles/layouts.

## Privacy

- Source photos are optional and processed in-browser for V1 render
- Project metadata persisted via `christmas_card_projects` with hashed guest owner token
- Rendered assets metadata in `christmas_card_assets` (dimensions/bytes); no public gallery
- Download filenames: `tdg-christmas-card-<project-ref>-<layout>.png` (no recipient names)

## Layouts

- square: 1080×1080
- story: 1080×1920
- landscape: 1600×900

## Styles

Central registry keys: `classic_christmas`, `elegant_gold`, `cozy_christmas`, `winter_wonderland`, `minimal_christmas`, `vintage_christmas`, `playful_christmas`, `romantic_christmas`.

## Text

Plain text only after sanitize/escape. User message never interpreted as HTML.
