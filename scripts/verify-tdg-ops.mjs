#!/usr/bin/env node
/**
 * Permanent operations checks for TDG on Mozas VPS.
 * Never prints secret values.
 */
import { execFileSync } from "node:child_process";

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const out = execFileSync(
  "bash",
  [
    "-lc",
    `
set -euo pipefail
cd /workspace
source scripts/mozas-ssh.sh
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
  python3 -c "import json;d=json.load(open(\"/opt/mozas/log/backup-last.json\"));print(\"backup_offsite=\"+str(d.get(\"offsite\")).lower());print(\"backup_ts=\"+str(d.get(\"timestamp\")))"
  echo -n app_env_keys=
  python3 - <<PY
from pathlib import Path
need=["VITE_SUPABASE_URL","VITE_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY","SUPABASE_URL"]
keys={}
for line in Path("/opt/mozas/projects/thedigitalgifter/secrets/app.env").read_text().splitlines():
  if "=" in line and not line.startswith("#"):
    k,v=line.split("=",1); keys[k]=bool(v.strip())
print(",".join(f"{k}={keys.get(k)}" for k in need))
PY
  echo -n backup_env_keys=
  python3 - <<PY
from pathlib import Path
need=["RESTIC_REPOSITORY","RESTIC_PASSWORD","MOZAS_BACKUP_S3_ENDPOINT","MOZAS_BACKUP_S3_BUCKET","MOZAS_BACKUP_S3_ACCESS_KEY","MOZAS_BACKUP_S3_SECRET_KEY"]
keys={}
for line in Path("/opt/mozas/secrets/backup.env").read_text().splitlines():
  if "=" in line and not line.startswith("#"):
    k,v=line.split("=",1); keys[k]=bool(v.strip())
print(",".join(f"{k}={keys.get(k)}" for k in need))
PY
  echo -n caddy_mode=; cat /opt/mozas/proxy/tdg-caddy.mode 2>/dev/null || echo missing
  echo
  echo ensure_bin=$(test -x /opt/mozas/bin/mozas-ensure-tdg-caddy && echo yes || echo no)
  echo https_ready=$(test -f /opt/mozas/projects/thedigitalgifter/repo/deploy/caddy/Caddyfile.https.ready && echo yes || echo no)
  echo restic_recovery_doc=$(test -f /opt/mozas/secrets/RESTIC_PASSWORD_RECOVERY.txt && echo yes || echo no)
  echo caddy_data=$(docker inspect mozas-caddy --format "{{range .Mounts}}{{if eq .Destination \"/data\"}}{{.Name}}{{end}}{{end}}")
'
`,
  ],
  { encoding: "utf8", maxBuffer: 2_000_000 },
);

function grab(re) {
  const m = out.match(re);
  return m ? m[1] : "";
}

record("autostart_tdg", grab(/restart_tdg=(\S+)/) === "unless-stopped", grab(/restart_tdg=(\S+)/));
record("autostart_themozas", grab(/restart_themozas=(\S+)/) === "unless-stopped", grab(/restart_themozas=(\S+)/));
record("autostart_caddy", grab(/restart_caddy=(\S+)/) === "unless-stopped", grab(/restart_caddy=(\S+)/));
record("health_tdg", grab(/health_tdg=(\S+)/) === "healthy", grab(/health_tdg=(\S+)/));
record("health_themozas", grab(/health_themozas=(\S+)/) === "healthy", grab(/health_themozas=(\S+)/));
record("backup_timer_enabled", grab(/timer_enabled=(\S+)/) === "enabled", grab(/timer_enabled=(\S+)/));
record("backup_timer_active", grab(/timer_active=(\S+)/) === "active", grab(/timer_active=(\S+)/));
record("backup_last_offsite", grab(/backup_offsite=(\S+)/) === "true", grab(/backup_ts=(\S+)/));
record(
  "app_env_persistent",
  /SUPABASE_SERVICE_ROLE_KEY=True/.test(out) && /VITE_SUPABASE_URL=True/.test(out),
  grab(/app_env_keys=(.*)/),
);
record(
  "backup_env_persistent",
  /MOZAS_BACKUP_S3_ENDPOINT=True/.test(out) && /RESTIC_PASSWORD=True/.test(out),
  "s3+restic keys present",
);
record("ensure_caddy_installed", grab(/ensure_bin=(\S+)/) === "yes", "");
record("https_ready_present", grab(/https_ready=(\S+)/) === "yes", "");
record("restic_recovery_doc", grab(/restic_recovery_doc=(\S+)/) === "yes", "");
record("caddy_cert_volume", Boolean(grab(/caddy_data=(\S+)/)), grab(/caddy_data=(\S+)/) || "missing");

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`OPS_VERIFY_FAILED ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`OPS_VERIFY_OK ${results.length}/${results.length}`);
