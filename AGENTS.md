# Agent instructions — The Digital Gifter

## Production deployment (mandatory)

Production deployment for TDG MUST use `scripts/deploy-production.sh`. Vercel and GitHub Actions are forbidden deployment paths. If deployment fails, debug the SSH/VPS deployment. Do not switch deployment providers.

Exact path:

**CURSOR CLOUD AGENT → DIRECT SSH → PRODUCTION VPS → BUILD/RESTART → HEALTHCHECK**

```bash
bash scripts/deploy-production.sh
```

Required credentials are **Cursor Cloud Agent secrets** only:

- `MOZAS_SSH_HOST`
- `MOZAS_SSH_PRIVATE_KEY`
- `MOZAS_SSH_USER` (scripts always connect as `mozas`)

Rules:

- NEVER deploy TDG through Vercel.
- NEVER deploy TDG through GitHub Actions.
- NEVER require GitHub Actions secrets for deployment.
- NEVER suggest an alternative deployment provider when SSH fails.
- GitHub is source control only for the production origin.
- Cursor Cloud Agent secrets are the deployment credentials.

Background: `docs/TDG_VPS_MIGRATION.md`
