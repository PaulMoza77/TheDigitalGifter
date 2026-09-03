# TDG Christmas Portrait Verticals

**Task:** `tdg-christmas-portrait-verticals-004`  
**Status:** architecture + routes live; production checkout remains **disabled**.

## Decision: product mapping

| Route | Commerce product | Species metadata |
|-------|------------------|------------------|
| `/christmas/photo-generator` | `christmas_photo` | — |
| `/christmas/family` | `christmas_family` | — |
| `/christmas/couples` | `christmas_couple` | — |
| `/christmas/pets` | `christmas_pet` | optional / any |
| `/christmas/dogs` | `christmas_pet` | `dog` |
| `/christmas/cats` | `christmas_pet` | `cat` |

**Option B chosen:** one commerce product `christmas_pet` with species metadata; separate dog/cat acquisition routes for analytics and validation. No `christmas_dog` / `christmas_cat` SKUs.

## Architecture

```
ChristmasPortraitFunnelPage  (shared UI)
  + ChristmasPortraitVertical config (route, copy, styles, species)
  → christmas-photo-funnel / christmas-checkout / christmas-photo-generate
  → server prompt registry (_shared/christmas/portraitPromptRegistry.ts)
```

- **No five copied funnels.** All six routes (incl. generic photo) use one page driven by `portraitVerticals.ts`.
- **Server-owned prompts.** Browser never submits prompt text. Unknown product+style → rejected.
- **Preview:** local canvas blur of the original (`photoPreview.ts`) — **0 Replicate generation** before payment.
- **Species check (dogs/cats):** reuses `_shared/pet/speciesValidate.ts` via funnel `validateSpecies`. Wrong species offers route switch (not a dead end). Vision classification may use Moondream/OpenAI; that is not image generation.

## Styles

- Photo: 8 styles (`styles.ts`)
- Family: 8 styles (`portraitStyles.ts` / `CHRISTMAS_FAMILY_STYLES`)
- Couple: 8 styles (`CHRISTMAS_COUPLE_STYLES`)
- Pet: 8 styles (`CHRISTMAS_PET_STYLES`) — dog/cat share catalog; prompts append species when known

## Order metadata

Columns (migration `20260903010000_christmas_portrait_verticals.sql`):

- `portrait_type` — person | family | couple | pet
- `species` — dog | cat | null
- `source_route` — acquisition path

Packages for family/couple/pet seeded with **`purchasable=false`**, **`price_cents=0`**. No price invented.

## Validation notes

- **Family:** multi-subject uploads allowed structurally. No pre-pay face-counting AI (cost/latency). Prompt strategy asks model to preserve headcount; known limitation: Flux may still drop/merge people.
- **Couple V1:** one photo with both people. No multi-photo identity composition.
- **Pet:** species validation on dog/cat routes when vision providers are configured.

## Admin

`/admin/christmas-orders` filters by Photo / Family / Couple / Pet and Dog/Cat species; detail shows portrait type, species, style, model, estimated AI cost.

## Hub

`/christmas` lists Portrait, Family, Couples, Pet, Santa Video (soon), Tree (soon), Gift Finder (soon). Experiences are navigable; copy states purchase is not enabled.

## SEO basics

Each vertical sets unique `PageHead` title, description, canonical, OG via existing SPA head manager. **Limitation:** client-updated tags are not fully SSR/indexable HTML.

## Privacy

Source + generated buckets remain private. No public galleries. Kids Christmas is out of scope.

## Email / recovery

Same Resend template; recovery link uses `source_route` / product+species mapping so the correct vertical reopens.

## Real generation QA (controlled proofs)

| Vertical | Order id | Style | Latency | Cost (est.) | QA |
|----------|----------|-------|---------|-------------|-----|
| Family | `38c43935-11b2-4c39-87cc-cc288b1cce19` | classic_family_christmas | 11207 ms | ~$0.04 | PASS — multi-person festive portrait |
| Couple | `9d02ca2b-2d29-4365-a6fa-613540ad5f36` | couple_classic_portrait | 11378 ms | ~$0.04 | PASS — both people preserved (first romantic_snowfall attempt timed out as `prediction_processing`, retry OK) |
| Dog | `d6cbf2ec-33f1-4fca-8b55-cd3f7569ffe8` | santa_pet | 11391 ms | ~$0.04 | PASS — dog species preserved |
| Cat | `0c0791fe-7e9e-4371-afb1-9e8f0afb675f` | pet_cozy_christmas | 11508 ms | ~$0.04 | PASS — cat species preserved |

Provider: Replicate · Model: `black-forest-labs/flux-kontext-pro` · `mock:false`

Wrong-species (no generation): dog→cat route and cat→dog route both return `wrong_species` + switch path via `validateSpecies`.

## Non-goals (unchanged)

Kids, Santa Video, Tree, Advent, Wishlist, Gift Finder, Cards, Messages, live pricing, full SEO factory, Pet V1/V2/V3 price changes.
