/**
 * Curl helpers for TDG origin checks.
 * HTTP redirects are inspected, then HTTPS is fetched separately
 * (with the same --resolve pin when targeting the VPS).
 */
import { execFileSync } from "node:child_process";
import {
  acceptTdgHttpOrHttps,
  httpsLocationForHost,
  parseResponseMeta,
} from "./tdg-https-fetch.mjs";

/**
 * @param {{ url: string, resolve?: string, outFile: string, extra?: string[], maxTime?: number }} p
 */
export function curlHeaders(p) {
  const args = ["-sS", "-D", "-", "-o", p.outFile, "--max-time", String(p.maxTime || 25), ...(p.extra || [])];
  if (p.resolve) args.push("--resolve", p.resolve);
  args.push(p.url);
  try {
    const headers = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 2_000_000 });
    const meta = parseResponseMeta(headers);
    const body = execFileSync("cat", [p.outFile], { encoding: "utf8" });
    return { ...meta, body, headers };
  } catch {
    return { status: 0, contentType: "", location: "", body: "", headers: "" };
  }
}

/**
 * Named production host. `ip` set = direct VPS (--resolve). `ip` empty = public DNS (no --resolve).
 *
 * @param {{ host: string, path: string, ip?: string, extra?: string[], requireHttps?: boolean }} p
 */
export function fetchTdgNamedHost(p) {
  const host = p.host;
  const path = p.path || "/";
  const slug = host.replace(/[^a-z0-9]+/gi, "_");
  const http = curlHeaders({
    url: `http://${host}${path}`,
    resolve: p.ip ? `${host}:80:${p.ip}` : "",
    outFile: `/tmp/tdg-fetch-${slug}-http.body`,
    extra: p.extra,
  });
  const loc = httpsLocationForHost(host, http.location);
  let https = { status: 0, contentType: "", location: "", body: "", headers: "" };
  if (loc) {
    const destHost = new URL(loc).hostname;
    https = curlHeaders({
      url: `https://${destHost}${path}`,
      resolve: p.ip ? `${destHost}:443:${p.ip}` : "",
      outFile: `/tmp/tdg-fetch-${slug}-https.body`,
      extra: p.extra,
    });
  }
  const accepted = acceptTdgHttpOrHttps({
    httpStatus: http.status,
    location: http.location,
    host,
    httpsStatus: https.status,
    requireHttps: Boolean(p.requireHttps),
  });
  const final = https.status ? https : http;
  return {
    http,
    https,
    redirected: Boolean(loc),
    accepted,
    final,
    scheme: https.status ? "https" : "http",
  };
}

/**
 * @param {string} host
 * @param {string} ip
 */
export function readDirectCert(host, ip) {
  try {
    return execFileSync(
      "bash",
      ["-lc", `echo | openssl s_client -servername ${host} -connect ${ip}:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates 2>/dev/null`],
      { encoding: "utf8" },
    );
  } catch {
    return "";
  }
}

/**
 * Public cert via DNS (no --resolve, no IP pin).
 * @param {string} host
 */
export function readPublicCert(host) {
  try {
    return execFileSync(
      "bash",
      ["-lc", `echo | openssl s_client -servername ${host} -connect ${host}:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates 2>/dev/null`],
      { encoding: "utf8" },
    );
  } catch {
    return "";
  }
}

/**
 * @param {string} cert
 * @param {string} host
 */
export function certLooksValid(cert, host) {
  if (!/subject=/i.test(cert) || !/notAfter=/i.test(cert)) return false;
  const escaped = host.replace(/\./g, "\\.");
  return new RegExp(escaped, "i").test(cert);
}
