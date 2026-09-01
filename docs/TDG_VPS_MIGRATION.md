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

## Deploy

From a clean checkout of the commit you want live:

```bash
export MOZAS_SSH_HOST MOZAS_SSH_PRIVATE_KEY MOZAS_SSH_USER
bash scripts/deploy-vps.sh
```

The script:

1. Verifies identity and TheMozas `http://127.0.0.1/healthz`.
2. Rsyncs the repo to `/opt/mozas/projects/thedigitalgifter/repo` (never the `secrets/` directory).
3. Applies Caddy host `tdg-verify.mozas-prod-01` while keeping default `:80` on TheMozas.
4. Builds `mozas/thedigitalgifter:<shortsha>` from VPS `app.env` Vite keys.
5. Waits for container health. Failure is not reported as success; previous image is restored when present.
6. Re-checks TheMozas and the TDG verify host.

CI: `.github/workflows/deploy-vps-static.yml` fails if `MOZAS_SSH_*` are missing.
It does not skip.

Public DNS is **not** changed by deploy.

## Verify origin (before DNS)

```bash
curl --resolve tdg-verify.mozas-prod-01:80:"$MOZAS_SSH_HOST" http://tdg-verify.mozas-prod-01/healthz
node scripts/verify-tdg-vps-origin.mjs
```

## Rollback

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
Offsite copy runs only when these are set in `/opt/mozas/secrets/backup.env`:

- `MOZAS_BACKUP_S3_ENDPOINT`
- `MOZAS_BACKUP_S3_BUCKET`
- `MOZAS_BACKUP_S3_ACCESS_KEY`
- `MOZAS_BACKUP_S3_SECRET_KEY`

Store `RESTIC_PASSWORD` **off the VPS** (founder password manager). Do not put
it in git or a PR.

VPS backup is **not** a Supabase backup. Auth, Postgres, Storage, and Edge
state remain in the Supabase project and need Supabase-native backups / PITR.

Restore drill (isolated, does not replace production):

```bash
sudo /opt/mozas/bin/mozas-restore-test
```

## DNS cutover (only after origin + backup policy)

```bash
export CLOUDFLARE_API_TOKEN
# optional: CLOUDFLARE_ZONE_ID, CLOUDFLARE_ZONE_NAME
bash scripts/cutover-cloudflare-dns.sh
```

Then install `deploy/caddy/Caddyfile.https.ready` on the proxy so ACME can
issue certificates for `thedigitalgifter.com` / `www`.

## Still required (names only)

See the PR / run report. Typical gaps:

- `SUPABASE_SERVICE_ROLE_KEY` (same-origin analytics persist + full sitemap)
- Offsite S3 restic keys above
- `CLOUDFLARE_API_TOKEN` (cutover)
- Stripe **test** keys for isolated checkout (do not replace live keys)
- Off-VPS copy of `RESTIC_PASSWORD`
