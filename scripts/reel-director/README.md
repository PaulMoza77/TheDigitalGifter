# TDG Reel Director

Reusable production spine for vertical UGC reels. Not a product surface.

```
Character Bible → Story Beats → Shot Plan → Audio Plan → Generation Manifest
→ Cost Estimate → [APPROVAL] → Generation → Assembly → QA → Library
```

Rules:

- Image-to-video only from locked stills. Do not regenerate approved references.
- Never invent product UI in a video model. Composite real Planner captures.
- Video `sound=off`. Voices, SFX, music are separate tracks.
- Edit picture around human speech. Never speed speech to fit a clip.
- Do not require perfect lip-sync. Prefer off-camera, OTS, reaction, J/L-cuts.
- Audio-only and single-scene video regen must not require regenerating the reel.
- Paid video providers are called only after the production manifest `status` is `APPROVED`.

First production: `christmas_planner_mom_overwhelm_v2`.

```
python3 scripts/reel-director/validate.py \
  public/assets/christmas/christmas_planner_mom_overwhelm_v2/generation_manifest.json
```
