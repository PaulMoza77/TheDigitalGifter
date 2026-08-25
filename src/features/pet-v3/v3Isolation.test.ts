import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PET_FUNNEL_ALLOWED_EVENTS } from "../pet/funnelEventContract";
import { PET_V2_DRAFT_STORAGE_KEY, PET_V2_SESSION_KEY } from "../pet-v2/types";
import {
  mapV2CountsToPrimarySteps,
  mapV3CountsToPrimarySteps,
  namedEventCounts,
  FUNNEL_DATASETS,
  isDatasetConfigured,
  rpcCampaignIdForDataset,
} from "../pet/funnelDatasetConfig";
import { shouldTrackPetBeginCheckout } from "../pet/funnelAnalytics";
import { buildPreviewPrompt, resolvePreviewContext, ROYAL_CAT_EDIT } from "../../../supabase/functions/_shared/pet/previewFunnelContext.ts";
import {
  backStepFrom,
  clearPreviewOnPhotoChange,
  resolveGenerateAttempt,
  shouldRestoreLocalPreview,
} from "../pet-v2/previewFlow";
import { v3IdempotencyKey, isPetV3EventName, sanitizeV3Pathname } from "./analytics";
import { trackV3BeginCheckout } from "./checkoutAnalytics";
import { PET_V3_DRAFT_STORAGE_KEY, PET_V3_EVENTS, PET_V3_EVENT_PATH, PET_V3_PRICE_CENTS, PET_V3_SESSION_KEY, PET_V3_SPECIES } from "./types";
import { PET_V3_FUNNEL_CONFIG } from "./config";

vi.mock("./analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./analytics")>();
  return {
    ...actual,
    trackPetV3Event: vi.fn(),
  };
});

