const KEY = "tdg.planner.insight.dismissed.v1";

type Store = Record<string, string[]>;

function readAll(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function scopeKey(profileId: string, season: number): string {
  return `${season}:${profileId}`;
}

export function loadDismissedInsightIds(profileId: string, season: number): string[] {
  return readAll()[scopeKey(profileId, season)] || [];
}

export function dismissInsight(profileId: string, season: number, insightId: string): string[] {
  const all = readAll();
  const key = scopeKey(profileId, season);
  const next = Array.from(new Set([...(all[key] || []), insightId]));
  all[key] = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // private planner dismissals stay local when storage is unavailable
  }
  return next;
}
