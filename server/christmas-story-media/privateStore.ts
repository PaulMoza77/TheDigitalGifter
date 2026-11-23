/**
 * Isolated private media store for Mission 02F authorization E2E.
 * HMAC-signed short-lived URLs. No public fallback. Order-scoped paths only.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type PrivateBucket = "christmas-story-source" | "christmas-story-generated";

export type SignActor = "buyer" | "recipient" | "admin" | "worker";

export type PrivateObject = {
  bucket: PrivateBucket;
  path: string;
  contentType: string;
  byteSize: number;
  checksumSha256?: string;
};

function assertOrderScoped(orderId: string, path: string) {
  if (!orderId || !path.startsWith(`${orderId}/`)) {
    throw new Error("path_not_order_scoped");
  }
  if (path.includes("..") || path.includes("\\")) {
    throw new Error("path_escape_forbidden");
  }
}

export class PrivateMediaStore {
  readonly root: string;
  readonly signingSecret: string;

  constructor(root: string, signingSecret: string) {
    if (!signingSecret || signingSecret.length < 32) {
      throw new Error("signing_secret_too_short");
    }
    this.root = resolve(root);
    this.signingSecret = signingSecret;
    mkdirSync(this.root, { recursive: true });
  }

  private diskPath(bucket: PrivateBucket, path: string) {
    const full = resolve(join(this.root, bucket, path));
    if (!full.startsWith(resolve(join(this.root, bucket)))) {
      throw new Error("path_escape_forbidden");
    }
    return full;
  }

  put(
    orderId: string,
    bucket: PrivateBucket,
    relativePath: string,
    bytes: Buffer,
    contentType: string,
  ): PrivateObject {
    assertOrderScoped(orderId, relativePath);
    const disk = this.diskPath(bucket, relativePath);
    mkdirSync(dirname(disk), { recursive: true });
    writeFileSync(disk, bytes);
    return {
      bucket,
      path: relativePath,
      contentType,
      byteSize: bytes.length,
    };
  }

  exists(bucket: PrivateBucket, path: string): boolean {
    return existsSync(this.diskPath(bucket, path));
  }

  /** Issue a short-lived signed playback token (not a public URL). */
  sign(
    orderId: string,
    obj: PrivateObject,
    actor: SignActor,
    ttlSec = 120,
  ): { token: string; expiresAt: number; expiresIn: number } {
    assertOrderScoped(orderId, obj.path);
    if (!this.exists(obj.bucket, obj.path)) throw new Error("object_missing");
    const ttl = Math.max(30, Math.min(900, ttlSec));
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;
    const nonce = randomBytes(8).toString("hex");
    const payload = `${obj.bucket}|${obj.path}|${orderId}|${actor}|${expiresAt}|${nonce}`;
    const sig = createHmac("sha256", this.signingSecret).update(payload).digest("hex");
    const token = Buffer.from(`${payload}|${sig}`).toString("base64url");
    return { token, expiresAt, expiresIn: ttl };
  }

  /** Redeem a signed token → bytes. Fails closed. */
  redeem(token: string, expectedOrderId?: string): {
    bytes: Buffer;
    meta: PrivateObject & { orderId: string; actor: SignActor; expiresAt: number };
  } {
    let decoded: string;
    try {
      decoded = Buffer.from(token, "base64url").toString("utf8");
    } catch {
      throw new Error("token_invalid");
    }
    const parts = decoded.split("|");
    if (parts.length !== 7) throw new Error("token_invalid");
    const [bucket, path, orderId, actor, expStr, nonce, sig] = parts as [
      PrivateBucket,
      string,
      string,
      SignActor,
      string,
      string,
      string,
    ];
    const expiresAt = Number(expStr);
    if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
      throw new Error("token_expired");
    }
    if (expectedOrderId && expectedOrderId !== orderId) {
      throw new Error("token_order_mismatch");
    }
    assertOrderScoped(orderId, path);
    const payload = `${bucket}|${path}|${orderId}|${actor}|${expiresAt}|${nonce}`;
    const expect = createHmac("sha256", this.signingSecret).update(payload).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expect);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("token_signature_invalid");
    }
    if (!this.exists(bucket, path)) throw new Error("object_missing");
    const disk = this.diskPath(bucket, path);
    const bytes = readFileSync(disk);
    return {
      bytes,
      meta: {
        bucket,
        path,
        orderId,
        actor,
        expiresAt,
        contentType: "application/octet-stream",
        byteSize: statSync(disk).size,
      },
    };
  }
}

/** Pure authorization decision used by Edge + local E2E. */
export function authorizeMediaAccess(input: {
  assetOrderId: string;
  storagePath: string;
  buyerOrderId?: string | null;
  recipientGrant?: { orderId: string; enabled: boolean; revokedAt: string | null } | null;
}): { allowed: boolean; actor: SignActor | null; code?: string } {
  if (!input.storagePath.startsWith(`${input.assetOrderId}/`)) {
    return { allowed: false, actor: null, code: "path_not_order_scoped" };
  }
  if (input.buyerOrderId && input.buyerOrderId === input.assetOrderId) {
    return { allowed: true, actor: "buyer" };
  }
  const g = input.recipientGrant;
  if (
    g &&
    g.orderId === input.assetOrderId &&
    g.enabled &&
    !g.revokedAt
  ) {
    return { allowed: true, actor: "recipient" };
  }
  return { allowed: false, actor: null, code: "forbidden" };
}
