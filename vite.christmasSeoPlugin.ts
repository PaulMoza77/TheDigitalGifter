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
        let html = applyChristmasSeo(baseHtml, routePath);
        if (/\/christmas\/photo-generator$/.test(routePath)) {
          const manifestPath = join(distDir, ".vite/manifest.json");
          if (existsSync(manifestPath)) {
            const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
            const visited = new Set<string>();
            const hints = new Set<string>();
            const visit = (key: string) => {
              if (visited.has(key)) return;
              visited.add(key);
              const chunk = manifest[key];
              if (!chunk) return;
              if (chunk.file?.endsWith(".js")) hints.add(`<link rel="modulepreload" crossorigin href="/${chunk.file}">`);
              for (const css of chunk.css || []) hints.add(`<link rel="stylesheet" href="/${css}">`);
              for (const dep of chunk.imports || []) visit(dep);
            };
            visit("src/features/christmas/ChristmasPhotoGeneratorPage.tsx");
            for (const image of ["photo-to-video/family-before.jpeg"]) hints.add(`<link rel="preload" as="image" href="/assets/christmas/${image}" fetchpriority="high">`);
            html = html.replace("</head>", [...hints].join("\n") + "</head>");
          }
        }
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
