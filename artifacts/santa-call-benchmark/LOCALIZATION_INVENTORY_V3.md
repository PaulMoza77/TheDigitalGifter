# Santa Call Funnel V3 — Localization Inventory

Architecture: `SANTA_CALL_COPY` in `santaCallTypes.ts` (RO/EN). No competing i18n system.
Market/currency: `santaCallPricing.ts` (client + edge mirror). Spoken language auto-detect stays separate from UI language and market.

| Surface | Source | RO | EN | Notes |
|---|---|---|---|---|
| Public landing `/christmas/santa-call` | `SANTA_CALL_COPY` + switcher | ✓ | ✓ | Gated until `VITE_SANTA_CALL_LANDING_PUBLIC` or `?preview=<token≥16>`; bare `?preview=1` is rejected |
| Language switcher | landing header | ✓ | ✓ | Persisted via `?lang=` |
| Market/currency switcher | landing header | RON / USD | RON / USD | Persisted via `?market=` + localStorage; locked after checkout start |
| Hero / CTA / sticky CTA | copy | ✓ | ✓ | Approved copy |
| How it works / special / preview / visual / pricing | copy | ✓ | ✓ | |
| Parent onboarding form | copy | ✓ | ✓ | Child name never translated |
| Consent / AI disclosure | copy | ✓ | ✓ | |
| FAQ | copy | ✓ | ✓ | Explicit AI + browser-call FAQ |
| Checkout initiation | Stripe Custom + copy errors | ✓ | ✓ | Amount/currency from market map |
| Payment pending / success / failure / cancel | landing + Stripe hosted | ✓ | ✓ | Success note bilingual; Stripe UI follows locale |
| Transactional email | `santaCallEmail.ts` | ✓ | ✓ | Amount + currency; call link includes `?lang=` |
| Private call page | `SANTA_CALL_COPY` + `STATUS_LABEL` | ✓ | ✓ | Language from profile; URL `lang` hint |
| Mic permission / connecting / listening / speaking | copy + STATUS_LABEL | ✓ | ✓ | |
| Countdown / completion / thank-you | copy | ✓ | ✓ | |
| Extension modal + payment | copy + server market inherit | ✓ | ✓ | Currency locked to parent order market |
| Resume flow | server RPC | n/a | n/a | Language stored on entitlement |
| Error / retry | copy codes | ✓ | ✓ | |
| SEO / OG | `christmasSeoCore` + RO `i18n/seo/ro` + PageHead | ✓ | ✓ | `noindex` until launch |
| Hreflang | localeRouting product gate | en, ro only | en, ro only | No DE/FR/… until supported |

## Continuity rules
- UI language: form `language` → order `locale` → email → call profile → room UI.
- Market: explicit selector → order metadata `santa_call_market` → Stripe session → extension inherits parent.
- Spoken language: realtime auto-detect; parent fallback only; never drives market.
- Child name: stored/spoken as entered; never localized.
