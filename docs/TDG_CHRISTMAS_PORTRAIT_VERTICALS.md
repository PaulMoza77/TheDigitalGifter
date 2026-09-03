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

## Non-goals (unchanged)

Kids, Santa Video, Tree, Advent, Wishlist, Gift Finder, Cards, Messages, live pricing, full SEO factory, Pet V1/V2/V3 price changes.
