/**
 * Mobile browsers only autoplay a clip when the element is muted and inline
 * before play() runs. React's muted attribute does not always set that property
 * on iOS, so play() is rejected and the poster stays frozen.
 */

type Slot = {
  video: HTMLVideoElement;
  ratio: number;
  eager: boolean;
};

const slots = new Set<Slot>();
let gestureBound = false;

export function primeInlineVideo(video: HTMLVideoElement) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
}

export function playInlineClip(video: HTMLVideoElement) {
  primeInlineVideo(video);
  if (video.preload !== "auto") video.preload = "auto";
  if (!video.paused && !video.ended) return;
  const pending = video.play();
  if (pending && typeof pending.catch === "function") {
    pending.catch(() => undefined);
  }
}

function phoneLayout() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

/** One visible clip on a phone so iOS does not reject every autoplay at once. */
export function syncInlineClips() {
  const visible = [...slots].filter((slot) => slot.ratio > 0.02);
  let winners: Slot[] = visible;
  if (phoneLayout() && visible.length > 0) {
    winners = [
      visible.reduce((best, slot) => {
        if (slot.ratio > best.ratio + 0.08) return slot;
        if (best.ratio > slot.ratio + 0.08) return best;
        return slot.eager ? slot : best.eager ? best : slot;
      }),
    ];
  }
  const winnerSet = new Set(winners);
  for (const slot of slots) {
    if (winnerSet.has(slot)) playInlineClip(slot.video);
    else if (!slot.video.paused) slot.video.pause();
  }
}

function bindGestureUnlock() {
  if (gestureBound || typeof window === "undefined") return;
  gestureBound = true;
  const unlock = () => syncInlineClips();
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("pointerdown", unlock, { passive: true });
}

export function watchInlineClip(video: HTMLVideoElement, root: HTMLElement, eager: boolean) {
  primeInlineVideo(video);
  if (eager) video.preload = "auto";
  const slot: Slot = { video, ratio: eager ? 1 : 0, eager };
  slots.add(slot);
  bindGestureUnlock();

  const io = new IntersectionObserver(
    ([entry]) => {
      slot.ratio = entry?.isIntersecting ? Math.max(entry.intersectionRatio, 0.05) : 0;
      syncInlineClips();
    },
    { threshold: [0, 0.05, 0.25, 0.6], rootMargin: "160px 0px" },
  );
  io.observe(root);

  const retry = () => syncInlineClips();
  video.addEventListener("loadeddata", retry);
  video.addEventListener("canplay", retry);
  syncInlineClips();

  return () => {
    io.disconnect();
    video.removeEventListener("loadeddata", retry);
    video.removeEventListener("canplay", retry);
    slots.delete(slot);
    video.pause();
    syncInlineClips();
  };
}
