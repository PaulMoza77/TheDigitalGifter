# TheDigitalGifter on Mozas VPS

A new Cursor account needs **repo access** plus **MOZAS_SSH_*** only.
Application Vite keys live on the VPS at
`/opt/mozas/projects/thedigitalgifter/secrets/app.env` and must not be
re-entered from the agent.

## Authorized SSH identity

| Item | Value |
| --- | --- |
| Host | value of `MOZAS_SSH_HOST` |
| Port | `22` |
| User | `mozas` |
| Hostname | `mozas-prod-01` |
| ED25519 | `SHA256:cygpYZwFgfu0Us7v2ekcfQdUwSzCAwc6XRFHrPWy+B4` |

Required secrets (names only): `MOZAS_SSH_HOST`, `MOZAS_SSH_PRIVATE_KEY`, `MOZAS_SSH_USER`.
`MOZAS_SSH_USER=user` is invalid on this host; scripts always connect as `mozas`.
Do not use `VPS_*`.

## Persist secrets (VPS, permanent)

```bash
export MOZAS_SSH_HOST MOZAS_SSH_PRIVATE_KEY
export SUPABASE_SERVICE_ROLE_KEY
export MOZAS_BACKUP_S3_ENDPOINT MOZAS_BACKUP_S3_BUCKET
export MOZAS_BACKUP_S3_ACCESS_KEY MOZAS_BACKUP_S3_SECRET_KEY
bash scripts/persist-tdg-vps-config.sh
```

## Deploy (preserves HTTPS)

```bash
export MOZAS_SSH_HOST MOZAS_SSH_PRIVATE_KEY MOZAS_SSH_USER
bash scripts/deploy-vps.sh
```

Deploy calls `mozas-ensure-tdg-caddy`, which:

- if `/opt/mozas/proxy/tdg-caddy.mode` (or the live Caddyfile) is **https**, re-applies
  `Caddyfile.https.ready` (does **not** downgrade to HTTP);
- otherwise applies `Caddyfile.http`.

Failed deploys roll back to `mozas/thedigitalgifter:previous` and restore
`releases/verified.*` metadata. Verified pins advance only after health wait succeeds.

CI (`.github/workflows/deploy-vps-static.yml`) requires Production secrets and passes
`MOZAS_SSH_HOST` into the Verify step. After deploy it runs `TDG_HTTPS_PHASE=post`
(public HTTPS, no `--resolve`) and Apple Pay file checks.

`deploy-vercel-production.yml` is **disabled**. `scripts/vercel-ignore.mjs` skips
Vercel builds for this repo (`the-digital-gifter`, `the-digital-gifter-d5vu`).
Keep existing Vercel deployments as rollback until a live payment is confirmed.

## Verify

```bash
node scripts/verify-tdg-vps-origin.mjs
node scripts/verify-tdg-flows.mjs
node scripts/verify-tdg-functional.mjs   # NEG vs FUN separated
TDG_HTTPS_PHASE=pre node scripts/verify-tdg-https.mjs
node scripts/verify-tdg-ops.mjs
```

## HTTPS / manual cutover

Origin and flow checks accept **either** plain HTTP 200 (current) **or**
HTTP 3xx → HTTPS 200. They never follow a `:80 --resolve` redirect onto
public `:443` (that would hit stale DNS).

**Live (2026-09-01):** Caddy mode `https`. Apex + www have Let's Encrypt certs.
HTTP→HTTPS is 308. Deploy uses `mozas-ensure-tdg-caddy` so later deploys
keep this file. TheMozas stays on bare-IP `:80`.

**Pre-DNS / re-check storage:** cert volume, ACME email, `Caddyfile.https.ready`, ensure script.

```bash
bash scripts/run-tdg-backup-now.sh          # fresh R2 snapshot of current config
bash scripts/prepare-tdg-cutover.sh         # DNS readiness + pre checks
TDG_HTTPS_PHASE=pre node scripts/verify-tdg-https.mjs
```

You change DNS (no Cloudflare token in this repo):

1. Keep MX.
2. Apex **and** www **A** → `MOZAS_SSH_HOST` (prefer grey-cloud; no AAAA, or AAAA = VPS only).
3. Keep the Vercel deployment as rollback.

**After you confirm both names are on the VPS:**

```bash
TDG_HTTPS_APPLY=yes bash scripts/apply-tdg-https.sh
# orange-cloud: add TDG_HTTPS_ALLOW_PROXIED=yes
TDG_HTTPS_PHASE=post node scripts/verify-tdg-https.mjs
```

Post checks **both** domains, twice: direct VPS (`--resolve`) and public (no
`--resolve`). Also A/AAAA, certificate, TDG pages, TheMozas on bare-IP HTTP.
Do **not** declare cutover complete until `HTTPS_VERIFY_OK phase=post`.

## Rollback

```bash
bash scripts/rollback-tdg-vps.sh
```

Restores image + `current.*` / `verified.*` release metadata coherently.

## Backup + Restic password off-VPS

```bash
bash scripts/run-tdg-backup-now.sh
bash scripts/run-tdg-backup-drill.sh          # optional isolated restore
RESTIC_PASSWORD_EXPORT_PATH="$HOME/tdg-restic-password.txt" \
  bash scripts/export-restic-password-offsite.sh
# then password manager + shred
```

Instructions on VPS: `/opt/mozas/secrets/RESTIC_PASSWORD_RECOVERY.txt`.

## Manual DNS (no Cloudflare token)

1. Keep MX.
2. Apex + www A → `MOZAS_SSH_HOST` (prefer grey-cloud for first ACME).
3. Keep Vercel as rollback.
4. Confirm to the agent, then HTTPS apply + post verify above.

## Still optional / blockers

- GitHub Production must contain `MOZAS_SSH_HOST`, `MOZAS_SSH_PRIVATE_KEY`,
  `MOZAS_SSH_USER` (and ideally `VITE_SUPABASE_*`) for CI deploy+verify.
- Stripe **test** keys for paid checkout/generation e2e (do not replace live keys).
