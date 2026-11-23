#!/usr/bin/env node
/**
 * Professional asset-import workflow for demo / staging photographic packs.
 *
 * Usage:
 *   node scripts/christmas-story-02e/import-demo-photos.mjs \
 *     --from /absolute/path/to/licensed-pack \
 *     --license "Purchase order PO-123 / commercial sync OK" \
 *     --source "vendor-name"
 *
 * Never invent provenance. Rejects free/trial wording. Does not scrape the web.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { extname, join, resolve } from "node:path";
import { readFileSync } from "node:fs";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  return i >= 0 ? String(process.argv[i + 1] || "") : fallback;
}

const fromDir = resolve(arg("--from"));
const license = arg("--license");
const source = arg("--source", "operator_import");
const outDir = resolve(process.cwd(), "public/assets/christmas-story-demo/stills");

if (!fromDir || !existsSync(fromDir)) {
  console.error("usage: --from /path/to/pack --license \"...\" [--source name]");
  process.exit(1);
}
if (license.length < 12) {
  console.error("license_evidence_required");
  process.exit(1);
}
if (/free|trial|unofficial/i.test(license)) {
  console.error("commercial_rights_required");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const files = readdirSync(fromDir)
  .filter((f) => [".jpg", ".jpeg", ".png", ".webp"].includes(extname(f).toLowerCase()))
  .sort();

if (files.length < 6 || files.length > 10) {
  console.error("photo_count_invalid: need 6–10 images, got", files.length);
  process.exit(1);
}

const stills = [];
files.forEach((file, i) => {
  const src = join(fromDir, file);
  const buf = readFileSync(src);
  if (buf.length < 8) throw new Error("empty_file");
  // JPEG or PNG magic
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const png = buf[0] === 0x89 && buf[1] === 0x50;
  if (!jpeg && !png) throw new Error(`magic_invalid:${file}`);
  const name = `${String(i + 1).padStart(2, "0")}-${file.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase()}`;
  const dest = join(outDir, name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") ? name : `${name}.jpg`);
  copyFileSync(src, dest);
  stills.push({
    file: `/assets/christmas-story-demo/stills/${dest.split("/").pop()}`,
    caption: file.replace(extname(file), ""),
    source,
    license,
    photographic: true,
    provenance: "operator_import",
    sha256: createHash("sha256").update(buf).digest("hex"),
    bytes: statSync(dest).size,
  });
});

const manifest = {
  kind: "imported_demo_photographic_stills",
  importedAt: new Date().toISOString(),
  source,
  license,
  note: "Operator-imported pack for fictional demo / staging. Rebuild film after import.",
  stills,
};
writeFileSync(join(outDir, "MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ ok: true, count: stills.length, outDir }, null, 2));
console.log("Next: node --experimental-strip-types scripts/christmas-story-02e/build-premium-demo.mjs");
