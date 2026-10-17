# Christmas V2 manual quality-review protocol

Automated tests cover technical media validation only (MIME/magic bytes, MP4 `ftyp`, size limits, private storage). **Visual quality is never claimed PASS from synthetic/mock images.**

## When to run

After an authorized Higgsfield canary (or staging paid batch), for each delivered asset.

## Image checklist (Soul v2)

| Check | Pass criteria |
|-------|----------------|
| Identity | Same recognizable person as upload; age/ethnicity/hair preserved |
| Face | No collapse, melting, extra features |
| Hands | Acceptable or minor artifacts only |
| Children / pets | Extra scrutiny; reject identity drift |
| Scene fidelity | Matches ordered scene prompt (tree, snow, fireplace, …) |
| Seasonal realism | Coherent Christmas lighting/props; not garbled |
| Technical | Valid JPEG/PNG/WebP, private bucket, signed download |

## Video checklist (Kling 3 Pro, 5s, sound off)

| Check | Pass criteria |
|-------|----------------|
| Source mapping | Motion derived from the correct Soul still (`source_scene_key`) |
| Identity lock | Face stable across frames |
| Motion | Subtle; no morph/aggressive camera |
| Audio | Silent / no unexpected audio (product: sound off) |
| Technical | Valid MP4 structure, duration ~5s, private storage |

## Scoring

- **Ship**: all critical identity checks pass; minor artifacts OK  
- **Hold**: identity risk or wrong scene mapping  
- **Reject / regenerate**: only via explicit operator action with new attempt budget — never silent auto re-submit of uncertain outcomes
