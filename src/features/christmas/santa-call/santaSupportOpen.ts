/** Tiny event bridge so landing can open support without loading the chat chunk. */
export const SANTA_SUPPORT_OPEN_EVENT = "tdg-santa-support-open";
export const SANTA_SUPPORT_PENDING_KEY = "tdg.santa.support.pending_open";

export function openSantaSupport() {
  try {
    sessionStorage.setItem(SANTA_SUPPORT_PENDING_KEY, "1");
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(SANTA_SUPPORT_OPEN_EVENT));
}

export function consumeSantaSupportPendingOpen(): boolean {
  try {
    if (sessionStorage.getItem(SANTA_SUPPORT_PENDING_KEY) !== "1") return false;
    sessionStorage.removeItem(SANTA_SUPPORT_PENDING_KEY);
    return true;
  } catch {
    return false;
  }
}
