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
    const height = containerH;
    const width = height * mediaAspect;
    return {
      left: (containerW - width) * objectPositionX,
      top: 0,
      width,
      height,
    };
  }
  const width = containerW;
  const height = width / mediaAspect;
  return {
    left: 0,
    top: (containerH - height) * objectPositionY,
    width,
    height,
  };
}

export function useCoverMediaBox(
  containerRef: RefObject<HTMLElement | null>,
  mediaAspect: number,
  objectPositionX = 0.5,
  objectPositionY = 0,
): CoverMediaBox {
  const [box, setBox] = useState<CoverMediaBox>({ left: 0, top: 0, width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setBox(
        computeCoverMediaBox(
          rect.width,
          rect.height,
          mediaAspect,
          objectPositionX,
          objectPositionY,
        ),
      );
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

  return box;
}
