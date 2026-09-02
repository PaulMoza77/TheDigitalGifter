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

const out = execFileSync("bash", ["scripts/probe-tdg-ops.sh"], {
  encoding: "utf8",
  maxBuffer: 2_000_000,
});

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
