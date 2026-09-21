/**
 * Private account HTML/header policy. Crawlers must not index /account/*.
 */
import { SITE_ORIGIN, normalizeSeoPath } from "./christmasSeo.mjs";

export function isPrivateAccountPath(pathname) {
  const path = normalizeSeoPath(pathname);
  return path === "/account" || path.startsWith("/account/");
}

export function applyAccountPrivacyShell(html, pathname) {
  if (!isPrivateAccountPath(pathname)) return html;

  const path = normalizeSeoPath(pathname);
  let next = String(html || "");
  const robotsRe = /<meta(\s+)name="robots"(\s+)content="[^"]*"/i;
  if (robotsRe.test(next)) {
    next = next.replace(robotsRe, `<meta$1name="robots"$2content="noindex,nofollow"`);
  } else {
    next = next.replace(
      /<\/head>/i,
      `    <meta name="robots" content="noindex,nofollow" />\n  </head>`,
    );
  }

  const canonical = `${SITE_ORIGIN}${path}`;
  const canonRe = /<link(\s+)rel="canonical"(\s+)href="[^"]*"/i;
  if (canonRe.test(next)) {
    next = next.replace(canonRe, `<link$1rel="canonical"$2href="${canonical}"`);
  }

  return next;
}
