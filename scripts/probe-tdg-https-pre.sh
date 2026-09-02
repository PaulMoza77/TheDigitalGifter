#!/usr/bin/env bash
# Pre-DNS HTTPS readiness probe on Mozas (no public cert required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=mozas-ssh.sh
source "${ROOT}/scripts/mozas-ssh.sh"
mozas_prepare_ssh
mozas_verify_remote_identity
mozas_ssh 'set -euo pipefail
  echo -n mode_file=; cat /opt/mozas/proxy/tdg-caddy.mode 2>/dev/null || echo missing
  echo
  echo -n caddy_data_mount=; docker inspect mozas-caddy --format "{{range .Mounts}}{{if eq .Destination \"/data\"}}{{.Source}}{{end}}{{end}}"
  echo
  echo -n acme_email_set=; if grep -q CADDY_ACME_EMAIL /opt/mozas/proxy/.env 2>/dev/null; then echo yes; else echo no; fi
  echo -n https_ready_on_vps=; if test -f /opt/mozas/projects/thedigitalgifter/repo/deploy/caddy/Caddyfile.https.ready; then echo yes; else echo no; fi
  echo -n ensure_script=; if test -x /opt/mozas/bin/mozas-ensure-tdg-caddy; then echo yes; else echo no; fi
  echo renew_mechanism=caddy_acme_automatic
  echo -n cert_storage_present=; if docker exec mozas-caddy ls /data/caddy >/dev/null 2>&1; then echo yes; else echo no; fi
'
