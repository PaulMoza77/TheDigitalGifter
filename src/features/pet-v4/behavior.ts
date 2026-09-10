import { useEffect, useRef } from "react";
import { trackPetV4Event, trackV4ScrollDepth } from "./analytics";
import type { PetV4CtaLocation, PetV4Species } from "./types";

function scrollPercent(): number {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;
  const doc = document.documentElement;
  const body = document.body;
  const scrollTop = window.scrollY || doc.scrollTop || body.scrollTop || 0;
  const height = Math.max(doc.scrollHeight, body.scrollHeight) - window.innerHeight;
  if (height <= 0) return 100;
  return Math.min(100, Math.max(0, (scrollTop / height) * 100));
}

function elementReached(selector: string): boolean {
  try {
    const el = document.querySelector(selector);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight * 0.92;
  } catch {
    return false;
  }
}

/**
 * Installs scroll depth + first interaction + engaged-time beacons for V4.
 * Idempotent across remounts via module-level once flags in analytics.
 */
export function useV4BehaviorTracking(input: {
  enabled: boolean;
  species: PetV4Species;
  mainCtaSelector?: string;
  pricingSelector?: string;
}) {
  const startedAt = useRef(Date.now());
  const engagedMs = useRef(0);
  const lastActive = useRef(Date.now());
  const firstInteractionSent = useRef(false);
  const visible = useRef(true);

  useEffect(() => {
    if (!input.enabled || typeof window === "undefined") return;

    const onInteract = () => {
      if (!firstInteractionSent.current) {
        firstInteractionSent.current = true;
        trackPetV4Event({
          eventName: "v4_first_interaction",
          species: input.species,
          engagedMs: Date.now() - startedAt.current,
        });
      }
      lastActive.current = Date.now();
    };

    const onScroll = () => {
      onInteract();
      const pct = scrollPercent();
      if (pct < 25) trackV4ScrollDepth("lt25", pct);
      if (pct >= 25) trackV4ScrollDepth("p25", pct);
      if (pct >= 50) trackV4ScrollDepth("p50", pct);
      if (pct >= 75) trackV4ScrollDepth("p75", pct);
      if (pct >= 90) trackV4ScrollDepth("p90", pct);
      if (input.mainCtaSelector && elementReached(input.mainCtaSelector)) {
        trackV4ScrollDepth("main_cta", pct);
      }
      if (input.pricingSelector && elementReached(input.pricingSelector)) {
        trackV4ScrollDepth("pricing", pct);
      }
    };

    const onVisibility = () => {
      visible.current = document.visibilityState === "visible";
      if (visible.current) lastActive.current = Date.now();
    };

    const tick = window.setInterval(() => {
      if (!visible.current) return;
      if (Date.now() - lastActive.current < 5000) {
        engagedMs.current += 1000;
      }
    }, 1000);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", onInteract, { passive: true });
    window.addEventListener("keydown", onInteract);
    document.addEventListener("visibilitychange", onVisibility);
    onScroll();

    return () => {
      window.clearInterval(tick);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [input.enabled, input.species, input.mainCtaSelector, input.pricingSelector]);
}

export function trackV4CtaClick(
  location: PetV4CtaLocation,
  species?: PetV4Species,
  attemptId?: string,
): void {
  trackPetV4Event({
    eventName: "v4_cta_clicked",
    species,
    ctaLocation: location,
    attemptId: attemptId || `${location}:${Date.now()}`,
  });
}

export function trackV4CtaExposed(location: PetV4CtaLocation, species?: PetV4Species): void {
  trackPetV4Event({
    eventName: "v4_cta_exposed",
    species,
    ctaLocation: location,
  });
}
