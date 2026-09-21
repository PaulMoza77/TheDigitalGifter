import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ORIGINAL_MUSIC_SEED } from "../../../src/features/long-form-studio/seedMusic";
import type { MusicTrack } from "../../../src/features/long-form-studio/types";

export type LocalState = {
  music: MusicTrack[];
  productions: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
};

const STATE_PATH = () => join(process.cwd(), "output/long-form/state.json");

export async function loadLocalState(): Promise<LocalState> {
  const path = STATE_PATH();
  if (!existsSync(path)) {
    return { music: ORIGINAL_MUSIC_SEED, productions: [], jobs: [] };
  }
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as LocalState;
    const music = raw.music?.length ? raw.music : ORIGINAL_MUSIC_SEED;
    return { music, productions: raw.productions || [], jobs: raw.jobs || [] };
  } catch {
    return { music: ORIGINAL_MUSIC_SEED, productions: [], jobs: [] };
  }
}

export async function saveLocalState(state: LocalState): Promise<void> {
  const path = STATE_PATH();
  await mkdir(join(process.cwd(), "output/long-form"), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2), "utf8");
}

export function newId(): string {
  return randomUUID();
}
