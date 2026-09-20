export type CacheEntry<T> = { value: T; expiresAtMs: number };

export class TtlCache<T> {
  private readonly map = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expiresAtMs <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T) {
    if (this.map.size >= this.maxEntries) {
      const first = this.map.keys().next().value;
      if (typeof first === "string") this.map.delete(first);
    }
    this.map.set(key, { value, expiresAtMs: this.now() + this.ttlMs });
  }

  size() {
    return this.map.size;
  }
}

export function sleep(ms: number, wait: (ms: number) => Promise<void> = (n) => new Promise((r) => setTimeout(r, n))) {
  return wait(ms);
}

export async function withLimitedRetry<T>(opts: {
  run: (attempt: number) => Promise<T>;
  isRetryable: (error: unknown, attempt: number) => boolean;
  delaysMs: number[];
  wait?: (ms: number) => Promise<void>;
}): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt <= opts.delaysMs.length; attempt += 1) {
    try {
      return await opts.run(attempt);
    } catch (error) {
      last = error;
      if (attempt >= opts.delaysMs.length || !opts.isRetryable(error, attempt)) throw error;
      await sleep(opts.delaysMs[attempt], opts.wait);
    }
  }
  throw last;
}
