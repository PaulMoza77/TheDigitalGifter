#!/usr/bin/env node
/**
 * Exit 0 only when apex + www A records point at MOZAS_SSH_HOST and AAAA is
 * empty or the VPS IPv6. Does not print IP addresses.
 */
import { execFileSync } from "node:child_process";
import { dnsPointsAtVps, parseDnsRecords } from "../deploy/lib/tdg-https-fetch.mjs";

const ip = process.env.MOZAS_SSH_HOST || process.env.MOZAS_ORIGIN_IP || "";
if (!ip) {
  console.error("BLOCKED: MOZAS_SSH_HOST missing");
  process.exit(2);
}

function dig(name, type) {
  try {
    return execFileSync("dig", ["+short", name, type], { encoding: "utf8" })
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function report(name) {
  const rec = parseDnsRecords({
    a: dig(name, "A"),
    aaaa: dig(name, "AAAA"),
    cname: dig(name, "CNAME"),
  });
  const v = dnsPointsAtVps({ ...rec, vpsIp: ip });
  const cname = rec.cname[0] || "";
  console.log(
    `${name} a=${v.aOk ? "vps" : "not_vps"} aaaa=${v.aaaaAbsent ? "absent" : v.aaaaOk ? "vps" : "other"} cname=${cname ? (/vercel/i.test(cname) ? "vercel" : "other") : "none"}`,
  );
  return v.ok;
}

const apex = report("thedigitalgifter.com");
const www = report("www.thedigitalgifter.com");
if (apex && www) {
  console.log("TDG_DNS_READY=yes");
  process.exit(0);
}
console.log("TDG_DNS_READY=no");
process.exit(1);