import { trackPetV3Event } from "./analytics";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sessionId = "11111111-2222-4333-8333-444444444401";

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("pet funnel V3 cat isolation", () => {
  it("registers /pet/cat-v3 without altering V1/V2 routes", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain('path="/pet/cat-v3"');
    expect(app).toContain("PetV3Route");
    expect(app).toContain('path="/pet/dog-v2"');
    expect(app).toContain("PetV2Route");
    expect(app).not.toContain('path="/pet/dog-v3"');
    expect(readSrc("src/features/pet-v2/PetV2FunnelPage.tsx")).not.toContain("PetV3");
  });

  it("creates only V3 cat session and storage keys", () => {
    expect(PET_V3_SESSION_KEY).not.toBe(PET_V2_SESSION_KEY);
    expect(PET_V3_DRAFT_STORAGE_KEY).not.toBe(PET_V2_DRAFT_STORAGE_KEY);
    expect(PET_V3_EVENT_PATH).toBe("/api/pet-v3/funnel-event");
    expect(PET_V3_SPECIES).toBe("cat");
    expect(sanitizeV3Pathname("/pet/cat-v3")).toBe("/pet/cat-v3");
    expect(sanitizeV3Pathname("/pet/dog-v2")).toBeNull();
  });

  it("never writes V3 events into V1 or V2 allow-lists", () => {
    for (const name of PET_V3_EVENTS) {
      expect((PET_FUNNEL_ALLOWED_EVENTS as readonly string[]).includes(name)).toBe(false);
      expect(name.startsWith("v3_")).toBe(true);
      expect(isPetV3EventName(name)).toBe(true);
    }
    expect(readSrc("src/features/pet-v2/analytics.ts")).not.toContain("v3_");
    expect(readSrc("vercel.json")).toContain("/api/pet-v3/funnel-event");
  });

  it("uses cat royal preview configuration and rejects non-cat V3 requests", () => {
    expect(PET_V3_FUNNEL_CONFIG.previewScene).toBe("royal-portrait");
    expect(PET_V3_FUNNEL_CONFIG.copy.landingHeadline).toContain("12 secret lives");
    expect(PET_V3_FUNNEL_CONFIG.copy.landingCta).toBe("Create my free preview");
    expect(PET_V3_FUNNEL_CONFIG.copy.offerHeadline).toContain("Unlock your cat");

    const ok = resolvePreviewContext({ funnel_version: "v3", species: "cat" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.ctx.version).toBe("v3");
      expect(ok.ctx.sceneKey).toBe("royal-portrait");
      const prompt = buildPreviewPrompt(ok.ctx, "cat");
      expect(prompt).toContain(ROYAL_CAT_EDIT.slice(0, 40));
      expect(prompt).not.toContain("Formula 1");
    }

    const dog = resolvePreviewContext({ funnel_version: "v3", species: "dog" });
    expect(dog.ok).toBe(false);

    const v2 = resolvePreviewContext({ species: "dog" });
    expect(v2.ok).toBe(true);
    if (v2.ok) {
      expect(v2.ctx.version).toBe("v2");
      expect(buildPreviewPrompt(v2.ctx, "dog")).toContain("Formula 1");
    }
  });

  it("scopes preview attempts and rate limits separately from V2", () => {
    const preview = readSrc("supabase/functions/pet-v2-preview/index.ts");
    const shared = readSrc("supabase/functions/_shared/pet/previewFunnelContext.ts");
    expect(shared).toContain("pet_v3_preview_attempts");
    expect(shared).toContain("claim_pet_v3_preview_attempt");
    expect(preview).toContain("resolvePreviewContext");
    expect(preview).toContain("ctx.attemptsTable");
    expect(preview).toContain("ctx.claimRpc");
    expect(readSrc("supabase/migrations/20260825193000_pet_v3_cat_funnel.sql")).toContain(
      "pet_v3_preview_attempts",
    );
  });

  it("preserves preview back-restore and replace-photo flows", () => {
    const uploadA = "upload-a";
    const uploadB = "upload-b";
    const attemptA = `preview:${sessionId}:${uploadA}`;
    const draft = {
      uploadId: uploadA,
      previewAttemptId: attemptA,
      generatedPreviewDataUrl: "data:image/jpeg;base64,abc",
      generationMode: "live" as const,
    };
    expect(shouldRestoreLocalPreview(draft, false)).toBe(true);
    expect(backStepFrom("offer", draft)).toBe("preview");

    const cleared = clearPreviewOnPhotoChange({
      uploadId: uploadB,
      photoPreviewDataUrl: "data:image/jpeg;base64,new",
    });
    expect(cleared.previewAttemptId).toBeNull();
    expect(cleared.generatedPreviewDataUrl).toBeNull();

    const timeoutRetry = resolveGenerateAttempt({
      sessionId,
      uploadId: uploadA,
      previewAttemptId: attemptA,
      regenerate: false,
      retryAfterFailure: true,
      lastFailureCategory: "timeout",
    });
    expect(timeoutRetry.attemptId).toBe(attemptA);

    const freshRetry = resolveGenerateAttempt({
      sessionId,
      uploadId: uploadA,
      previewAttemptId: attemptA,
      regenerate: false,
      retryAfterFailure: true,
      lastFailureCategory: "server_error",
    });
    expect(freshRetry.attemptId).not.toBe(attemptA);
  });

  it("records one unlock and one initiate checkout for V3", () => {
    const eventId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const unlockKey = v3IdempotencyKey({
      sessionId,
      eventName: "v3_unlock_clicked",
      eventId,
    });
    expect(unlockKey).toContain("v3_unlock_clicked");
    expect(unlockKey).toContain(eventId);

    const mapped = mapV3CountsToPrimarySteps(
      namedEventCounts([
        { event_name: "v3_unlock_clicked", unique_sessions: 1 },
        { event_name: "v3_begin_checkout", unique_sessions: 1 },
      ]),
    );
    expect(mapped.order_review_viewed).toBe(1);
    expect(mapped.initiate_checkout).toBe(1);
  });
});

