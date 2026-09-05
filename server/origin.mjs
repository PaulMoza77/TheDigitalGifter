/**
 * TheDigitalGifter origin for Mozas VPS.
 * Serves the Vite SPA, same-origin /api handlers, sitemap, Apple Pay file.
 * /api/* never returns index.html.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { APPLE_PAY_PATH, classifyPath } from "./routes.mjs";
import { invokeVercelHandler } from "./vercel-compat.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(here, "..");
const distDir = resolve(root, "dist");
const apiDir = resolve(root, "api");
const port = Number(process.env.PORT || 8080);
const handlerCache = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function safeJoin(base, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0] || "/");
  const trimmed = decoded.replace(/^\/+/, "");
  const abs = normalize(join(base, trimmed));
  const rootWithSep = base.endsWith(sep) ? base : `${base}${sep}`;
  if (abs !== base && !abs.startsWith(rootWithSep)) return null;
  return abs;
}

function parseRange(rangeHeader, size) {
  const m = /^bytes=(\d*)-(\d*)$/i.exec(String(rangeHeader || "").trim());
  if (!m) return null;
  let start = m[1] === "" ? null : Number(m[1]);
  let end = m[2] === "" ? null : Number(m[2]);
  if (start == null && end == null) return null;
  if (start == null) {
    const suffix = end;
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    if (!Number.isFinite(start) || start < 0 || start >= size) return null;
    end = end == null || !Number.isFinite(end) ? size - 1 : Math.min(end, size - 1);
    if (end < start) return null;
  }
  return { start, end };
}

function sendFile(res, filePath, extraHeaders = {}, req = null) {
  const stat = statSync(filePath);
  if (!stat.isFile()) return false;
  const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
  const size = stat.size;
  const method = String(req?.method || "GET").toUpperCase();
  const rangeHeader = req?.headers?.range;
  const extra = { ...extraHeaders };

  // Media needs Accept-Ranges for seeking / progressive playback.
  if (type.startsWith("video/") || type.startsWith("audio/") || type === "image/jpeg" || type === "image/webp") {
    if (!extra["Accept-Ranges"]) extra["Accept-Ranges"] = "bytes";
  }

  for (const [key, value] of Object.entries(extra)) {
    res.setHeader(key, value);
  }
  res.setHeader("Content-Type", type);

  if (rangeHeader && (type.startsWith("video/") || type.startsWith("audio/"))) {
    const range = parseRange(rangeHeader, size);
    if (!range) {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${size}`);
      res.end();
      return true;
    }
    const { start, end } = range;
    const chunk = end - start + 1;
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.setHeader("Content-Length", String(chunk));
    if (method === "HEAD") {
      res.end();
      return true;
    }
    createReadStream(filePath, { start, end }).pipe(res);
    return true;
  }

  res.statusCode = 200;
  res.setHeader("Content-Length", String(size));
  if (method === "HEAD") {
    res.end();
    return true;
  }
  createReadStream(filePath).pipe(res);
  return true;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function loadHandler(moduleName) {
  if (handlerCache.has(moduleName)) return handlerCache.get(moduleName);
  const file = join(apiDir, moduleName);
  const imported = await import(pathToFileURL(file).href);
  if (typeof imported.default !== "function") {
    throw new Error(`handler_missing:${moduleName}`);
  }
  handlerCache.set(moduleName, imported.default);
  return imported.default;
}

function applePayCandidates() {
  return [
    join(distDir, ".well-known", "apple-developer-merchantid-domain-association"),
    join(root, "public", ".well-known", "apple-developer-merchantid-domain-association"),
  ];
}

async function handle(req, res) {
  const host = String(req.headers.host || "127.0.0.1");
  const url = new URL(req.url || "/", `http://${host}`);
  const classified = classifyPath(url.pathname);

  if (classified.kind === "health") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end("ok");
    return;
  }

  if (classified.kind === "api-miss") {
    sendJson(res, 404, { error: "not_found" });
    return;
  }

  if (classified.kind === "api") {
    try {
      const handler = await loadHandler(classified.module);
      await invokeVercelHandler(handler, req, res, url);
    } catch (error) {
      console.error(JSON.stringify({ source: "tdg-origin", kind: "api_error", path: url.pathname }));
      if (!res.headersSent) {
        sendJson(res, 500, { error: "handler_failed" });
      }
    }
    return;
  }

  if (classified.kind === "apple") {
    const fromEnv = String(process.env.STRIPE_APPLE_PAY_DOMAIN_ASSOCIATION || "").trim();
    if (fromEnv && !fromEnv.includes("PLACEHOLDER_CONFIGURE")) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.end(fromEnv);
      return;
    }
    for (const candidate of applePayCandidates()) {
      if (existsSync(candidate) && sendFile(res, candidate, {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      }, req)) {
        return;
      }
    }
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("not found");
    return;
  }

  if (String(req.method || "GET").toUpperCase() === "HEAD" || String(req.method || "GET").toUpperCase() === "GET") {
    const asset = safeJoin(distDir, url.pathname);
    if (asset && existsSync(asset) && statSync(asset).isFile()) {
      let extra = {};
      if (url.pathname.startsWith("/assets/")) {
        // Vite fingerprinted bundles
        extra = { "Cache-Control": "public, max-age=31536000, immutable" };
      } else if (url.pathname.startsWith("/christmas/gifts/")) {
        // Versioned via ?v= content stamp in giftTreeMedia.ts
        const hasVersion = url.searchParams.has("v");
        extra = {
          "Cache-Control": hasVersion
            ? "public, max-age=31536000, immutable"
            : "public, max-age=86400",
          "Accept-Ranges": "bytes",
        };
      }
      sendFile(res, asset, extra, req);
      return;
    }
    const index = join(distDir, "index.html");
    if (existsSync(index)) {
      sendFile(res, index, { "Cache-Control": "no-cache" }, req);
      return;
    }
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("not found");
}

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(JSON.stringify({ source: "tdg-origin", kind: "unhandled" }));
    if (!res.headersSent) sendJson(res, 500, { error: "origin_failed" });
    void error;
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ source: "tdg-origin", listening: port, dist: existsSync(distDir) }));
});
