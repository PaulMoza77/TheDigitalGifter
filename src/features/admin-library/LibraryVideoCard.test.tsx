// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import LibraryVideoCard from "./LibraryVideoCard";
import type { LibraryVideo } from "./catalog";

afterEach(() => vi.unstubAllGlobals());

describe("Library media requests", () => {
  it.each(["photo", "reel"] as const)("does not request offscreen %s media or posters", async (kind) => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    let notify: IntersectionObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe() {}
      disconnect = disconnect;
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const video: LibraryVideo = {
      id: "test-media", title: "Test media", description: "", category: "clip_factory", kind,
      src: kind === "photo" ? "/large-photo.jpg" : "/large-video.mp4", filename: kind === "photo" ? "photo.jpg" : "video.mp4",
      poster: kind === "photo" ? undefined : "/large-poster.jpg",
    };
    try {
      await act(async () => root.render(<LibraryVideoCard video={video} playing={false} onPlayingChange={() => undefined} />));
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("video")).toBeNull();
      await act(async () => notify!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
      expect(container.querySelector("img")?.getAttribute("loading")).toBe("lazy");
      if (kind === "reel") expect(container.querySelector("video")?.getAttribute("preload")).toBe("none");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
    expect(disconnect).toHaveBeenCalled();
  });
});
