/**
 * Apple StoreKit 2 transaction parsing for Deno Edge Functions.
 *
 * The client JWS is never authoritative. The grant path must re-fetch the
 * transaction from Apple's authenticated App Store Server API before using it.
 * Does not log signed payloads or private keys.
 */

import { importX509, jwtVerify, type JWTPayload } from "https://deno.land/x/jose@v5.9.6/index.ts";

export type AppleIapEnvironment = "Sandbox" | "Production" | "Xcode";

export type VerifiedAppleTransaction = {
  transactionId: string;
  originalTransactionId: string | null;
  productId: string;
  bundleId: string;
  environment: AppleIapEnvironment;
  purchaseDate: Date | null;
  appAccountToken: string | null;
  revocationDate: Date | null;
  revocationReason: string | null;
  type: string | null;
};

function pemFromDerBase64(derB64: string): string {
  const lines = derB64.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----`;
}

function decodeJwtPart(part: string): Record<string, unknown> {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((part.length + 3) % 4);
  const json = atob(padded);
  return JSON.parse(json) as Record<string, unknown>;
}

async function importLeafSigningKey(x5c: string[]): Promise<CryptoKey> {
  if (!Array.isArray(x5c) || x5c.length < 1) {
    throw new Error("missing_x5c");
  }
  // This validates JWS integrity only. Trust is established by the mandatory
  // authenticated App Store Server API lookup in verify-apple-purchase.
  return await importX509(pemFromDerBase64(x5c[0]), "ES256");
}

function msToDate(value: unknown): Date | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n);
}

function normalizeEnvironment(value: unknown): AppleIapEnvironment {
  const v = String(value || "").trim().toLowerCase();
  if (v === "xcode") return "Xcode";
  if (v === "sandbox") return "Sandbox";
  if (v === "production") return "Production";
  throw new Error("invalid_environment");
}

/** Opt-in for Xcode StoreKit Testing grants (not in App Store Server API). */
export function allowXcodeIapGrants(): boolean {
  const raw = String(Deno.env.get("ALLOW_XCODE_IAP_GRANTS") || "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Map Xcode → Sandbox for grant_apple_iap_credits / ledger environment. */
export function grantEnvironment(
  env: AppleIapEnvironment
): "Sandbox" | "Production" {
  return env === "Production" ? "Production" : "Sandbox";
}

export async function verifyAppleTransactionJws(
  jws: string,
  expectedBundleId: string
): Promise<VerifiedAppleTransaction> {
  const trimmed = String(jws || "").trim();
  if (!trimmed || trimmed.split(".").length !== 3) {
    throw new Error("invalid_jws");
  }

  const [headerB64] = trimmed.split(".");
  const header = decodeJwtPart(headerB64);
  const x5c = header.x5c as string[] | undefined;
  const key = await importLeafSigningKey(x5c || []);

  const { payload } = await jwtVerify(trimmed, key, {
    algorithms: ["ES256"],
  });

  return mapPayload(payload, expectedBundleId);
}

function mapPayload(
  payload: JWTPayload,
  expectedBundleId: string
): VerifiedAppleTransaction {
  const p = payload as Record<string, unknown>;
  const bundleId = String(p.bundleId || "").trim();
  if (!bundleId || bundleId !== expectedBundleId) {
    throw new Error("bundle_mismatch");
  }

  const transactionId = String(p.transactionId || "").trim();
  const productId = String(p.productId || "").trim();
  if (!transactionId || !productId) {
    throw new Error("missing_transaction_fields");
  }

  const revocationDate = msToDate(p.revocationDate);
  if (revocationDate) {
    throw new Error("transaction_revoked");
  }

  return {
    transactionId,
    originalTransactionId: String(p.originalTransactionId || "").trim() || null,
    productId,
    bundleId,
    environment: normalizeEnvironment(p.environment),
    purchaseDate: msToDate(p.purchaseDate),
    appAccountToken: String(p.appAccountToken || "").trim() || null,
    revocationDate: null,
    revocationReason: p.revocationReason != null ? String(p.revocationReason) : null,
    type: p.type != null ? String(p.type) : null,
  };
}

/**
 * Mandatory authoritative lookup via App Store Server API.
 * The caller must not grant credits if this lookup fails.
 */
export async function fetchAppleTransactionViaApi(
  transactionId: string,
  environment: "Sandbox" | "Production"
): Promise<VerifiedAppleTransaction> {
  const issuerId = Deno.env.get("APPLE_IAP_ISSUER_ID")?.trim();
  const keyId = Deno.env.get("APPLE_IAP_KEY_ID")?.trim();
  const privateKey = Deno.env.get("APPLE_IAP_PRIVATE_KEY")?.trim();
  const bundleId = Deno.env.get("APPLE_BUNDLE_ID")?.trim();
  if (!issuerId || !keyId || !privateKey || !bundleId) {
    throw new Error("apple_api_secrets_missing");
  }

  const { SignJWT, importPKCS8 } = await import("https://deno.land/x/jose@v5.9.6/index.ts");
  const key = await importPKCS8(privateKey.replace(/\\n/g, "\n"), "ES256");
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ bid: bundleId })
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(issuerId)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 20)
    .setAudience("appstoreconnect-v1")
    .sign(key);

  const host =
    environment === "Sandbox"
      ? "https://api.storekit-sandbox.itunes.apple.com"
      : "https://api.storekit.itunes.apple.com";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(
      `${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    if (environment === "Production" && res.status === 404) {
      return await fetchAppleTransactionViaApi(transactionId, "Sandbox");
    }
    throw new Error(`apple_api_${res.status}`);
  }

  const body = (await res.json()) as { signedTransactionInfo?: string };
  if (!body.signedTransactionInfo) throw new Error("apple_api_missing_jws");
  return await verifyAppleTransactionJws(body.signedTransactionInfo, bundleId);
}
