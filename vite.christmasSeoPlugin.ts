/**
 * After Vite build, emit per-route index.html files with Christmas SEO injected.
 * Emits crawlable HTML for static hosts without relying only on origin.mjs.
 */
import type { Plugin } from "vite";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
// Shared runtime registry is authored as plain ESM and validated by its own tests.
// @ts-expect-error JavaScript module has no colocated TypeScript declaration.
import { applyChristmasSeo, listChristmasSeoPaths } from "./server/christmasSeo.mjs";

export function christmasSeoPrerenderPlugin(): Plugin {
  return {
    name: "christmas-seo-prerender",
    apply: "build",
    closeBundle() {
      const distDir = join(process.cwd(), "dist");
      const indexPath = join(distDir, "index.html");
      if (!existsSync(indexPath)) {
        console.warn("[christmas-seo-prerender] dist/index.html missing; skip");
        return;
      }
      const baseHtml = readFileSync(indexPath, "utf8");
      const paths = listChristmasSeoPaths();
      for (const routePath of paths) {
        const html = applyChristmasSeo(baseHtml, routePath);
        const outFile =
          routePath === "/"
            ? indexPath
            : join(distDir, routePath.replace(/^\//, ""), "index.html");
        mkdirSync(dirname(outFile), { recursive: true });
        writeFileSync(outFile, html);
      }
      console.log(
        `[christmas-seo-prerender] wrote ${paths.length} Christmas SEO HTML shells`,
      );
    },
  };
}
