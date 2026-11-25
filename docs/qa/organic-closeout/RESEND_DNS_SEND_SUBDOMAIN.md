# Resend DNS — `send.thedigitalgifter.com`

**Status (2026-11-24):** Domain **verified** in Resend (`eu-west-1`). Authorized inbox delivery **PASS**.

Resend nests return-path hosts under `send.*` (not always apex `send` TXT/MX alone). Observed public DNS:

| Record | Host | Value (abbrev.) | Status |
| --- | --- | --- | --- |
| DKIM CNAME | `resend._domainkey.send.thedigitalgifter.com` | `send.forge.rmta.net.` | Present |
| SPF TXT | `send.send.thedigitalgifter.com` | `v=spf1 include:amazonses.com ~all` | Present |
| MX | `send.send.thedigitalgifter.com` | `10 feedback-smtp.eu-west-1.amazonses.com.` | Present |
| Return-path CNAME | `rsend.send.thedigitalgifter.com` | (Resend) | Present |
| DMARC apex | `_dmarc.thedigitalgifter.com` | `v=DMARC1; p=none;` | Keep — **do not** set quarantine |

Do **not** add a second SPF on apex `thedigitalgifter.com`. Do **not** mutate other domains.

## Envelope

Transactional From: `christmas@send.thedigitalgifter.com` (`CHRISTMAS_EMAIL_FROM`).

## Delivery evidence (authorized inbox)

| Kind | Resend id | last_event |
| --- | --- | --- |
| Santa Call QA | `01a20fa7-a7cc-7478-8a24-545c4af369da` | delivered |
| Santa extension QA | `01a20fa7-a8b1-70f7-ac91-10b949c6b126` | delivered |
| Christmas Story QA | `01a20fa7-aa96-7f23-8b9d-ab566eb17682` | delivered |
| Abandoned checkout QA | `01a20faa-cb45-765e-b745-ea067e09cd4a` | delivered |

Recipient: `thedigitalgifter@gmail.com` only. No commercial abandoned sends.

## Cloudflare note

Owner Cloudflare login was still required for UI confirmation; public dig + Resend API already match verified nested records — **no DNS mutation needed** if dashboard matches the table above.
