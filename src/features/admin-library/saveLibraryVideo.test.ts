import { afterEach, describe, expect, it, vi } from "vitest";

import { formatDurationSeconds } from "./formatDuration";
import { isIosLikeDevice, isUserShareCancel, saveLibraryVideo } from "./saveLibraryVideo";

describe("formatDurationSeconds", () => {
  it("renders short clips in seconds", () => {
    expect(formatDurationSeconds(1.2)).toBe("1.2s");
    expect(formatDurationSeconds(5)).toBe("5s");
    expect(formatDurationSeconds(13.4)).toBe("13s");
    expect(formatDurationSeconds(65)).toBe("1:05");
    expect(formatDurationSeconds(null)).toBe("");
  });
});

describe("isIosLikeDevice", () => {
  it("detects iPhone, iPad, and iPadOS desktop UA", () => {
    expect(isIosLikeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIosLikeDevice("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)")).toBe(true);
    expect(isIosLikeDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)", 5, "MacIntel")).toBe(true);
    expect(isIosLikeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0, "Win32")).toBe(false);
  });
});

describe("isUserShareCancel", () => {
  it("treats AbortError as a user cancel", () => {
    expect(isUserShareCancel({ name: "AbortError" })).toBe(true);
    expect(isUserShareCancel(new Error("fail"))).toBe(false);
  });
});

describe("saveLibraryVideo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shares a fetched file on iOS so Safari does not navigate away", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob([new Uint8Array([0, 0, 0, 1])], { type: "video/mp4" }),
      }),
    );
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      maxTouchPoints: 5,
      platform: "iPhone",
      canShare: () => true,
      share,
    });

    await expect(
      saveLibraryVideo({ url: "/assets/clip_05.mp4", filename: "clip_05.mp4", title: "Cookies" }),
    ).resolves.toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
    const payload = share.mock.calls[0][0] as { files: File[] };
    expect(payload.files[0].name).toBe("clip_05.mp4");
    expect(payload.files[0].type).toBe("video/mp4");
  });

  it("downloads with a blob link on desktop", async () => {
    const click = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: "video/mp4" }),
      }),
    );
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)",
      maxTouchPoints: 0,
      platform: "MacIntel",
    });
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:library-test",
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal("document", {
      createElement: () => ({
        href: "",
        download: "",
        rel: "",
        click,
        remove,
      }),
      body: { appendChild: vi.fn() },
    });
    vi.stubGlobal("window", { setTimeout: (fn: () => void) => fn() });

    await expect(
      saveLibraryVideo({ url: "/assets/clip_05.mp4", filename: "clip_05.mp4" }),
    ).resolves.toBe("downloaded");
    expect(click).toHaveBeenCalledTimes(1);
  });
});
