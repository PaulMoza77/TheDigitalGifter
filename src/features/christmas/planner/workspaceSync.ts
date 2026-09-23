import { invalidatePlannerSnapshot } from "./intelligence/loadSnapshot";
import { computeReadiness } from "./readiness";

const EVENT = "tdg-planner-reconcile";
const listeners = new Set<(percent: number) => void>();

export function publishPlannerReadiness(percent: number) {
  for (const listener of listeners) listener(percent);
}

export function subscribePlannerReadiness(listener: (percent: number) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Ask the shell to reload readiness from the saved workspace. */
export function bumpPlannerWorkspace() {
  invalidatePlannerSnapshot();
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

export function onPlannerWorkspaceBump(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener(EVENT, listener);
  };
}

export function localReadinessPercent(input: Parameters<typeof computeReadiness>[0]): number {
  return computeReadiness(input).percent;
}
