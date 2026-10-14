import { describe, expect, it, vi } from "vitest";
import { playInlineClip, primeInlineVideo, syncInlineClips, watchInlineClip } from "./inlineClip";

function fakeVideo() {
  const listeners = new Map<string, Set<() => void>>();
  return {
    muted: false,
    defaultMuted: false,
    playsInline: false,
    autoplay: false,
    paused: true,
    ended: false,
    preload: "metadata",
    attrs: {} as Record<string, string>,
    setAttribute(name: string, value: string) {
      this.attrs[name] = value;
    },
    play() {
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
    addEventListener(type: string, fn: () => void) {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type: string, fn: () => void) {
      listeners.get(type)?.delete(fn);
    },
  };
}

describe("inline clip autoplay", () => {
  it("marks the element muted and inline before playback", () => {
    const video = fakeVideo();
    primeInlineVideo(video as unknown as HTMLVideoElement);
    expect(video.muted).toBe(true);
    expect(video.defaultMuted).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(video.attrs["webkit-playsinline"]).toBe("true");
    expect(video.attrs.muted).toBe("");
  });

  it("starts a paused clip", () => {
    const video = fakeVideo();
    const play = vi.spyOn(video, "play");
    playInlineClip(video as unknown as HTMLVideoElement);
    expect(play).toHaveBeenCalledOnce();
    expect(video.paused).toBe(false);
  });

  it("plays the eager clip immediately on a phone and pauses the others", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = observe;
        disconnect = disconnect;
        constructor(private cb: IntersectionObserverCallback) {
          queueMicrotask(() => {
            this.cb([{ isIntersecting: true, intersectionRatio: 0.8 } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
          });
        }
      },
    );
    vi.stubGlobal("window", {
      matchMedia: (query: string) => ({ matches: query.includes("max-width") }),
      addEventListener() {},
    });

    const hero = fakeVideo();
    const other = fakeVideo();
    const stopHero = watchInlineClip(hero as unknown as HTMLVideoElement, {} as HTMLElement, true);
    const stopOther = watchInlineClip(other as unknown as HTMLVideoElement, {} as HTMLElement, false);
    syncInlineClips();

    expect(hero.paused).toBe(false);
    expect(other.paused).toBe(true);

    stopHero();
    stopOther();
    vi.unstubAllGlobals();
  });
});
