import { readFileSync, existsSync } from "node:fs";

export function loadContaboEnv(extraPath) {
  const candidates = [
    extraPath,
    process.env.CS_WORKER_ENV_FILE,
    "/opt/supabase/tdg/.env",
    "/tmp/tdg-story-qa.env",
  ].filter(Boolean);
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
    return path;
  }
  return null;
}

export function requireSupabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.API_EXTERNAL_URL || "";
  const key = process.env.SERVICE_ROLE_KEY || "";
  if (!url.startsWith("https://") || key.length < 20) {
    throw new Error("missing_supabase_env");
  }
  return { url, key };
}