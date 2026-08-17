import { useEffect, useState } from "react";
import { canAutoplayHeroVideo } from "./croGuards";

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

export function useCanAutoplayHeroVideo() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [canAutoplay, setCanAutoplay] = useState(false);

  useEffect(() => {
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    setCanAutoplay(
      canAutoplayHeroVideo({
        prefersReducedMotion,
        saveData: Boolean(connection?.saveData),
        effectiveType: connection?.effectiveType,
      }),
    );
  }, [prefersReducedMotion]);

  return { prefersReducedMotion, canAutoplay };
}
