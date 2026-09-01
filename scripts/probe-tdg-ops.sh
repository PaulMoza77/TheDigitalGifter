#!/usr/bin/env bash
# Permanent ops probe for TDG on Mozas (no secret values).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=mozas-ssh.sh
source "${ROOT}/scripts/mozas-ssh.sh"
mozas_prepare_ssh
mozas_verify_remote_identity
mozas_ssh 'set -euo pipefail
  echo restart_tdg=$(docker inspect -f "{{.HostConfig.RestartPolicy.Name}}" thedigitalgifter)
  echo restart_themozas=$(docker inspect -f "{{.HostConfig.RestartPolicy.Name}}" themozas)
  echo restart_caddy=$(docker inspect -f "{{.HostConfig.RestartPolicy.Name}}" mozas-caddy)
  echo health_tdg=$(docker inspect -f "{{.State.Health.Status}}" thedigitalgifter)
  echo health_themozas=$(docker inspect -f "{{.State.Health.Status}}" themozas)
  echo health_caddy=$(docker inspect -f "{{.State.Health.Status}}" mozas-caddy)
  echo timer_enabled=$(sudo -n systemctl is-enabled mozas-backup.timer)
  echo timer_active=$(sudo -n systemctl is-active mozas-backup.timer)
  python3 - <<'"'"'PY'"'"'
import json
from pathlib import Path
d=json.loads(Path("/opt/mozas/log/backup-last.json").read_text())
print("backup_offsite="+str(d.get("offsite")).lower())
print("backup_ts="+str(d.get("timestamp")))
need_app=["VITE_SUPABASE_URL","VITE_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY","SUPABASE_URL"]
keys={}
for line in Path("/opt/mozas/projects/thedigitalgifter/secrets/app.env").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k,v=line.split("=",1); keys[k]=bool(v.strip())
print("app_env_keys="+",".join(f"{k}={keys.get(k)}" for k in need_app))
need_b=["RESTIC_REPOSITORY","RESTIC_PASSWORD","MOZAS_BACKUP_S3_ENDPOINT","MOZAS_BACKUP_S3_BUCKET","MOZAS_BACKUP_S3_ACCESS_KEY","MOZAS_BACKUP_S3_SECRET_KEY"]
keys={}
for line in Path("/opt/mozas/secrets/backup.env").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k,v=line.split("=",1); keys[k]=bool(v.strip())
print("backup_env_keys="+",".join(f"{k}={keys.get(k)}" for k in need_b))
PY
  echo -n caddy_mode=; cat /opt/mozas/proxy/tdg-caddy.mode 2>/dev/null || echo missing
  echo
  echo ensure_bin=$(test -x /opt/mozas/bin/mozas-ensure-tdg-caddy && echo yes || echo no)
  echo https_ready=$(test -f /opt/mozas/projects/thedigitalgifter/repo/deploy/caddy/Caddyfile.https.ready && echo yes || echo no)
  echo restic_recovery_doc=$(test -f /opt/mozas/secrets/RESTIC_PASSWORD_RECOVERY.txt && echo yes || echo no)
  echo caddy_data=$(docker inspect mozas-caddy --format "{{range .Mounts}}{{if eq .Destination \"/data\"}}{{.Name}}{{end}}{{end}}")
'
