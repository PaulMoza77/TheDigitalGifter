import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { get } from "node:https";
import { ffprobeFile } from "../clip-factory/ffmpeg";
import { getServiceClient } from "../christmas/supabaseClient";
import { verifyTrackLicenseEvidence, sha256File } from "./worker";

type Manifest = {
  license: string;
  licenseUrl: string;
  artist: string;
  tracks: Array<{
    slug: string;
    title: string;
    filename: string;
    mood: string;
    tags: string[];
    albumUrl: string;
    trackUrl: string;
    fileUrl: string;
  }>;
};

async function download(url: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await new Promise<void>((resolvePromise, reject) => {
    get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`download_failed_${res.statusCode}`));
        return;
      }
      pipeline(res, createWriteStream(dest)).then(resolvePromise).catch(reject);
    }).on("error", reject);
  });
}

async function fetchTrackLicenseText(trackUrl: string): Promise<string> {
  const html = await new Promise<string>((resolvePromise, reject) => {
    get(trackUrl, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk as Buffer));
      res.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    }).on("error", reject);
  });
  return html;
}

export async function importCc0ChristmasTracks(input: { dryRun?: boolean } = {}): Promise<{
  imported: number;
  skipped: number;
  tracks: Array<{ slug: string; id?: string; status: string }>;
}> {
  const manifestPath = resolve(process.cwd(), "public/assets/music/christmas/LICENSE_MANIFEST.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  const service = getServiceClient();
  const outDir = resolve(process.cwd(), "public/assets/music/christmas");
  await mkdir(join(outDir, "proofs"), { recursive: true });

  let imported = 0;
  let skipped = 0;
  const tracks: Array<{ slug: string; id?: string; status: string }> = [];

  for (const track of manifest.tracks) {
    const licenseHtml = await fetchTrackLicenseText(track.trackUrl);
    if (!verifyTrackLicenseEvidence(licenseHtml)) {
      tracks.push({ slug: track.slug, status: "blocked_unverified_license" });
      skipped += 1;
      continue;
    }

    const localPath = join(outDir, track.filename);
    if (!input.dryRun) {
      await download(track.fileUrl, localPath);
      await ffprobeFile(localPath);
    }

    const sha = input.dryRun ? createHash("sha256").update(track.fileUrl).digest("hex") : await sha256File(localPath);
    const { data: existing } = await service.from("music_tracks").select("id").eq("file_sha256", sha).maybeSingle();
    if (existing?.id) {
      tracks.push({ slug: track.slug, id: String(existing.id), status: "duplicate" });
      skipped += 1;
      continue;
    }

    const proofBody = [
      `Track: ${track.title}`,
      `Artist: ${manifest.artist}`,
      `License: ${manifest.license}`,
      `License URL: ${manifest.licenseUrl}`,
      `Album URL: ${track.albumUrl}`,
      `Track URL: ${track.trackUrl}`,
      `Recording file URL: ${track.fileUrl}`,
      `Imported: ${new Date().toISOString().slice(0, 10)}`,
      `Evidence: track page contains "CC0 1.0 Universal"`,
    ].join("\n");

    const proofPublic = `/assets/music/christmas/proofs/${track.slug}.txt`;
    if (!input.dryRun) {
      await writeFile(join(outDir, "proofs", `${track.slug}.txt`), proofBody, "utf8");
    }

    if (input.dryRun) {
      tracks.push({ slug: track.slug, status: "dry_run_ok" });
      imported += 1;
      continue;
    }

    const probe = await ffprobeFile(localPath);
    const row = {
      title: track.title,
      artist_source: manifest.artist,
      duration_seconds: probe.duration,
      genre: "christmas",
      mood: track.mood,
      source: "cc0_recorded",
      license_type: manifest.license,
      commercial_use_allowed: true,
      youtube_monetization_allowed: "yes",
      attribution_required: false,
      attribution_text: "",
      license_url: manifest.licenseUrl,
      acquisition_date: new Date().toISOString().slice(0, 10),
      proof_storage_path: proofPublic,
      proof_accessible: true,
      internal_notes: "HoliznaCC0 CC0 Christmas recording imported via christmas-reel-pipeline.",
      storage_bucket: "public",
      storage_path: `assets/music/christmas/${track.filename}`,
      filename: track.filename,
      public_src: `/assets/music/christmas/${track.filename}`,
      composition_rights: "public_domain",
      recording_rights: "public_domain",
      rights_complete: true,
      demo: false,
      editorial_status: "approved",
      file_sha256: sha,
      tags: track.tags,
      source_url: track.trackUrl,
      approved_for_autopilot: true,
      instagram_allowed: true,
      facebook_allowed: true,
      youtube_allowed: true,
      creation_record: {
        albumUrl: track.albumUrl,
        trackUrl: track.trackUrl,
        fileUrl: track.fileUrl,
        license: manifest.license,
        licenseUrl: manifest.licenseUrl,
        importedAt: new Date().toISOString(),
      },
    };

    const ins = await service.from("music_tracks").insert(row).select("id").single();
    if (ins.error) throw ins.error;
    tracks.push({ slug: track.slug, id: String(ins.data.id), status: "imported" });
    imported += 1;
  }

  return { imported, skipped, tracks };
}
