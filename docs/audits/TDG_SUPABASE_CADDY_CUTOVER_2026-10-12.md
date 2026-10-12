# TDG `supabase.` Caddy cutover evidence — 2026-10-12

**Scope performed:** Controlled Mozas shared-Caddy HTTPS routing for `supabase.thedigitalgifter.com` → Contabo Kong via existing SSH tunnel.  
**Not performed:** DNS edits, app deploy, DB writes, migrations, Edge/Stripe/Storage backfill, credential changes, PR merges.

## Backup identifiers

| Item | Value |
|------|-------|
| Prechange Caddyfile copy | `/opt/mozas/proxy/Caddyfile.bak-pre-supabase-api-20261012T075525Z` |
| Prechange SHA256 | `1656c1edb9b65b9e879e2dc434d0cc573ef23d83a352d59c55b476ab3067410a` |
| Restic last (local+offsite, includes `/opt/mozas/proxy`) | `20261012T001747Z` |

### Rollback procedure (ready, not needed)

```bash
cp -a /opt/mozas/proxy/Caddyfile.bak-pre-supabase-api-20261012T075525Z /opt/mozas/proxy/Caddyfile
docker exec mozas-caddy caddy validate --config /etc/caddy/Caddyfile
docker restart mozas-caddy   # admin off → same-container restart
```

## Tunnel state

| Check | Result |
|-------|--------|
| Unit | `tdg-staging-supabase-tunnel` **active** / **enabled** / `Restart=always` |
| Host loopback | `127.0.0.1:19000` → Contabo Kong `:8000` |
| Docker bridge (for Caddy) | `172.18.0.1:19001` → same Kong (required; container cannot use host `127.0.0.1`) |
| Kong identity | GoTrue `v2.196.0` via tunnel |

## Caddy change

- Authoritative file: `/opt/mozas/proxy/Caddyfile` (bind-mounted RO into `mozas-caddy`)
- Added **only** site `supabase.thedigitalgifter.com`
- Upstream: `172.18.0.1:19001` with `Host`/`X-Real-IP`, `flush_interval -1`, 360s R/W timeouts
- Validate: **Valid configuration**
- Apply: `docker restart mozas-caddy` (same container ID; `admin off` blocks `caddy reload` API)
- Post: container **healthy**; TLS subject includes `supabase.thedigitalgifter.com`

## Post-cutover external results

| Check | Result |
|-------|--------|
| Trusted cert | Let's Encrypt `CN=supabase.thedigitalgifter.com` (YE2), verify OK |
| TLS handshake | TLSv1.3 — no `ERR_SSL_PROTOCOL_ERROR` |
| `/auth/v1/health` + apikey | **200** GoTrue |
| REST `templates` / `occasions` | **200** |
| Storage public object | **200** (2,113,048 bytes) |
| CORS OPTIONS from `https://www.thedigitalgifter.com` | **200** + `access-control-allow-origin` |
| Realtime WS (HTTP/1.1) | **101** |
| Soak (~45s) recheck | Auth/REST/Storage/Realtime + siblings still OK |

## Sibling service health

| Service | Result |
|---------|--------|
| `www.thedigitalgifter.com/healthz` | **200** |
| apex → www | **301** |
| `www.casahub.eu` | **200** |
| `mcp.themozas.com/healthz` | **200** |
| `www.themozas.com/healthz` | **200** |

## GO / NO-GO

| Layer | Decision |
|-------|----------|
| **Public HTTPS API routing** | **GO** — routing objective met |
| Full production platform cutover | **NO-GO** — remaining P0s below |

## Remaining P0 blockers (unchanged by this change)

1. Storage gap: **245** missing `templates/previews/**` (~515MB); byte source still blocked  
2. Edge Functions: worker boot failures; `STRIPE_WEBHOOK_SECRET` missing  
3. Security PR **#356** not verified/applied on Contabo  
4. Contabo Docker/`psql` exec access still missing (tunnel-key port-forward only)  
5. App resilience PR **#357** not merged/deployed (optional once API up; menus should work when API healthy)

## Next authorized steps (separate)

1. Contabo SSH exec → inventory + apply/verify #356  
2. Storage byte backfill dry-run → prod  
3. Edge function mount/secrets (no live charges)  
4. Merge/deploy #356 then #357; hold #353  
