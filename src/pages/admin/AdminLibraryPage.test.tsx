// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminLibraryPage from "./AdminLibraryPage";
import { LIBRARY_VIDEOS } from "@/features/admin-library/catalog";

const api = vi.hoisted(() => ({ factory: vi.fn(), longForm: vi.fn() }));
vi.mock("@/features/clip-factory/api", () => ({ clipFactoryApi: { dynamicLibrary: api.factory } }));
vi.mock("@/features/long-form-studio/api", () => ({ longFormApi: { libraryVideos: api.longForm } }));
vi.mock("@/features/social-publisher/api", () => ({ socialPublisherApi: { bootstrap: async () => ({ timezone: "UTC" }) } }));
vi.mock("@/features/social-publisher/BulkScheduleDialog", () => ({ default: () => null }));
vi.mock("@/features/social-publisher/PublishReelDrawer", () => ({ default: () => null }));
vi.mock("@/features/admin-library/LibraryVideoCard", () => ({
  default: ({ video }: { video: { id: string; title: string } }) => <article data-video-id={video.id}>{video.title}</article>,
}));

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  api.factory.mockReset().mockResolvedValue({ videos: [] });
  api.longForm.mockReset().mockResolvedValue({ videos: [] });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderLibrary() {
  await act(async () => root.render(<MemoryRouter><AdminLibraryPage /></MemoryRouter>));
}

async function searchLibrary(value: string) {
  const input = container.querySelector('input[type="search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("Library loading", () => {
  it("loads a small page while searching the complete catalog across categories", async () => {
    await renderLibrary();
    expect(container.querySelectorAll("article")).toHaveLength(12);
    for (const id of ["reel-library-train-express", "short-kids-sled", "photo-nyc-ice-girl", "pet-dog-astronaut"]) {
      const item = LIBRARY_VIDEOS.find((video) => video.id === id)!;
      await searchLibrary(item.filename);
      expect(container.querySelector(`[data-video-id="${id}"]`)).not.toBeNull();
    }
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("loads additional results on demand and resets the page for a new filter", async () => {
    await renderLibrary();
    const loadMore = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Load more")!;
    await act(async () => loadMore.click());
    expect(container.querySelectorAll("article")).toHaveLength(24);
    await searchLibrary("Christmas");
    expect(container.querySelectorAll("article")).toHaveLength(12);
    expect(container.textContent).toContain("Showing 12 of");
  });

  it("keeps successful sources visible and allows retrying a failed source", async () => {
    api.factory.mockRejectedValueOnce(new Error("Network unavailable"));
    api.longForm.mockResolvedValue({ videos: [{ id: "long-form-test", title: "Saved ambience", src: "/saved.mp4" }] });
    await renderLibrary();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not load Clip Factory");
    expect(container.querySelector('[data-video-id="long-form-test"]')).not.toBeNull();
    expect(container.querySelector('[data-video-id="tdg-christmas-meta-ad-v2-20261020"]')).not.toBeNull();
    api.factory.mockResolvedValue({ videos: [{ id: "factory-test", title: "Saved clip", src: "/clip.mp4" }] });
    const retry = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Retry")!;
    await act(async () => retry.click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[data-video-id="factory-test"]')).not.toBeNull();
    expect(container.querySelector('[data-video-id="long-form-test"]')).not.toBeNull();
  });
});
