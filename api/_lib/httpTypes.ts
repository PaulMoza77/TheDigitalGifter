/**
 * Node HTTP types formerly provided by `@vercel/node`.
 * Handlers keep the same shape; `server/vercel-compat.mjs` adapts them on Mozas.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

export type VercelRequest = IncomingMessage & {
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
  cookies?: Record<string, string>;
};

export type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => VercelResponse;
  send: (body?: unknown) => VercelResponse;
};
