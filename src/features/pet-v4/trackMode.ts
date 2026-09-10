import { trackPetV2Event, type TrackV2Input } from "../pet-v2/analytics";
import { trackPetV4Event } from "./analytics";
import { mapV2EventToV4 } from "./sequentialFunnel";
import type { PetV4CtaLocation, PetV4Species } from "./types";

export type PetFunnelMode = "v2" | "v4";

/** Route a V2-shaped event to V2 or V4 ingest based on funnel mode. */
export function trackPetFunnelModeEvent(
  mode: PetFunnelMode,
  input: TrackV2Input & { ctaLocation?: PetV4CtaLocation | null; generationDurationMs?: number | null },
): void {
  if (mode !== "v4") {
    trackPetV2Event(input);
    return;
  }
  const mapped = mapV2EventToV4(input.eventName);
  if (!mapped) {
    // Unmapped diagnostic events (e.g. species_confirmed) — skip rather than pollute V2.
    if (input.eventName === "v2_species_confirmed") {
      trackPetV4Event({
        eventName: "v4_cta_clicked",
        species: input.species as PetV4Species,
        ctaLocation: "try_generate",
        attemptId: input.attemptId || "species_confirmed",
      });
    }
    return;
  }
  trackPetV4Event({
    eventName: mapped,
    species: input.species as PetV4Species,
    amountCents: input.amountCents,
    pathname: input.pathname,
    failureCategory: input.failureCategory,
    attemptId: input.attemptId,
    ctaLocation: input.ctaLocation,
    generationDurationMs: input.generationDurationMs,
  });
}
