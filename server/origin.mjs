/**
 * TheDigitalGifter origin for Mozas VPS.
 * Serves the Vite SPA, same-origin /api handlers, sitemap, Apple Pay file.
 * /api/* never returns index.html.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { APPLE_PAY_PATH, classifyPath } from "./routes.mjs";
import { invokeVercelHandler } from "./vercel-compat.mjs";
import { applyChristmasSeo } from "./christmasSeo.mjs";
import {
  applyChristmasNoindexShell,
  buildApexToWwwLocation,
  buildChristmasRedirectLocation,
  buildTrailingSlashRedirect,
  getChristmasPermanentRedirectTarget,
  should404UnknownChristmasPath,
} from "./christmasIndexing.mjs";

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
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

function safeJoin(base, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0] || "/");
  const trimmed = decoded.replace(/^\/+/, "");
  const abs = normalize(join(base, trimmed));
  const rootWithSep = base.endsWith(sep) ? base : `${base}${sep}`;
  if (abs !== base && !abs.startsWith(rootWithSep)) return null;
  return abs;
}

function cacheHeadersFor(pathname) {
  if (pathname.startsWith("/assets/")) {
    return { "Cache-Control": "public, max-age=31536000, immutable" };
  }
  // Christmas cabin media uses ?v= cache-bust; cache aggressively once fetched.
  if (
    pathname.startsWith("/christmas/") &&
    /\.(webp|jpg|jpeg|png|mp4|webm|gif)$/i.test(pathname)
  ) {
    return { "Cache-Control": "public, max-age=31536000, immutable" };
  }
  if (pathname.startsWith("/pet/") && /\.(webp|jpg|jpeg|png|mp4)$/i.test(pathname)) {
    return { "Cache-Control": "public, max-age=604800" };
  }
  return {};
}

function sendFile(res, filePath, extraHeaders = {}, req = null) {
  const stat = statSync(filePath);
  if (!stat.isFile()) return false;
  const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
  const size = stat.size;
  const isMedia = type.startsWith("video/") || type.startsWith("audio/");

  // Progressive media: honor Range so the cabin loop can start without waiting for the full file.
  if (isMedia && req) {
    const range = String(req.headers.range || "");
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : size - 1;
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < size) {
        const safeEnd = Math.min(end, size - 1);
        res.statusCode = 206;
        res.setHeader("Content-Type", type);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Range", `bytes ${start}-${safeEnd}/${size}`);
        res.setHeader("Content-Length", String(safeEnd - start + 1));
        for (const [key, value] of Object.entries(extraHeaders)) {
          res.setHeader(key, value);
        }
        createReadStream(filePath, { start, end: safeEnd }).pipe(res);
        return true;
      }
    }
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", String(size));
  if (isMedia) res.setHeader("Accept-Ranges", "bytes");
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value);
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

function sendRedirect(res, status, location) {
  res.statusCode = status;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.end();
}

/** Route-aware Christmas SEO head + semantic body shell for crawlers. */
function applyRouteMeta(html, pathname) {
  let next = applyChristmasSeo(html, pathname);
  next = applyChristmasNoindexShell(next, pathname);
  return next;
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
  const method = String(req.method || "GET").toUpperCase();

  // Apex → www (canonical host). Skip for localhost / IP / health probes.
  if (method === "GET" || method === "HEAD") {
    const apexLoc = buildApexToWwwLocation(host, url.pathname, url.search);
    if (apexLoc) {
      sendRedirect(res, 301, apexLoc);
      return;
    }

    const slashLoc = buildTrailingSlashRedirect(url.pathname, url.search);
    if (slashLoc) {
      // Relative Location is fine; prefer absolute www when Host is www.
      const hostname = host.split(":")[0].toLowerCase();
      const location =
        hostname === "www.thedigitalgifter.com" || hostname === "thedigitalgifter.com"
          ? `https://www.thedigitalgifter.com${slashLoc}`
          : slashLoc;
      sendRedirect(res, 301, location);
      return;
    }

    if (getChristmasPermanentRedirectTarget(url.pathname)) {
      const location = buildChristmasRedirectLocation(url.pathname, url.search);
      if (location) {
        sendRedirect(res, 301, location);
        return;
      }
    }
  }

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
      console.error(
        JSON.stringify({
          source: "tdg-origin",
          kind: "api_error",
          path: url.pathname,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
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
      })) {
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
      const extra = cacheHeadersFor(url.pathname);
      sendFile(res, asset, extra, req);
      return;
    }

    if (should404UnknownChristmasPath(url.pathname)) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.end(
        "<!doctype html><html><head><title>Not found</title><meta name=\"robots\" content=\"noindex,follow\" /></head><body><h1>Not found</h1><p><a href=\"/christmas\">Christmas at TheDigitalGifter</a></p></body></html>",
      );
      return;
    }

    // Prefer prerendered Christmas SEO shells: /christmas/family → dist/christmas/family/index.html
    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
    if (normalizedPath !== "/") {
      const nestedIndex = safeJoin(distDir, `${normalizedPath}/index.html`);
      if (nestedIndex && existsSync(nestedIndex) && statSync(nestedIndex).isFile()) {
        // Re-apply meta so noindex/canonical policy stays current even if dist is slightly stale.
        const html = applyRouteMeta(readFileSync(nestedIndex, "utf8"), url.pathname);
        const body = Buffer.from(html);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Content-Length", String(body.length));
        res.end(body);
        return;
      }
    }
    const index = join(distDir, "index.html");
    if (existsSync(index)) {
      const html = applyRouteMeta(readFileSync(index, "utf8"), url.pathname);
      const body = Buffer.from(html);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Content-Length", String(body.length));
      res.end(body);
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
