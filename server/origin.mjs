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

function sendFile(res, filePath, extraHeaders = {}) {
  const stat = statSync(filePath);
  if (!stat.isFile()) return false;
  const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", String(stat.size));
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

const CHRISTMAS_LANDING_TITLE =
  "Christmas Gifts, Portraits & Santa Messages | TheDigitalGifter";
const CHRISTMAS_LANDING_DESCRIPTION =
  "Create an unforgettable Christmas: find the perfect gift, turn a photo into a Christmas portrait, send a Santa video that says their name, share a wishlist, decorate a tree, open Advent, and write a card that feels personal.";

function applyRouteMeta(html, pathname) {
  if (pathname !== "/christmas" && pathname !== "/christmas/") return html;
  let next = html.replace(/<title>[^<]*<\/title>/, `<title>${CHRISTMAS_LANDING_TITLE}</title>`);
  next = next.replace(
    /<meta(\s+)name="description"(\s+)content="[^"]*"/,
    `<meta$1name="description"$2content="${CHRISTMAS_LANDING_DESCRIPTION}"`,
  );
  next = next.replace(
    /<meta(\s+)property="og:title"(\s+)content="[^"]*"/,
    `<meta$1property="og:title"$2content="${CHRISTMAS_LANDING_TITLE}"`,
  );
  next = next.replace(
    /<meta(\s+)property="og:description"(\s+)content="[^"]*"/,
    `<meta$1property="og:description"$2content="${CHRISTMAS_LANDING_DESCRIPTION}"`,
  );
  next = next.replace(
    /<link(\s+)rel="canonical"(\s+)href="[^"]*"/,
    `<link$1rel="canonical"$2href="https://www.thedigitalgifter.com/christmas"`,
  );
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
      const extra = url.pathname.startsWith("/assets/")
        ? { "Cache-Control": "public, max-age=31536000, immutable" }
        : {};
      sendFile(res, asset, extra);
      return;
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
