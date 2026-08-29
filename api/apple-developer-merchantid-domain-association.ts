/**
 * Serves Apple Pay domain association for Express Checkout Element.
 * Prefer STRIPE_APPLE_PAY_DOMAIN_ASSOCIATION env (exact Stripe Dashboard file contents).
 * Falls back to public/.well-known file when present.
 * Must never return SPA HTML.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const fromEnv = String(process.env.STRIPE_APPLE_PAY_DOMAIN_ASSOCIATION || "").trim();
  let body = fromEnv;
  if (!body) {
    const candidates = [
      join(process.cwd(), "public/.well-known/apple-developer-merchantid-domain-association"),
      join(process.cwd(), ".well-known/apple-developer-merchantid-domain-association"),
    ];
    for (const path of candidates) {
      if (existsSync(path)) {
        body = readFileSync(path, "utf8").trim();
        break;
      }
    }
  }

  if (
    !body ||
    body.includes("PLACEHOLDER_CONFIGURE") ||
    /<\/?html[\s>]/i.test(body) ||
    /<!doctype\s+html/i.test(body)
  ) {
    res.status(503).setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(
      "Apple Pay domain association is not configured. Set STRIPE_APPLE_PAY_DOMAIN_ASSOCIATION or place the Stripe file under public/.well-known/.",
    );
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(body);
}
