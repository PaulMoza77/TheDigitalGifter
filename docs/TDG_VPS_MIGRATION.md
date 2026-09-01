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

`scripts/mozas-ssh.sh` refuses any other host and checks the fingerprint before
commands run.

## Persist secrets (VPS, permanent)

```bash
export MOZAS_SSH_HOST MOZAS_SSH_PRIVATE_KEY
export SUPABASE_SERVICE_ROLE_KEY
export MOZAS_BACKUP_S3_ENDPOINT MOZAS_BACKUP_S3_BUCKET
export MOZAS_BACKUP_S3_ACCESS_KEY MOZAS_BACKUP_S3_SECRET_KEY
bash scripts/persist-tdg-vps-config.sh
```

Writes:

- `/opt/mozas/projects/thedigitalgifter/secrets/app.env` — Vite keys (kept) + service role
- `/opt/mozas/secrets/backup.env` — R2/S3 keys for offsite restic (endpoint is normalized)

Never commit or print those values. Store `RESTIC_PASSWORD` off the VPS in the
founder password manager (it already exists in `backup.env`; copy it yourself).

## Deploy

From a clean checkout of the commit you want live:

```bash
export MOZAS_SSH_HOST MOZAS_SSH_PRIVATE_KEY MOZAS_SSH_USER
bash scripts/deploy-vps.sh
```

The script:

1. Verifies identity and TheMozas `http://127.0.0.1/healthz`.
2. Rsyncs the repo to `/opt/mozas/projects/thedigitalgifter/repo` (never the `secrets/` directory).
3. Applies Caddy hosts `tdg-verify.mozas-prod-01`, `thedigitalgifter.com`, and
   `www.thedigitalgifter.com` while keeping default `:80` on TheMozas.
4. Builds `mozas/thedigitalgifter:<shortsha>` from VPS `app.env` Vite keys.
5. Waits for container health. Failure is not reported as success; previous image is restored when present.
6. Re-checks TheMozas and the TDG verify host.

CI: `.github/workflows/deploy-vps-static.yml` fails if `MOZAS_SSH_*` are missing.
It does not skip.

Public DNS is **not** changed by deploy.

## Verify origin (before DNS)

```bash
curl --resolve tdg-verify.mozas-prod-01:80:"$MOZAS_SSH_HOST" http://tdg-verify.mozas-prod-01/healthz
curl --resolve thedigitalgifter.com:80:"$MOZAS_SSH_HOST" http://thedigitalgifter.com/healthz
node scripts/verify-tdg-vps-origin.mjs
node scripts/verify-tdg-flows.mjs
```

## Rollback

Verified pins after a healthy deploy:

- `/opt/mozas/projects/thedigitalgifter/releases/verified.tag`
- `/opt/mozas/projects/thedigitalgifter/releases/verified.sha`

**Application image (VPS, no DNS change):**

```bash
bash scripts/rollback-tdg-vps.sh
# or on the VPS:
/opt/mozas/bin/mozas-rollback-thedigitalgifter
```

Destination: Docker image `mozas/thedigitalgifter:previous`.

**Public traffic (after cutover only):** restore the A/CNAME values saved in
`docs/audits/tdg-dns-before-cutover.txt`. Keep the Vercel production deployment
in place for that rollback.

## Backup

Local encrypted restic already includes `/opt/mozas/projects` (hence `app.env`).
Offsite `restic copy` runs when these are set in `/opt/mozas/secrets/backup.env`:

- `MOZAS_BACKUP_S3_ENDPOINT`
- `MOZAS_BACKUP_S3_BUCKET`
- `MOZAS_BACKUP_S3_ACCESS_KEY`
- `MOZAS_BACKUP_S3_SECRET_KEY`

```bash
bash scripts/run-tdg-backup-drill.sh
```

That initializes the R2 restic repo if needed, runs `mozas-backup.service`,
requires `offsite=true` in `/opt/mozas/log/backup-last.json`, then restores
latest **local** and **offsite** snapshots into isolated directories (production
is not replaced).

VPS backup is **not** a Supabase backup. Auth, Postgres, Storage, and Edge
state remain in the Supabase project and need Supabase-native backups / PITR.

## Manual DNS cutover (no Cloudflare token)

Do this in the Cloudflare dashboard. Scripts will not change DNS.

1. Keep **MX** (and any mail/TXT you did not plan to move).
2. Point apex `thedigitalgifter.com` A to the Mozas VPS address (`MOZAS_SSH_HOST`).
3. Point `www` A to the same address (or CNAME to the apex).
4. Prefer DNS-only (grey cloud) for the first ACME issue. Orange-cloud can be
   enabled later once HTTPS is green.
5. Keep the Vercel production deployment as rollback.

When public DNS already answers with the VPS:

```bash
export MOZAS_SSH_HOST MOZAS_SSH_PRIVATE_KEY
TDG_HTTPS_APPLY=yes bash scripts/apply-tdg-https.sh
```

If Cloudflare is orange-cloud (proxied), add `TDG_HTTPS_ALLOW_PROXIED=yes`.
That installs `deploy/caddy/Caddyfile.https.ready` (TheMozas + TDG HTTPS, verify
host still on HTTP). Do **not** run this while public DNS still points at Vercel.

## Still optional

- GitHub Production `MOZAS_SSH_*` so CI deploy is not fail-closed
- Stripe **test** keys for isolated checkout (do not replace live keys)
- Off-VPS copy of `RESTIC_PASSWORD`
