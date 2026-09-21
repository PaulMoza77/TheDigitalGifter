import { addDays, isoDate, localDateParts, type LocalDateParts } from "./date";

export type DatedTask = {
  status: string;
  due_on: string | null;
};

export type TaskWhen = "overdue" | "today" | "week" | "later" | "done" | "skipped";

export function plannerTodayIso(now: Date, timeZone?: string | null): string {
  return isoDate(localDateParts(now, timeZone));
}

export function plannerWeekEndIso(now: Date, timeZone?: string | null): string {
  return isoDate(addDays(localDateParts(now, timeZone), 6));
}

export function plannerWeekEndFromToday(todayIso: string): string {
  const [year, month, day] = todayIso.split("-").map(Number);
  const parts: LocalDateParts = { year, month, day };
  if (!year || !month || !day) return todayIso;
  return isoDate(addDays(parts, 6));
}

export function isActionableTask(status: string): boolean {
  return status === "open" || status === "rescheduled";
}

/** Same calendar buckets for Today and Tasks. Undated work is later, never today. */
export function taskWhen(task: DatedTask, todayIso: string, weekEndIso: string): TaskWhen {
  if (task.status === "done") return "done";
  if (task.status === "skipped") return "skipped";
  if (!isActionableTask(task.status)) return "later";
  if (!task.due_on) return "later";
  if (task.due_on < todayIso) return "overdue";
  if (task.due_on === todayIso) return "today";
  if (task.due_on <= weekEndIso) return "week";
  return "later";
}

export function tasksForView<T extends DatedTask>(
  tasks: T[],
  view: "today" | "week" | "all" | "calendar",
  todayIso: string,
  weekEndIso: string,
): T[] {
  return tasks.filter((task) => {
    if (task.status === "skipped") return false;
    if (view === "calendar") return Boolean(task.due_on);
    const when = taskWhen(task, todayIso, weekEndIso);
    if (view === "today") return when === "overdue" || when === "today";
    if (view === "week") return when === "overdue" || when === "today" || when === "week";
    return true;
  });
}
