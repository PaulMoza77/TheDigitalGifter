// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { useChristmasPortraitFunnel } from "./useChristmasPortraitFunnel";
import { CHRISTMAS_PORTRAIT_VERTICALS } from "./portraitVerticals";
import { emptyPortraitDraft } from "./portraitTypes";
vi.mock("./photoApi", () => ({ fetchChristmasCommercialOffers: async () => [], getChristmasOrderByToken: vi.fn(), confirmChristmasStripePayment: vi.fn(), createChristmasUpload: vi.fn(), startChristmasCheckout: vi.fn(), uploadChristmasBlob: vi.fn(), validateChristmasSpecies: vi.fn() }));
vi.mock("./analytics", () => ({ trackChristmasEvent: vi.fn(), getChristmasFunnelSessionId: () => "test" }));
vi.mock("./portraitMeta", () => ({ trackChristmasPortraitPurchase: vi.fn() }));
vi.mock("./photoPreview", () => ({ createBlurredOriginalPreview: vi.fn(), christmasPreviewUsesReplicate: () => false, validateChristmasPhotoFile: vi.fn() }));
it("pushes step URLs, honors browser Back/Forward, and recovers checkout after reload", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const vertical = CHRISTMAS_PORTRAIT_VERTICALS.photo;
  sessionStorage.setItem(vertical.draftStorageKey, JSON.stringify({ ...emptyPortraitDraft(), step: "offer", sourcePath: "private/photo.jpg", styleKey: "snow", blurredPreviewUrl: "data:image/jpeg;base64,test" }));
  let funnel: ReturnType<typeof useChristmasPortraitFunnel>;
  let navigate: ReturnType<typeof useNavigate>;
  let search = "";
  function Harness() {
    funnel = useChristmasPortraitFunnel({ vertical, mode: "hub" });
    navigate = useNavigate(); search = useLocation().search;
    return <span>{funnel.draft.step}</span>;
  }
  const host = document.createElement("div"); const root = createRoot(host);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={["/christmas/photo-generator?step=checkout&utm_source=test"]}><Harness /></MemoryRouter>));
    expect(host.textContent).toBe("offer");
    expect(search).toContain("step=offer");
    await act(async () => funnel!.goBack());
    expect(host.textContent).toBe("preview"); expect(search).toContain("step=preview");
    await act(async () => navigate!(-1));
    expect(host.textContent).toBe("offer");
    await act(async () => navigate!(1));
    expect(host.textContent).toBe("preview");
    await act(async () => funnel!.resetAnother());
    expect(host.textContent).toBe("intro"); expect(search).toBe("?utm_source=test");
  } finally { await act(async () => root.unmount()); sessionStorage.clear(); }
});
