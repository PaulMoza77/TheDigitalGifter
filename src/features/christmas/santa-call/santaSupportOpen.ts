/** Tiny event bridge so landing can open support without loading the chat chunk. */
export const SANTA_SUPPORT_OPEN_EVENT = "tdg-santa-support-open";

export function openSantaSupport() {
  window.dispatchEvent(new Event(SANTA_SUPPORT_OPEN_EVENT));
}
