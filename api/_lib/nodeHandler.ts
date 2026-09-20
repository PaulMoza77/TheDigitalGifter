/**
 * Neutral Node/VPS request/response types for same-origin /api handlers.
 * Replaces @vercel/node types used by the historical serverless adapters.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

export type NodeApiRequest = IncomingMessage & {
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
  cookies?: Record<string, string>;
};

export type NodeApiResponse = ServerResponse & {
  status(code: number): NodeApiResponse;
  json(body: unknown): NodeApiResponse;
  send(body?: unknown): NodeApiResponse;
};

/** Keep background work from crashing the handler; VPS has no waitUntil runtime. */
export function waitUntil(task: Promise<unknown>): void {
  void Promise.resolve(task).catch(() => undefined);
}

export function isAllowedAppHostname(hostname: string): boolean {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host === "thedigitalgifter.com" || host.endsWith(".thedigitalgifter.com")) return true;
  if (String(process.env.TDG_ALLOW_LEGACY_PREVIEW_ORIGINS || "").trim() === "1") {
    return host.endsWith(".vercel.app");
  }
  return false;
}

export function runtimeEnvironment(): "production" | "preview" | "development" {
  const named = String(process.env.TDG_ENV || process.env.MOZAS_ENV || "")
    .trim()
    .toLowerCase();
  if (named === "production" || named === "prod") return "production";
  if (named === "preview" || named === "staging") return "preview";
  const node = String(process.env.NODE_ENV || "").toLowerCase();
  if (node === "production") return "production";
  return "development";
}
