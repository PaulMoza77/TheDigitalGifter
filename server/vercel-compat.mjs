/**
 * Minimal Vercel Node (req, res) adapter for the Mozas origin.
 * Never logs bodies or secret headers.
 */
import { Buffer } from "node:buffer";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const err = new Error("payload_too_large");
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return { body: {}, raw: "", bytes: 0 };
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return { body: {}, raw, bytes: Buffer.byteLength(raw) };
  try {
    return { body: JSON.parse(raw), raw, bytes: Buffer.byteLength(raw) };
  } catch {
    const err = new Error("malformed_json");
    err.statusCode = 400;
    throw err;
  }
}

export function queryFromUrl(url) {
  const out = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key in out) {
      const current = out[key];
      out[key] = Array.isArray(current) ? [...current, value] : [current, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function decorateResponse(res) {
  if (typeof res.status !== "function") {
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
  }
  if (typeof res.json !== "function") {
    res.json = (payload) => {
      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      res.end(JSON.stringify(payload));
      return res;
    };
  }
  if (typeof res.send !== "function") {
    res.send = (payload) => {
      if (payload == null) {
        res.end();
        return res;
      }
      if (typeof payload === "object" && !Buffer.isBuffer(payload)) {
        if (!res.getHeader("Content-Type")) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
        }
        res.end(JSON.stringify(payload));
        return res;
      }
      res.end(payload);
      return res;
    };
  }
  return res;
}

export async function invokeVercelHandler(handler, req, res, url) {
  decorateResponse(res);
  req.query = queryFromUrl(url);
  const method = String(req.method || "GET").toUpperCase();
  const contentType = String(req.headers["content-type"] || "");
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    if (contentType.includes("application/json") || contentType.includes("text/plain") || !contentType) {
      try {
        const parsed = await readJsonBody(req);
        req.body = parsed.body;
      } catch (error) {
        const status = error.statusCode || 400;
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: error.message || "bad_request" }));
        return;
      }
    } else {
      req.body = {};
    }
  } else {
    req.body = {};
  }
  await handler(req, res);
}
