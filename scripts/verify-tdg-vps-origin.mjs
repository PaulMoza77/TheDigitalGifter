#!/usr/bin/env node
/**
 * Verify the Mozas TDG origin through the pre-cutover host.
 * Never prints response bodies that might contain secrets.
 */
import { execFileSync } from "node:child_process";

const host = process.env.TDG_VERIFY_HOST || "tdg-verify.mozas-prod-01";
const ip = process.env.MOZAS_SSH_HOST || process.env.MOZAS_ORIGIN_IP || "";
if (!ip) {
  console.error("BLOCKED: set MOZAS_SSH_HOST or MOZAS_ORIGIN_IP");
  process.exit(2);
}
const results = [];

function curl(path, extra = []) {
  const args = [
    "-sS",
    "-D",
    "-",
    "-o",
    "/tmp/tdg-verify-body",
    "--resolve",
    `${host}:80:${ip}`,
    ...extra,
    `http://${host}${path}`,
  ];
  const out = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 2_000_000 });
  const statusMatch = out.match(/HTTP\/\S+\s+(\d+)/);
  const status = statusMatch ? Number(statusMatch[1]) : 0;
  const typeMatch = out.match(/content-type:\s*([^\r\n]+)/i);
  const contentType = typeMatch ? typeMatch[1].trim() : "";
  return { status, contentType, headers: out };
}

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const health = curl("/healthz");
record("healthz", health.status === 200, `http=${health.status}`);

const home = curl("/");
record("home_html", home.status === 200 && /text\/html/i.test(home.contentType), `http=${home.status}`);

const pet = curl("/pet/dog");
record("spa_refresh_pet", pet.status === 200 && /text\/html/i.test(pet.contentType), `http=${pet.status}`);

const miss = curl("/api/does-not-exist");
record("api_miss_not_spa", miss.status === 404 && !/text\/html/i.test(miss.contentType), `http=${miss.status} type=${miss.contentType || "none"}`);

const sitemap = curl("/sitemap.xml");
record("sitemap_xml", sitemap.status === 200 && /xml/i.test(sitemap.contentType), `http=${sitemap.status}`);

const robots = curl("/robots.txt");
record("robots", robots.status === 200, `http=${robots.status}`);

const apple = curl("/.well-known/apple-developer-merchantid-domain-association");
record(
  "apple_pay_file",
  apple.status === 200 && !/text\/html/i.test(apple.contentType),
  `http=${apple.status} type=${apple.contentType || "none"}`,
);

const ingest = curl("/api/pet/funnel-event", ["-X", "POST", "-H", "Content-Type: application/json", "-d", "{}"]);
record(
  "pet_v1_ingest_not_html",
  ingest.status >= 400 && ingest.status < 600 && !/text\/html/i.test(ingest.contentType),
  `http=${ingest.status}`,
);

function curlHost(hostname, path) {
  const args = [
    "-sS",
    "-D",
    "-",
    "-o",
    "/tmp/tdg-verify-body",
    "--resolve",
    `${hostname}:80:${ip}`,
    `http://${hostname}${path}`,
  ];
  const out = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 2_000_000 });
  const statusMatch = out.match(/HTTP\/\S+\s+(\d+)/);
  const status = statusMatch ? Number(statusMatch[1]) : 0;
  const typeMatch = out.match(/content-type:\s*([^\r\n]+)/i);
  const contentType = typeMatch ? typeMatch[1].trim() : "";
  const body = execFileSync("cat", ["/tmp/tdg-verify-body"], { encoding: "utf8" });
  return { status, contentType, body };
}

const apex = curlHost("thedigitalgifter.com", "/healthz");
record("apex_host_healthz", apex.status === 200 && apex.body.trim() === "ok", `http=${apex.status}`);

const www = curlHost("www.thedigitalgifter.com", "/");
record(
  "www_host_home",
  www.status === 200 && /text\/html/i.test(www.contentType),
  `http=${www.status}`,
);

const serviceRole = curl("/api/pet-v3/internal-test-status", [
  "-X",
  "POST",
  "-H",
  "Content-Type: application/json",
  "-d",
  '{"funnel_session_id":"00000000-0000-4000-8000-000000000001"}',
]);
record(
  "service_role_internal_status",
  serviceRole.status === 200 && !/text\/html/i.test(serviceRole.contentType),
  `http=${serviceRole.status}`,
);

const failed = results.filter((row) => !row.ok);
if (failed.length) {
  console.error(`VERIFY_FAILED ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`VERIFY_OK ${results.length}/${results.length}`);
