# TDG Reel Director

Reusable spine for vertical UGC reels. Not a product surface.

```
Character Bible → Story Beats → Shot Plan → Audio Plan → Manifest → Cost
→ [APPROVAL] → Audio + audition → Measure speech → Video → Assembly → QA → Library
```

Paid submit is only:

```
python3 scripts/reel-director/generate.py --execute
```

and only if the manifest is `APPROVED`, voices were auditioned, speech was measured, and live estimate is under the cap.

No-cost checks:

```
python3 scripts/reel-director/generate.py --dry-run
python3 scripts/reel-director/generate.py --estimate-only
```

`--estimate-only` calls Higgsfield `/estimate` (not Kling submit). `--dry-run` uses no network.
