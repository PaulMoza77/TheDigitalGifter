import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "dist";
const PATTERNS = [
  /sk_live_[A-Za-z0-9]+/g,
  /sk_test_[A-Za-z0-9]+/g,
  /re_[A-Za-z0-9]{20,}/g,
  /SUPABASE_SERVICE_ROLE_KEY/g,
  /REPLICATE_API_TOKEN/g,
  /META_CAPI_ACCESS_TOKEN/g,
  /META_ADS_ACCESS_TOKEN/g,
  /GA4_SERVICE_ACCOUNT_PRIVATE_KEY/g,
  /GA4_SERVICE_ACCOUNT_JSON/g,
  /PET_ANALYTICS_CRON_SECRET/g,
  /PET_TOKEN_ENCRYPTION_KEY/g,
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(js|css|html|map)$/.test(entry)) files.push(full);
  }
  return files;
}

const files = walk(ROOT);
let hits = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const pattern of PATTERNS) {
    const found = text.match(pattern);
    if (found) {
      hits += found.length;
      console.error(`Secret-like match in ${file}: ${pattern}`);
    }
  }
}

if (hits > 0) {
  console.error(`secret-scan failed with ${hits} hit(s)`);
  process.exit(1);
}

console.log(`secret-scan passed on ${files.length} dist files`);
