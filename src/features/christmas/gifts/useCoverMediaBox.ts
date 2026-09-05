import { useEffect, useState, type RefObject } from "react";

export type CoverMediaBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Mirrors CSS object-fit: cover placement so hotspots can use
 * percentages of the source media, not the cropped viewport.
 *
 * When the container is wider than the media, cover scales to width and
 * crops top/bottom. When taller/narrower, it scales to height and crops sides.
 */
export function computeCoverMediaBox(
  containerW: number,
  containerH: number,
  mediaAspect: number,
  objectPositionX = 0.5,
  objectPositionY = 0,
): CoverMediaBox {
  if (containerW <= 0 || containerH <= 0 || mediaAspect <= 0) {
    return { left: 0, top: 0, width: containerW, height: containerH };
  }
  const containerAspect = containerW / containerH;
  if (containerAspect > mediaAspect) {
    // Wider than media → fill width, crop top/bottom.
    const width = containerW;
    const height = width / mediaAspect;
    return {
      left: 0,
      top: (containerH - height) * objectPositionY,
      width,
      height,
    };
  }
  // Taller/narrower than media → fill height, crop sides.
  const height = containerH;
  const width = height * mediaAspect;
  return {
    left: (containerW - width) * objectPositionX,
    top: 0,
    width,
    height,
  };
}

/**
 * Choose object-position Y so the gift band near the media bottom stays in view
 * on wide/short viewports (where cover crops vertically).
 * When the full media height fits, prefer top (0) so the tree star clears the header.
 */
export function giftSafeObjectPositionY(
  containerW: number,
  containerH: number,
  mediaAspect: number,
  /** Lowest media Y that must remain visible (gifts sit ~72–90%). */
  keepMediaBottom = 0.94,
): number {
  if (containerW <= 0 || containerH <= 0 || mediaAspect <= 0) return 0;
  const containerAspect = containerW / containerH;
  if (containerAspect <= mediaAspect) return 0;
  const visibleRatio = mediaAspect / containerAspect;
  if (visibleRatio >= keepMediaBottom) return 0;
  if (visibleRatio >= 1) return 0;
  return Math.min(1, Math.max(0, (keepMediaBottom - visibleRatio) / (1 - visibleRatio)));
}

export type CoverMediaLayout = CoverMediaBox & {
  objectPositionX: number;
  objectPositionY: number;
};

export function useCoverMediaBox(
  containerRef: RefObject<HTMLElement | null>,
  mediaAspect: number,
  objectPositionX = 0.5,
  /**
   * Fixed Y, or "gift-safe" to keep presents under the tree visible
   * when the wide desktop crop would otherwise cut them off.
   */
  objectPositionY: number | "gift-safe" = "gift-safe",
): CoverMediaLayout {
  const [layout, setLayout] = useState<CoverMediaLayout>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    objectPositionX,
    objectPositionY: 0,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const y =
        objectPositionY === "gift-safe"
          ? giftSafeObjectPositionY(rect.width, rect.height, mediaAspect)
          : objectPositionY;
      const box = computeCoverMediaBox(
        rect.width,
        rect.height,
        mediaAspect,
        objectPositionX,
        y,
      );
      setLayout({
        ...box,
        objectPositionX,
        objectPositionY: y,
      });
    };

    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerRef, mediaAspect, objectPositionX, objectPositionY]);

  return layout;
}
