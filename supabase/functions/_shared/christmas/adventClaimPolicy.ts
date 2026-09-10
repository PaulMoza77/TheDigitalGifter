/** Pure Advent claim policy (Dec 1–24, Europe/Bucharest day). No I/O. */

export function parseAdventNow(rawDate: unknown, hooksEnabled: boolean, now = new Date()): Date {
  if (!hooksEnabled) return now;
  const raw = String(rawDate ?? "").trim();
  if (raw && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw + (raw.includes("T") ? "" : "T12:00:00+02:00"));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return now;
}

export function evaluateAdventClaimRequest(input: {
  adventEnabled: boolean;
  testHooksEnabled: boolean;
  testForce: boolean;
  requestedDay: unknown;
  eligibleDay: number | null;
}): { ok: true; day: number } | { ok: false; error: string; status: number } {
  const forced = input.testHooksEnabled && input.testForce;
  if (!input.adventEnabled && !forced) {
    return { ok: false, error: "advent_disabled", status: 403 };
  }
  const requestedDay = Number(input.requestedDay);
  if (!Number.isInteger(requestedDay) || requestedDay < 1 || requestedDay > 24) {
    return { ok: false, error: "invalid_day", status: 400 };
  }
  if (input.eligibleDay !== requestedDay) {
    return { ok: false, error: "not_eligible", status: 403 };
  }
  return { ok: true, day: requestedDay };
}
