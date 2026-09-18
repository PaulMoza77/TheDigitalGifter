import { addDaysIso, formatZonedDateTime, zonedWallTimeToUtcMs } from "./timezone";
import type { BulkScheduleInput, BulkScheduleSlot } from "./types";

function parseHm(time: string): { hour: number; minute: number } | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function previewBulkSchedule(input: BulkScheduleInput): {
  ok: boolean;
  error?: string;
  slots: BulkScheduleSlot[];
} {
  const assetIds = [...new Set(input.assetIds.filter(Boolean))];
  const times = input.times.map((t) => t.trim()).filter(Boolean);
  const postsPerDay = Math.floor(input.postsPerDay);

  if (assetIds.length === 0) return { ok: false, error: "Select at least one Reel.", slots: [] };
  if (input.platforms.length === 0) return { ok: false, error: "Select at least one platform.", slots: [] };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    return { ok: false, error: "Start date must be YYYY-MM-DD.", slots: [] };
  }
  if (postsPerDay < 1) return { ok: false, error: "Posts per day must be at least 1.", slots: [] };
  if (times.length === 0) return { ok: false, error: "Add at least one post time.", slots: [] };
  if (times.length !== postsPerDay) {
    return {
      ok: false,
      error: `Provide exactly ${postsPerDay} time(s) to match posts per day.`,
      slots: [],
    };
  }
  for (const time of times) {
    if (!parseHm(time)) return { ok: false, error: `Invalid time: ${time}`, slots: [] };
  }

  const nowMs = input.nowMs ?? Date.now();
  const slots: BulkScheduleSlot[] = [];
  let dayOffset = 0;
  let indexInDay = 0;

  const nextUsable = (): { date: string; time: string; ms: number } => {
    for (let guard = 0; guard < 366 * 8; guard++) {
      const date = addDaysIso(input.startDate, dayOffset);
      const time = times[indexInDay];
      const ms = zonedWallTimeToUtcMs(date, time, input.timezone);
      indexInDay += 1;
      if (indexInDay >= times.length) {
        indexInDay = 0;
        dayOffset += 1;
      }
      if (ms > nowMs) return { date, time, ms };
    }
    throw new Error("Could not find a future slot");
  };

  for (const assetId of assetIds) {
    const slot = nextUsable();
    slots.push({
      assetId,
      scheduledAtIso: new Date(slot.ms).toISOString(),
      localDate: slot.date,
      localTime: slot.time,
    });
  }

  return { ok: true, slots };
}

export function describeSlot(slot: BulkScheduleSlot, timezone: string): string {
  const local = formatZonedDateTime(Date.parse(slot.scheduledAtIso), timezone);
  return `${local.date} ${local.time}`;
}
