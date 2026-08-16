# Unit economics — €4.99 still image

**Date:** 2026-08-15  
**SKU:** `still_image_single`  
**List price:** €4.99 (`productModel.amountCents = 499`)  
**Included regenerations:** 1  
**Max generation attempts:** 3  
**Recommendation:** **Keep €4.99** for launch, with VAT and regen mix watched. Target ≥70% contribution margin is realistic on successful deliveries.

No live Stripe or Replicate invoices were available. Figures below are **modeled**, not measured. Sources are named. Do not treat this as a live P&L.

## Revenue treatment

Consumer digital goods in the EU are usually sold **VAT-inclusive**. This model assumes the customer pays €4.99 gross and VAT is remitted from that amount. If checkout is later configured as VAT-exclusive, customer-facing price rises and margin improves.

| VAT rate | Net of VAT | VAT amount |
| --- | ---: | ---: |
| 19% (DE example) | €4.193 | €0.797 |
| 21% (NL / common OSS) | €4.124 | €0.866 |
| 23% (higher OSS) | €4.057 | €0.933 |

OSS actual rate follows customer country. Use 19–23% as the planning band.

## Variable costs per successful order

### Stripe (test mode would be €0; live EEA cards)

Standard Stripe EEA online card: **1.5% + €0.25** on the charged amount (€4.99).

`0.015 × 4.99 + 0.25 = €0.325`

Non-EEA / AMEX is higher (not modeled as the default mix). Refunds often **do not return** the Stripe fee.

### Replicate

`productModel.estimatedAiCostUsdPerImage = 0.039` (Google nano-banana class).  
FX assumption: **USD 1 = EUR 0.92** (so $0.039 ≈ **€0.036**). Recalculate when a real invoice exists.

| Scenario | Predictions | Replicate | Stripe | VAT 21% net | Contribution | CM of gross | CM of net |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 image, no regen | 1 | €0.036 | €0.325 | €4.124 | €3.763 | **75.4%** | 91.2% |
| Initial + included regen | 2 | €0.072 | €0.325 | €4.124 | €3.727 | **74.7%** | 90.4% |
| 3 attempts then success, no regen | 3 | €0.108 | €0.325 | €4.124 | €3.691 | **74.0%** | 89.5% |
| 3 attempts + regen | 4 | €0.144 | €0.325 | €4.124 | €3.655 | **73.2%** | 88.6% |
| VAT 19%, 1 image | 1 | €0.036 | €0.325 | €4.193 | €3.832 | **76.8%** | 91.4% |
| VAT 23%, 2 images | 2 | €0.072 | €0.325 | €4.057 | €3.660 | **73.3%** | 90.2% |

Storage, signed URLs, Resend, and Vercel are cents at this volume and are omitted from contribution. Support time is not included.

## Failed generations and refunds

Policy (`productModel.refund`): refund if never generated or if technical failure after retries. No refund because the customer dislikes a successful image.

A full refund after 3 paid predictions:

- Revenue after refund: €0
- Stripe fee drag: ≈ €0.33 (often kept by Stripe)
- Replicate: ≈ €0.11
- **Loss per failed-and-refunded order: ≈ €0.44** plus support time

That is an **incident cost**, not a reason to raise list price if the failure rate stays low. It **is** a reason to keep the retry cap at 3 and to refuse starting generation until Stripe payment is confirmed (already the code path).

## Included-regeneration mix

Let `r` be the share of paid orders that use the included regen (2nd billable prediction).

Contribution of gross at VAT 21%:

`CM% ≈ (4.124 − 0.325 − 0.036×(1+r)) / 4.99`

- r = 0 → 75.4%
- r = 0.5 → 75.1%
- r = 1.0 → 74.7%

The 70% target is met across the regen range **as long as** VAT is not stacked on top of extra retries beyond ~4 predictions and the Stripe fee stays near 1.5% + €0.25.

## Should the price change?

**Keep €4.99** for the controlled live test.

Reasons:

- Modeled contribution stays **above 70% of gross** for 1–4 predictions at 19–23% VAT.
- Raising the price before a real Replicate invoice and a real regen rate is guessing.
- Lowering the price to €3.99 would still clear 70% at 1 image (net €3.298 at 21% VAT, Stripe €0.310, AI €0.036 → €2.952 / €3.99 = 74%) but leaves less room for AMEX, extra retries, and refunds.

Revisit after 20–50 **successful live** orders with: actual Stripe fee mix, actual Replicate invoice, regen rate, refund rate. If regen + retries average **>4 predictions** or non-EEA fees dominate, raise to **€6.99** rather than cutting quality.

## Missing live inputs

- Stripe dashboard fee line for a real €4.99 charge
- Replicate invoice USD for `google/nano-banana`
- VAT OSS country mix
- Regen and refund rates
