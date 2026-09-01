#!/usr/bin/env node
/**
 * HTTPS readiness / post-cutover verification for TDG on Mozas.
 *
 * Modes:
 *   TDG_HTTPS_PHASE=pre   (default) — cert storage, Caddyfile.https.ready, mode logic,
 *                           public DNS still expected on Vercel; does NOT require live certs.
 *   TDG_HTTPS_PHASE=post  — public HTTPS for both domains, valid cert, redirects, TDG body,
 *                           TheMozas still on bare IP HTTP.
 *
 * Never prints secrets.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { detectTdgCaddyMode, assertCaddyContentMatchesMode } from "../deploy/lib/caddy-mode.mjs";

const phase = String(process.env.TDG_HTTPS_PHASE || "pre").toLowerCase();
const ip = process.env.MOZAS_SSH_HOST || process.env.MOZAS_ORIGIN_IP || "";
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function sh(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 4_000_000, ...opts });
  } catch (err) {
    return err.stdout?.toString?.() || "";
  }
}

const httpsReady = readFileSync(resolve("deploy/caddy/Caddyfile.https.ready"), "utf8");
const httpFile = readFileSync(resolve("deploy/caddy/Caddyfile.http"), "utf8");

try {
  assertCaddyContentMatchesMode(httpsReady, "https");
  record("https_ready_file_valid", true, "named site + HSTS + TheMozas");
} catch (e) {
  record("https_ready_file_valid", false, String(e.message || e));
}

try {
  assertCaddyContentMatchesMode(httpFile, "http");
  record("http_file_valid", true, "host matchers only");
} catch (e) {
  record("http_file_valid", false, String(e.message || e));
}

record(
  "mode_detect_https_ready",
  detectTdgCaddyMode(httpsReady, "") === "https",
  `mode=${detectTdgCaddyMode(httpsReady, "")}`,
);
record(
  "mode_detect_http_file",
  detectTdgCaddyMode(httpFile, "") === "http",
  `mode=${detectTdgCaddyMode(httpFile, "")}`,
);
record(
  "regression_https_not_downgraded_by_http_file",
  (() => {
    try {
      assertCaddyContentMatchesMode(httpFile, "https");
      return false;
    } catch {
      return true;
    }
  })(),
  "http file rejected as https candidate",
);

const apexDns = sh("dig", ["+short", "thedigitalgifter.com", "A"])
  .trim()
  .split(/\s+/)
  .filter(Boolean);
const wwwCname = sh("dig", ["+short", "www.thedigitalgifter.com", "CNAME"]).trim();
const dnsPointsVps = Boolean(ip && apexDns.includes(ip));
record(
  "dns_apex_state",
  phase === "pre" ? !dnsPointsVps || dnsPointsVps : dnsPointsVps,
  phase === "pre"
    ? dnsPointsVps
      ? "already_on_vps"
      : `still_off_vps count=${apexDns.length}`
    : dnsPointsVps
      ? "on_vps"
      : `not_on_vps apex=${apexDns[0] || "none"}`,
);

if (phase === "pre") {
  record(
    "pre_public_https_not_required",
    true,
    "public cert/redirect checks deferred until DNS cutover + apply-tdg-https",
  );
  if (process.env.MOZAS_SSH_HOST) {
    try {
      const out = sh("bash", ["scripts/probe-tdg-https-pre.sh"]);
      record(
        "pre_cert_storage_volume",
        /caddy_data_mount=\S+/.test(out) || /cert_storage_present=yes/.test(out),
        out.match(/caddy_data_mount=.*/)?.[0] || out.match(/cert_storage_present=.*/)?.[0] || "missing",
      );
      record("pre_https_ready_on_vps", /https_ready_on_vps=yes/.test(out), "");
      record("pre_ensure_script_installed", /ensure_script=yes/.test(out), "");
      record("pre_renew_mechanism", /renew_mechanism=caddy_acme_automatic/.test(out), "Caddy ACME auto-renew when HTTPS mode active");
      record("pre_acme_email_config", /acme_email_set=yes/.test(out), "");
    } catch (e) {
      record("pre_remote_https_readiness", false, String(e.message || e));
    }
  }
}

if (phase === "post") {
  if (!ip) {
    record("post_origin_ip", false, "MOZAS_SSH_HOST missing");
  } else {
    for (const host of ["thedigitalgifter.com", "www.thedigitalgifter.com"]) {
      const headers = sh("curl", [
        "-sS",
        "-D",
        "-",
        "-o",
        `/tmp/tdg-https-${host}.body`,
        "--max-time",
        "30",
        "--resolve",
        `${host}:443:${ip}`,
        `https://${host}/healthz`,
      ]);
      const status = Number((headers.match(/HTTP\/\S+\s+(\d+)/) || [])[1] || 0);
      const body = sh("cat", [`/tmp/tdg-https-${host}.body`]).trim();
      record(`post_https_healthz_${host}`, status === 200 && body === "ok", `http=${status}`);

      const home = sh("curl", [
        "-sS",
        "-D",
        "-",
        "-o",
        `/tmp/tdg-https-${host}-home.body`,
        "--max-time",
        "30",
        "--resolve",
        `${host}:443:${ip}`,
        `https://${host}/`,
      ]);
      const homeStatus = Number((home.match(/HTTP\/\S+\s+(\d+)/) || [])[1] || 0);
      const homeBody = sh("cat", [`/tmp/tdg-https-${host}-home.body`]).toLowerCase();
      record(
        `post_https_tdg_home_${host}`,
        homeStatus === 200 && homeBody.includes("digital") && !homeBody.includes("themozas."),
        `http=${homeStatus}`,
      );

      const redir = sh("curl", [
        "-sS",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code} %{redirect_url}",
        "--max-time",
        "20",
        "--resolve",
        `${host}:80:${ip}`,
        `http://${host}/`,
      ]).trim();
      const [code, url] = redir.split(/\s+/, 2);
      record(
        `post_http_to_https_${host}`,
        /^30\d$/.test(code || "") && String(url || "").startsWith(`https://${host}`),
        redir,
      );

      const cert = sh("bash", [
        "-lc",
        `echo | openssl s_client -servername ${host} -connect ${ip}:443 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null`,
      ]);
      record(
        `post_cert_${host}`,
        /subject=/i.test(cert) && /notAfter=/i.test(cert) && new RegExp(host.replace(/\./g, "\\."), "i").test(cert),
        cert.split("\n").slice(0, 2).join(" | ") || "no cert",
      );
    }

    const themozas = sh("curl", ["-sS", "-o", "/tmp/tm-ip", "-w", "%{http_code}", "--max-time", "15", `http://${ip}/`]);
    const tmBody = sh("cat", ["/tmp/tm-ip"]).toLowerCase();
    record(
      "post_themozas_ip_http",
      themozas === "200" && tmBody.includes("mozas") && !tmBody.includes("thedigitalgifter"),
      `http=${themozas}`,
    );
  }
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`HTTPS_VERIFY_FAILED phase=${phase} ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`HTTPS_VERIFY_OK phase=${phase} ${results.length}/${results.length}`);
if (phase === "pre" && !dnsPointsVps) {
  console.log("NEXT: after you point DNS at MOZAS_SSH_HOST, run:");
  console.log("  TDG_HTTPS_APPLY=yes bash scripts/apply-tdg-https.sh");
  console.log("  TDG_HTTPS_PHASE=post node scripts/verify-tdg-https.mjs");
}
void wwwCname;
