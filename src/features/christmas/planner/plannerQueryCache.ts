type Entry = { at: number; data: unknown };

const data = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const issued = new Map<string, number>();
let serial = 0;

/** Short enough to notice edits from another tab, long enough for module navigation. */
export const PLANNER_QUERY_TTL_MS = 60_000;

function stamp(key: string) {
  serial += 1;
  issued.set(key, serial);
  return serial;
}

export function plannerQuery<T>(key: string, loader: () => Promise<T>, ttl = PLANNER_QUERY_TTL_MS): Promise<T> {
  const hit = data.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data as T);
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const token = issued.get(key) ?? 0;
  const promise = loader()
    .then((value) => {
      if ((issued.get(key) ?? 0) === token) data.set(key, { at: Date.now(), data: value });
      inflight.delete(key);
      return value;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });
  inflight.set(key, promise);
  return promise;
}

export function peekPlannerQuery<T>(key: string, ttl = PLANNER_QUERY_TTL_MS): T | undefined {
  const hit = data.get(key);
  if (!hit || Date.now() - hit.at >= ttl) return undefined;
  return hit.data as T;
}

export function invalidatePlannerQueries(profileId?: string) {
  if (!profileId) {
    for (const key of new Set([...data.keys(), ...inflight.keys(), ...issued.keys()])) stamp(key);
    data.clear();
    inflight.clear();
    return;
  }
  const marker = `:${profileId}`;
  for (const key of new Set([...data.keys(), ...inflight.keys(), ...issued.keys()])) {
    if (key.endsWith(marker) || key.includes(`${marker}:`)) {
      stamp(key);
      data.delete(key);
      inflight.delete(key);
    }
  }
}

export function plannerListKey(kind: string, profileId: string) {
  return `${kind}:${profileId}`;
}
