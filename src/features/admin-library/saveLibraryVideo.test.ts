import { afterEach, describe, expect, it, vi } from "vitest";

import { formatDurationSeconds } from "./formatDuration";
import {
  clearLibraryVideoFileCache,
  isIosLikeDevice,
  isShareGestureLost,
  isUserShareCancel,
  saveLibraryVideo,
  videoFileType,
} from "./saveLibraryVideo";
import { appendLibraryQueryParam, librarySrcPath } from "./catalog";

function mockVideoResponse(bytes: number[], contentType = "video/mp4") {
  const buffer = new Uint8Array(bytes).buffer;
  return {
    ok: true,
    headers: {
      get(name: string) {
        const key = name.toLowerCase();
        if (key === "content-type") return contentType;
        if (key === "content-length") return String(bytes.length);
        return null;
      },
    },
    arrayBuffer: async () => buffer,
    body: null,
  };
}

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

describe("share cancel helpers", () => {
  it("treats AbortError as a user cancel and NotAllowedError as a lost gesture", () => {
    expect(isUserShareCancel({ name: "AbortError" })).toBe(true);
    expect(isUserShareCancel({ name: "NotAllowedError" })).toBe(false);
    expect(isUserShareCancel(new Error("fail"))).toBe(false);
    expect(isShareGestureLost({ name: "NotAllowedError" })).toBe(true);
  });
});

describe("videoFileType", () => {
  it("forces mp4 files to video/mp4 so iOS offers Save Video", () => {
    expect(videoFileType("final_christmas_reel_1080p.mp4", "application/octet-stream")).toBe("video/mp4");
    expect(videoFileType("clip.mp4", "application/mp4")).toBe("video/mp4");
    expect(videoFileType("clip.mp4", "video/quicktime")).toBe("video/mp4");
    expect(videoFileType("nyc_rockefeller_ice_rink.jpg", "application/octet-stream")).toBe("image/jpeg");
    expect(videoFileType("still.png", "application/octet-stream")).toBe("image/png");
  });
});

describe("saveLibraryVideo", () => {
  afterEach(() => {
    clearLibraryVideoFileCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shares a fetched file on iOS with files only so Photos stays available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockVideoResponse([0, 0, 0, 1], "application/octet-stream")));
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
    const payload = share.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual(["files"]);
    expect(payload.text).toBeUndefined();
    expect(payload.title).toBeUndefined();
    const files = payload.files as File[];
    expect(files[0].name).toBe("clip_05.mp4");
    expect(files[0].type).toBe("video/mp4");
  });

  it("downloads with a blob link on desktop", async () => {
    const click = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockVideoResponse([1, 2, 3])));
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

    await expect(
      saveLibraryVideo({ url: "/assets/clip_05.mp4", filename: "clip_05.mp4" }),
    ).resolves.toBe("downloaded");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("streams long-form downloads without buffering the file in JS and keeps the signature", async () => {
    const signed =
      "/api/long-form-studio?action=media&kind=video&id=abc&exp=1730000000&sig=deadbeef";
    const fetchMock = vi.fn();
    const click = vi.fn();
    const created: Array<Record<string, string>> = [];
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)",
      maxTouchPoints: 0,
      platform: "MacIntel",
    });
    vi.stubGlobal("document", {
      createElement: () => {
        const node = { href: "", download: "", rel: "", click, remove: vi.fn() };
        created.push(node);
        return node;
      },
      body: { appendChild: vi.fn() },
    });
    const downloadUrl = appendLibraryQueryParam(librarySrcPath(signed), "download", "1");
    await expect(
      saveLibraryVideo({
        url: signed,
        downloadUrl,
        filename: "long-form.mp4",
        kind: "long_form",
      }),
    ).resolves.toBe("downloaded");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(created[0]?.href).toContain("action=media");
    expect(created[0]?.href).toContain("sig=deadbeef");
    expect(created[0]?.href).toContain("download=1");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("opens signed long-form video natively on iOS instead of fetching it", async () => {
    const signed =
      "/api/long-form-studio?action=media&kind=video&id=abc&exp=1730000000&sig=deadbeef";
    const fetchMock = vi.fn();
    const open = vi.fn().mockReturnValue({});
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      maxTouchPoints: 5,
      platform: "iPhone",
    });
    vi.stubGlobal("open", open);
    await expect(
      saveLibraryVideo({ url: signed, filename: "long-form.mp4", kind: "long_form" }),
    ).resolves.toBe("opened");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(signed, "_blank", "noopener,noreferrer");
  });
});
