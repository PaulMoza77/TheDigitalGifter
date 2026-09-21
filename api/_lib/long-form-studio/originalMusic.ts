import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { runCommand } from "../clip-factory/ffmpeg";

type PadSpec = { freqs: number[]; tremolo: number; bells: number[]; duration: number };

const SPECS: Record<string, PadSpec> = {
  "hearth_glow.m4a": { freqs: [130.81, 196, 261.63, 329.63], tremolo: 0.07, bells: [523.25, 659.25], duration: 180 },
  "ember_lounge.m4a": { freqs: [146.83, 220, 293.66, 349.23], tremolo: 0.11, bells: [440, 587.33], duration: 180 },
  "snowfall_keys.m4a": { freqs: [174.61, 220, 261.63, 392], tremolo: 0.04, bells: [523.25, 698.46, 783.99], duration: 180 },
  "wreath_carol_air.m4a": { freqs: [196, 246.94, 293.66, 392], tremolo: 0.05, bells: [523.25, 587.33, 784], duration: 180 },
  "window_quiet.m4a": { freqs: [110, 164.81, 220, 261.63], tremolo: 0.03, bells: [392], duration: 180 },
  "sleeping_embers.m4a": { freqs: [98, 146.83, 196, 246.94], tremolo: 0.02, bells: [329.63], duration: 240 },
};

function expr(spec: PadSpec): string {
  const pads = spec.freqs.map((f, i) => {
    const amp = (0.07 - i * 0.008).toFixed(3);
    return `${amp}*sin(2*PI*${f}*t)*(1+${spec.tremolo}*sin(2*PI*${0.04 + i * 0.01}*t))`;
  });
  const bells = spec.bells.map((f, i) => {
    const period = 11 + i * 3;
    return `0.028*sin(2*PI*${f}*t)*max(0,1-mod(t+${i * 1.7},${period})/1.8)`;
  });
  return [...pads, ...bells].join("+");
}

export function originalMusicDirectory(root = process.cwd()): string {
  return join(root, "public/assets/long-form/music");
}

export async function ensureOriginalMusicFile(filename: string, root = process.cwd()): Promise<string> {
  const spec = SPECS[filename];
  if (!spec) throw new Error(`No original music recipe for ${filename}`);
  const dir = originalMusicDirectory(root);
  await mkdir(dir, { recursive: true });
  const dest = join(dir, filename);
  if (existsSync(dest)) return dest;
  const lavfi = `aevalsrc=exprs='${expr(spec)}':s=44100:d=${spec.duration}`;
  await runCommand(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", lavfi, "-c:a", "aac", "-b:a", "160k", "-ac", "2", dest],
    120_000,
  );
  return dest;
}

export async function ensureAllOriginalMusic(root = process.cwd()): Promise<string[]> {
  const files = Object.keys(SPECS);
  const out: string[] = [];
  for (const file of files) out.push(await ensureOriginalMusicFile(file, root));
  await writeFile(
    join(originalMusicDirectory(root), "PROVENANCE.txt"),
    [
      "TDG original music for Long-Form Studio.",
      "Composition and recording owned by The Digital Gifter.",
      "Not sourced from YouTube, not a recording of a third-party Christmas master.",
      `Created ${new Date().toISOString().slice(0, 10)}.`,
    ].join("\n"),
    "utf8",
  );
  return out;
}

export function isOriginalMusicFilename(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(SPECS, name);
}
