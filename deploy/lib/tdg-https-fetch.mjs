/**
 * HTTP→HTTPS cutover helpers.
 *
 * Never follow an HTTP redirect from a --resolve :80 pin onto public :443 —
 * that would hit stale DNS (Vercel) instead of the VPS.
 */

const TDG_HOSTS = new Set(["thedigitalgifter.com", "www.thedigitalgifter.com"]);

/**
 * @param {string} host
 * @param {string | null | undefined} location
 * @returns {string | null} absolute https URL if the Location is a valid TDG HTTPS hop
 */
export function httpsLocationForHost(host, location) {
  const loc = String(location || "").trim();
  if (!loc) return null;
  try {
    const u = new URL(loc, `https://${host}/`);
    if (u.protocol !== "https:") return null;
    const name = u.hostname.toLowerCase();
    const want = String(host).toLowerCase();
    if (name === want) return u.toString();
    if (TDG_HOSTS.has(name) && TDG_HOSTS.has(want)) return u.toString();
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {number} status
 * @param {string | null | undefined} location
 * @param {string} host
 */
export function isHttpToHttpsRedirect(status, location, host) {
  return status >= 301 && status < 400 && Boolean(httpsLocationForHost(host, location));
}

/**
 * Accept either plain HTTP 200 (pre-HTTPS Caddy) or HTTP 3xx → HTTPS 200.
 * When requireHttps is true, a bare HTTP 200 is a failure.
 *
 * @param {{
 *   httpStatus: number,
 *   location?: string | null,
 *   host: string,
 *   httpsStatus?: number | null,
 *   requireHttps?: boolean,
 * }} p
 */
export function acceptTdgHttpOrHttps(p) {
  const redirected = isHttpToHttpsRedirect(p.httpStatus, p.location, p.host);
  if (redirected) return Number(p.httpsStatus) === 200;
  if (p.requireHttps) return false;
  return Number(p.httpStatus) === 200;
}

/**
 * @param {{ a?: string[], aaaa?: string[], cname?: string[] }} rec
 */
export function parseDnsRecords(rec = {}) {
  const a = (rec.a || []).map((x) => x.trim()).filter((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
  const aaaa = (rec.aaaa || []).map((x) => x.trim()).filter((x) => x.includes(":"));
  const cname = (rec.cname || []).map((x) => x.trim()).filter((x) => /[A-Za-z]/.test(x));
  return { a, aaaa, cname };
}

/**
 * A must be exactly the VPS IPv4. AAAA must be empty (preferred for first ACME)
 * or exactly the VPS IPv6. A CNAME to Vercel is not on-VPS.
 *
 * @param {{ a: string[], aaaa: string[], vpsIp: string, vpsIpv6?: string }} p
 */
export function dnsPointsAtVps(p) {
  const vpsIp = String(p.vpsIp || "").trim();
  const vpsIpv6 = String(p.vpsIpv6 || "").trim();
  const aOk = Boolean(vpsIp) && p.a.length > 0 && p.a.every((x) => x === vpsIp);
  const aaaaAbsent = p.aaaa.length === 0;
  const aaaaOk = aaaaAbsent || (Boolean(vpsIpv6) && p.aaaa.every((x) => x === vpsIpv6));
  return { aOk, aaaaOk, aaaaAbsent, ok: aOk && aaaaOk };
}

/**
 * Last HTTP status line wins (in case of 100-continue).
 * @param {string} headers
 */
export function parseResponseMeta(headers) {
  let status = 0;
  let contentType = "";
  let location = "";
  for (const line of String(headers || "").split(/\r?\n/)) {
    if (line.startsWith("HTTP/")) {
      const parts = line.split(/\s+/);
      if (parts[1] && /^\d+$/.test(parts[1])) status = Number(parts[1]);
    }
    const lower = line.toLowerCase();
    if (lower.startsWith("content-type:")) contentType = line.split(":").slice(1).join(":").trim();
    if (lower.startsWith("location:")) location = line.split(":").slice(1).join(":").trim();
  }
  return { status, contentType, location };
}
