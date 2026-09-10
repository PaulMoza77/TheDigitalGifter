/**
 * Background-task helper formerly from `@vercel/functions` waitUntil.
 * On Mozas the request stays alive long enough for most work; we still
 * attach a rejection handler so fire-and-forget never crashes the process.
 */
export function waitUntil(task: Promise<unknown>): void {
  void Promise.resolve(task).catch((err) => {
    console.error("[waitUntil] background task failed", err);
  });
}
