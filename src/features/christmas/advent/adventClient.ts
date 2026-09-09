const OPENED_KEY = "tdg.christmas.advent.opened.v1";
const MUTE_KEY = "tdg.christmas.advent.mute.v1";

export function loadOpenedDoors(seasonYear: number): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(`${OPENED_KEY}:${seasonYear}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as number[];
    return new Set(parsed.filter((n) => Number.isInteger(n) && n >= 1 && n <= 24));
  } catch {
    return new Set();
  }
}

export function persistOpenedDoor(seasonYear: number, day: number): void {
  if (typeof window === "undefined") return;
  try {
    const next = loadOpenedDoors(seasonYear);
    next.add(day);
    window.localStorage.setItem(`${OPENED_KEY}:${seasonYear}`, JSON.stringify([...next]));
  } catch {
    // ignore quota / private mode
  }
}

export function loadMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // ignore
  }
}

/** Soft bell-like chime via Web Audio — only after user gesture. */
export function playDoorChime(muted: boolean): void {
  if (muted || typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.08;
    master.connect(ctx.destination);

    for (const [freq, delay, dur] of [
      [880, 0, 0.35],
      [1174, 0.05, 0.4],
      [1568, 0.12, 0.45],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.7, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.05);
    }
    window.setTimeout(() => void ctx.close(), 900);
  } catch {
    // Audio optional
  }
}

/** Parse ?sim=YYYY-MM-DD for visual date-state testing (client calendar only). */
export function parseSimDate(search: string): Date | null {
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    const sim = params.get("sim");
    if (!sim || !/^\d{4}-\d{2}-\d{2}$/.test(sim)) return null;
    // Noon Bucharest-ish to avoid DST edge flips for day parts.
    return new Date(`${sim}T12:00:00+02:00`);
  } catch {
    return null;
  }
}
