import { readFileSync, existsSync, mkdirSync, createWriteStream } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

/**
 * CC0 instrumental from repo LICENSE_MANIFEST — not a personalized vocal master.
 * Rights: HoliznaCC0 · CC0 1.0 · see public/assets/music/christmas/LICENSE_MANIFEST.json
 */
const RIGHTS = {
  license: "CC0 1.0 Universal",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  artist: "HoliznaCC0",
  provider: "licensed_fma",
  trackSlugDefault: "silent-night-lofi",
  disclaimer:
    "Product song track: licensed CC0 instrumental (HoliznaCC0 via Free Music Archive). Personalized vocals are not included in this automation path.",
};

export function instrumentalRightsMeta(slug, title) {
  return {
    ...RIGHTS,
    trackSlug: slug,
    trackTitle: title,
    commercial_rights: `${RIGHTS.license} · ${RIGHTS.artist} · ${title || slug}`,
  };
}

export function buildLyricsBrief(order) {
  const content = (order?.content || {}) || {};
  const name = String(order?.recipient_name || content.recipientName || "you").slice(0, 40);
  const dedication = String(content.dedication || "").slice(0, 200);
  const memories = Array.isArray(content.memories)
    ? content.memories.map((m) => String(m).slice(0, 80)).slice(0, 6)
    : [];
  return {
    title: `For ${name}`,
    language: "en",
    vocalStatus: "instrumental_only",
    verses: [
      `${name}, this winter carries every light you gave`,
      dedication || "For every quiet kindness when the year grew cold",
      ...memories.map((m) => m),
      "This melody is yours — instrumental until vocals are authorized",
    ].filter(Boolean),
  };
}

export async function resolveLicensedInstrumental(root, cacheDir, slug = RIGHTS.trackSlugDefault) {
  const manifestPath = resolve(root, "public/assets/music/christmas/LICENSE_MANIFEST.json");
  if (!existsSync(manifestPath)) throw new Error("license_manifest_missing");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const tracks = manifest.tracks || [];
  const pick = tracks.find((t) => t.slug === slug) || tracks[0];
  if (!pick?.fileUrl) throw new Error("license_track_missing");

  mkdirSync(cacheDir, { recursive: true });
  const dest = join(cacheDir, pick.filename || `${slug}.mp3`);
  if (!existsSync(dest)) {
    const res = await fetch(pick.fileUrl);
    if (!res.ok) throw new Error(`fma_download_${res.status}`);
    const body = res.body;
    if (!body) throw new Error("fma_empty_body");
    await pipeline(Readable.fromWeb(body), createWriteStream(dest));
  }

  const bytes = readFileSync(dest);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  return {
    localPath: dest,
    checksum,
    byteSize: bytes.length,
    meta: instrumentalRightsMeta(pick.slug, pick.title),
    manifestRef: manifestPath,
  };
}