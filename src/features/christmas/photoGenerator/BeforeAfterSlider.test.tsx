// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

it("reveals and plays the clip when the divider moves, with keyboard and pointer support", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const host = document.createElement("div"); const root = createRoot(host);
  try {
    await act(async () => root.render(<BeforeAfterSlider beforeSrc="original.jpg" afterSrc="poster.jpg" afterVideoSrc="clip.mp4" beforeAlt="Original" afterAlt="Clip" beforeLabel="Before" afterLabel="After" ariaLabel="Compare photo and clip" />));
    const slider = host.querySelector('[role="slider"]')!;
    expect(host.querySelector("video")?.autoplay).toBe(false);
    expect(play).not.toHaveBeenCalled();
    await act(async () => slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(slider.getAttribute("aria-valuenow")).toBe("51");
    expect((host.querySelector(".pg-ba__before-clip") as HTMLElement).style.clipPath).toBe("inset(0 49% 0 0)");
    expect(play).toHaveBeenCalledOnce();
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({ left: 0, width: 400 } as DOMRect);
    await act(async () => slider.dispatchEvent(new MouseEvent("pointerdown", { clientX: 100, bubbles: true })));
    expect(slider.getAttribute("aria-valuenow")).toBe("25");
    await act(async () => slider.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
    expect(slider.getAttribute("aria-valuenow")).toBe("4");
  } finally { await act(async () => root.unmount()); play.mockRestore(); }
});