describe("V3 checkout analytics", () => {
  beforeEach(() => {
    vi.mocked(trackPetV3Event).mockClear();
  });

  it("does not emit v3_begin_checkout before Stripe session creation succeeds", () => {
    expect(
      trackV3BeginCheckout({
        result: {
          status: "open",
          sessionId: "cs_test",
          checkoutUrl: "/pet/checkout",
          orderId: "order-1",
          amountCents: 1200,
        },
        fallbackAmountCents: 1200,
      }),
    ).toBe(false);
    expect(trackPetV3Event).not.toHaveBeenCalled();
  });

  it("emits exactly one v3_begin_checkout after live Stripe session opens", () => {
    const result = {
      status: "open",
      sessionId: "cs_live_abc",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_live_abc",
      orderId: "order-live-1",
      chargedAmountCents: 1200,
      eventId: "eeeeeeee-1111-4222-8333-444444444401",
    };
    expect(shouldTrackPetBeginCheckout(result)).toBe(true);
    expect(
      trackV3BeginCheckout({
        result,
        fallbackAmountCents: 1200,
      }),
    ).toBe(true);
    expect(trackPetV3Event).toHaveBeenCalledTimes(1);
    expect(trackPetV3Event).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "v3_begin_checkout",
        amountCents: 1200,
        attemptId: "order-live-1",
      }),
    );
  });
});

describe("V3 dataset and pricing", () => {
  it("maps V3 purchases to the V3 dataset and leaves V2 counts untouched", () => {
    expect(FUNNEL_DATASETS.v3.displayName).toBe("Pet TDG Cat Funnel testing");
    expect(FUNNEL_DATASETS.v3.funnelVariant).toBe("v3_cat_preview");
    expect(FUNNEL_DATASETS.v3.eventSource).toBe("pet_v3_funnel_events");
    expect(isDatasetConfigured("v3")).toBe(false);
    expect(rpcCampaignIdForDataset("v3")).toBe("__not_configured__");

    const v3 = mapV3CountsToPrimarySteps(
      namedEventCounts([{ event_name: "v3_purchase", unique_sessions: 3 }]),
    );
    const v2 = mapV2CountsToPrimarySteps(
      namedEventCounts([{ event_name: "v2_purchase", unique_sessions: 5 }]),
    );
    expect(v3.purchase).toBe(3);
    expect(v2.purchase).toBe(5);
  });

  it("charges exactly $12 through pet-funnel for V3 without changing V2", () => {
    expect(PET_V3_PRICE_CENTS).toBe(1200);
    expect(readSrc("supabase/functions/pet-funnel/index.ts")).toContain("applyV3SaleAmount");
    expect(readSrc("supabase/functions/pet-funnel/index.ts")).toContain('metadata[funnel_version]", "v3"');
    expect(readSrc("supabase/functions/pet-funnel/index.ts")).toContain('metadata[species]"');
    expect(readSrc("src/features/pet-v3/PetV3FunnelPage.tsx")).toContain('funnelVariant: "v3"');
    expect(readSrc("supabase/functions/_shared/pet/stripeFulfill.ts")).toContain("record_pet_v3_funnel_event");
    expect(readSrc("supabase/functions/pet-generate/index.ts")).toContain("species: order.species");
  });

  it("renders mobile-first V3 shell without dog assets in copy", () => {
    const landing = readSrc("src/features/pet-v3/screens/LandingScreen.tsx");
    expect(landing).toContain("V3StickyCta");
    expect(PET_V3_FUNNEL_CONFIG.copy.landingCta).toBe("Create my free preview");
    expect(landing).not.toContain("Formula 1");
    expect(landing).not.toContain("your dog");
    expect(readSrc("src/features/pet-v3/V3ExampleStrip.tsx")).toContain('species="cat"');
    expect(readSrc("src/features/pet-v3/V3ExampleStrip.tsx")).not.toContain('species="dog"');
  });
});
