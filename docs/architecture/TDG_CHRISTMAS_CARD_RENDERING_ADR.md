# ADR: Christmas Card Rendering

## Status

Accepted — V1 (`tdg-christmas-cards-messages-011`)

## Context

Personalized Christmas Cards must produce **actual downloadable image files**, work without paid AI image APIs, support EN/RO Unicode (diacritics), optional photos, and three social layouts — without activating Christmas checkout.

## Decision

**Client-side Canvas 2D composition → PNG blob.**

1. Semantic card config (`style_key`, `layout_key`, message, optional photo, optional names)
2. Deterministic renderer in `src/features/christmas/cards/cardRenderer.ts`
3. Linear gradient styles from centralized `CARD_STYLES` registry (no Replicate decorative generation)
4. Adaptive font sizing + measured line wrapping with safe margins
5. Message sanitized as plain text; never interpreted as HTML
6. `canvas.toBlob('image/png')` for download + Web Share files
7. Server (`christmas_card_projects` / `christmas_card_assets`) persists metadata, ownership, and counters — not a public CDN of private photos in V1

## Alternatives considered

| Option | Why not |
|--------|---------|
| HTML → html2canvas | Extra dependency; CSS/font drift; XSS surface |
| Server SVG→PNG | Needs sharp/canvas on edge; slower iteration |
| Replicate decorative generation | Cost + latency; unnecessary for frames/backgrounds |
| HTML preview only | Fails DoD (must export real asset) |

## Consequences

- **render_cost = $0** local composition
- Visual fidelity depends on client fonts (Georgia/serif stack)
- Safari/WebKit may lack `navigator.canShare({ files })` → download fallback
- Message Generator LLM remains separate; OpenAI quota → curated templates is expected and not a card-render blocker

## Related

- Product docs: `docs/TDG_CHRISTMAS_CARDS_MESSAGES.md`
- Styles/layouts: `src/features/christmas/cards/cardStyles.ts`
- Edge funnel: `supabase/functions/christmas-cards-messages-funnel`
