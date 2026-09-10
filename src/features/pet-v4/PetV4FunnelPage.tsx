import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { trackMetaInitiateCheckout } from "@/lib/metaPixel";
import { validateOtherSubtype } from "../pet/croGuards";
import { canGenerateWithSpeciesConfirm } from "../pet-funnel-shared/speciesConfirm";
import { remainingSessionPreviews } from "../pet-v2/abuse";
import { trackPetV4Event } from "./analytics";
import { petV4LandingPath } from "./campaign";
import { useV4BehaviorTracking, trackV4CtaClick } from "./behavior";
import { shouldTrackPetBeginCheckout } from "../pet/funnelAnalytics";

import { cryptoRandomId } from "../pet-v2/previewAttempt";
import { backStepFrom, clearPreviewOnPhotoChange } from "../pet-v2/previewFlow";
import { fetchV2ProviderStatus } from "../pet-v2/providerStatus";
import { createV2LocalPreview, validateV2PhotoFile } from "../pet-v2/photo";
import { warmV2CheckoutDependencies } from "../pet-v2/checkoutWarmup";
import {
  getV2PhotoFile,
  getV2PhotoObjectUrl,
  loadV2Draft,
  saveV2Draft,
  setV2PhotoFile,
} from "../pet-v2/storage";
import { draftAfterSpeciesRouteChange } from "../pet-v2/speciesRouteIsolation";
import { buildV2PersonalizedTeaser } from "../pet-v2/teaser";
import { useV4EmbeddedCheckout } from "./useV4EmbeddedCheckout";
import { V2LandingScreen } from "../pet-v2/screens/LandingScreen";
import { V2PhotoScreen } from "../pet-v2/screens/PhotoScreen";
import { TeaserOfferScreen } from "../pet-v2/screens/TeaserOfferScreen";
import {
  V2_PROVIDER_UNAVAILABLE_COPY,
  type PetV2Draft,
  type PetV2Species,
  type PetV2Step,
} from "../pet-v2/types";
import { PET_V4_PRICE_CENTS } from "./types";
import { V2Shell } from "../pet-v2/V2Shell";

function normalizeLegacyStep(step: PetV2Step): PetV2Step {
  if (step === "generating" || step === "preview") {
    return "photo";
  }
  return step;
}

export function PetV4FunnelPage({ species }: { species: PetV2Species }) {
  const navigate = useNavigate();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const teaserLockRef = useRef(false);
  const cancelTrackedRef = useRef(false);
  const [draft, setDraft] = useState<PetV2Draft>(() => {
    const loaded = loadV2Draft();
    const isolated = draftAfterSpeciesRouteChange(loaded, species);
    if (isolated.clearInMemoryPhoto) setV2PhotoFile(null);
    return { ...isolated.draft, step: normalizeLegacyStep(isolated.draft.step) };
  });
  const [photoError, setPhotoError] = useState<string | undefined>();
  const [speciesConfirmed, setSpeciesConfirmed] = useState(false);
  const [teaserBusy, setTeaserBusy] = useState(false);
  const [providerBlocked, setProviderBlocked] = useState<string | null>(null);
  const previewUrl = getV2PhotoObjectUrl() ?? draft.photoPreviewDataUrl;

  const checkoutActive = draft.step === "teaser" || draft.step === "offer";
  useV4BehaviorTracking({
    enabled: true,
    species,
    mainCtaSelector: "[data-v2-hero-cta], [data-pet-cta=hero]",
    pricingSelector: "[data-pet-pricing], [data-v2-offer]",
  });

  const checkout = useV4EmbeddedCheckout({
    active: checkoutActive && Boolean(draft.photo) && Boolean(getV2PhotoFile() || draft.orderId),
    photo: draft.photo,
    file: getV2PhotoFile(),
    species,
    onRestartExpired: () => {
      setPhotoError("Your secure checkout session expired. Please upload your pet photo again.");
      go("photo", { orderId: null, publicToken: null });
    },
  });

  useEffect(() => {
    warmV2CheckoutDependencies();
  }, []);

  useEffect(() => {
    const loaded = loadV2Draft();
    const isolated = draftAfterSpeciesRouteChange(loaded, species);
    if (isolated.clearInMemoryPhoto) {
      setV2PhotoFile(null);
      setSpeciesConfirmed(false);
      setPhotoError(undefined);
      setProviderBlocked(null);
    }
    const next = { ...isolated.draft, step: normalizeLegacyStep(isolated.draft.step) };
    setDraft(next);
    saveV2Draft(next);
    trackPetV4Event({ eventName: "v4_landing_view", species });
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow");
  }, [species]);

  useEffect(() => {
    saveV2Draft(draft);
  }, [draft]);

  // Cancel recovery: restore teaser/offer when returning from Stripe with ?checkout=canceled
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "canceled") return;
    if (!cancelTrackedRef.current) {
      cancelTrackedRef.current = true;
      trackPetV4Event({ eventName: "v4_checkout_abandoned", species, ctaLocation: "checkout" });
    }
    if (draft.generatedPreviewDataUrl && draft.generationMode === "teaser") {
      go("teaser", { lastError: null });
    }
    // Clean query without losing history state
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [species, draft.generatedPreviewDataUrl, draft.generationMode]);

  // Persist order identity from checkout bootstrap onto the draft
  useEffect(() => {
    if (!checkout.orderId || !checkout.publicToken) return;
    if (draft.orderId === checkout.orderId && draft.publicToken === checkout.publicToken) return;
    setDraft((current) => ({
      ...current,
      orderId: checkout.orderId,
      publicToken: checkout.publicToken,
    }));
  }, [checkout.orderId, checkout.publicToken, draft.orderId, draft.publicToken]);

  function go(step: PetV2Step, patch: Partial<PetV2Draft> = {}) {
    setDraft((current) => ({ ...current, ...patch, species, step }));
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    trackV4CtaClick("upload", species);
    trackPetV4Event({ eventName: "v4_upload_opened", species });
    trackPetV4Event({ eventName: "v4_upload_started", species });
    const check = validateV2PhotoFile(file);
    if (!check.ok) {
      setPhotoError(check.message);
      trackPetV4Event({
        eventName: "v4_upload_failed",
        species,
        failureCategory: "invalid_image",
      });
      go("photo");
      return;
    }
    setV2PhotoFile(file);
    const local = await createV2LocalPreview(file);
    setPhotoError(undefined);
    setSpeciesConfirmed(false);
    setProviderBlocked(null);
    warmV2CheckoutDependencies();
    trackPetV4Event({ eventName: "v4_upload_completed", species });
    go(
      "photo",
      clearPreviewOnPhotoChange({
        photo: { fileName: file.name, contentType: check.contentType, byteSize: file.size },
        uploadId: cryptoRandomId(),
        photoPreviewDataUrl: local,
        orderId: null,
        publicToken: null,
      }),
    );
  }

  async function createTeaser() {
    if (teaserLockRef.current || teaserBusy) return;
    const file = getV2PhotoFile();
    if (!file) {
      setPhotoError("Re-attach the original photo to continue.");
      go("photo");
      return;
    }
    if (species === "other") {
      const subtypeCheck = validateOtherSubtype({
        species,
        subtype: draft.subtype,
        subtypeDetail: draft.subtypeDetail,
      });
      if (!subtypeCheck.ok) {
        setPhotoError(subtypeCheck.message);
        go("photo");
        return;
      }
    } else {
      const confirm = canGenerateWithSpeciesConfirm({
        hasPhoto: true,
        confirmed: speciesConfirmed,
        kind: species === "cat" ? "cat" : "dog",
      });
      if (!confirm.ok) {
        setPhotoError(confirm.message);
        go("photo");
        return;
      }
    }

    trackV4CtaClick("try_generate", species);
    trackPetV4Event({ eventName: "v4_cta_clicked", species, ctaLocation: "try_generate", attemptId: "species_confirmed" });

    // Restore existing teaser without recomputing
    if (draft.generatedPreviewDataUrl && draft.generationMode === "teaser") {
      trackPetV4Event({ eventName: "v4_teaser_viewed", species });
      trackPetV4Event({ eventName: "v4_offer_viewed", species });
      go("teaser", { lastError: null });
      return;
    }

    teaserLockRef.current = true;
    setTeaserBusy(true);
    const attemptId = draft.previewAttemptId || cryptoRandomId();
    const genStartedAt = Date.now();
    trackPetV4Event({
      eventName: "v4_generation_started",
      species,
      attemptId,
    });
    go("teaser", { lastError: null, previewAttemptId: attemptId });

    try {
      const status = await fetchV2ProviderStatus();
      if (!status.available) {
        setProviderBlocked(status.message || V2_PROVIDER_UNAVAILABLE_COPY);
        trackPetV4Event({
          eventName: "v4_generation_failed",
          species,
          failureCategory: "provider_unavailable",
          attemptId,
        });
      } else {
        setProviderBlocked(null);
      }

      const result = await buildV2PersonalizedTeaser(file);
      if (!result.ok) {
        trackPetV4Event({
          eventName: "v4_generation_failed",
          species,
          attemptId,
          failureCategory: result.failureCategory,
          generationDurationMs: Date.now() - genStartedAt,
        });
        go("photo", { lastError: result.error, previewAttemptId: attemptId });
        setPhotoError(result.error);
        return;
      }
      trackPetV4Event({
        eventName: "v4_generation_completed",
        species,
        attemptId,
        generationDurationMs: Date.now() - genStartedAt,
      });
      trackPetV4Event({ eventName: "v4_teaser_viewed", species });
      trackPetV4Event({ eventName: "v4_offer_viewed", species });
      go("teaser", {
        generatedPreviewDataUrl: result.teaserDataUrl,
        generationMode: "teaser",
        previewCount: draft.previewCount + 1,
        previewAttemptId: attemptId,
        lastError: null,
      });
    } finally {
      teaserLockRef.current = false;
      setTeaserBusy(false);
    }
  }

  const step = draft.step === "offer" ? "teaser" : draft.step;

  return (
    <V2Shell
      species={species}
      showBack={step !== "landing"}
      footer={
        step === "landing"
          ? "Free personalized teaser — unlock the full collection for $2.99."
          : undefined
      }
      padForSticky={step === "landing"}
      onBack={() => {
        if (teaserBusy) return;
        go(backStepFrom(step, draft));
      }}
      onSpecies={
        step === "landing"
          ? (next) => {
              void navigate(petV4LandingPath(next));
            }
          : undefined
      }
    >
      <PageHead
        title={
          species === "cat"
            ? "Reveal your cat’s secret life | My Pet’s Secret Life"
            : species === "other"
              ? "Reveal your pet’s secret life | My Pet’s Secret Life"
              : "Reveal your dog’s secret life | My Pet’s Secret Life"
        }
        description="Upload one photo for a free blurred teaser, then unlock 12 secret lives and 2 mini clips for $2.99."
      />

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,image/heic,image/heif"
        className="sr-only"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />

      {step === "landing" ? (
        <V2LandingScreen
          species={species}
          fileInputId={inputId}
          onUploadClick={() => {
            trackV4CtaClick("hero", species);
            trackPetV4Event({ eventName: "v4_upload_opened", species });
            inputRef.current?.click();
          }}
        />
      ) : null}

      {step === "photo" ? (
        <V2PhotoScreen
          species={species}
          previewUrl={previewUrl}
          fileName={draft.photo?.fileName}
          error={photoError || draft.lastError || undefined}
          inputId={inputId}
          inputRef={inputRef}
          generating={teaserBusy}
          subtype={draft.subtype}
          subtypeDetail={draft.subtypeDetail}
          onSubtype={(subtype, detail) => go("photo", { subtype, subtypeDetail: detail || null })}
          onClear={() => {
            setV2PhotoFile(null);
            setPhotoError(undefined);
            setSpeciesConfirmed(false);
            setProviderBlocked(null);
            go(
              "photo",
              clearPreviewOnPhotoChange({
                photo: null,
                uploadId: null,
                photoPreviewDataUrl: null,
                orderId: null,
                publicToken: null,
              }),
            );
          }}
          speciesConfirmed={speciesConfirmed}
          onSpeciesConfirmed={setSpeciesConfirmed}
          onViewPreview={
            draft.generatedPreviewDataUrl && draft.generationMode === "teaser"
              ? () => {
                  trackPetV4Event({ eventName: "v4_teaser_viewed", species });
                  trackPetV4Event({ eventName: "v4_offer_viewed", species });
                  go("teaser", { lastError: null });
                }
              : undefined
          }
          onGenerate={() => void createTeaser()}
        />
      ) : null}

      {step === "teaser" && draft.generatedPreviewDataUrl ? (
        <TeaserOfferScreen
          teaserUrl={draft.generatedPreviewDataUrl}
          species={species}
          checkout={checkout}
          email={draft.email}
          petName={draft.petName}
          onEmail={(email) => go("teaser", { email })}
          onPetName={(petName) => go("teaser", { petName })}
          providerBlocked={providerBlocked}
          onPaymentInteraction={() => {
            const beginPayload = {
              orderId: checkout.orderId || "pending",
              sessionId: checkout.sessionId,
              checkoutUrl: null as string | null,
              clientSecret: checkout.clientSecret,
              status: "open",
              amountCents: checkout.amountCents || PET_V4_PRICE_CENTS,
              chargedAmountCents: checkout.amountCents || PET_V4_PRICE_CENTS,
            };
            if (shouldTrackPetBeginCheckout(beginPayload)) {
              trackV4CtaClick("checkout", species, checkout.orderId || undefined);
              trackPetV4Event({
                eventName: "v4_checkout_clicked",
                species,
                amountCents: beginPayload.amountCents,
                attemptId: beginPayload.orderId,
                ctaLocation: "checkout",
              });
            }
            if (checkout.orderId && checkout.amountCents > 0) {
              trackMetaInitiateCheckout({
                eventId: checkout.eventId || `pet_ic_${checkout.orderId}`,
                valueCents: checkout.amountCents,
                orderId: checkout.orderId,
              });
            }
          }}
          onCheckoutReady={() => {
            trackPetV4Event({
              eventName: "v4_checkout_opened",
              species,
              amountCents: checkout.amountCents || PET_V4_PRICE_CENTS,
              attemptId: checkout.orderId || undefined,
              ctaLocation: "checkout",
            });
          }}
          onPaymentAttempt={() => {
            trackV4CtaClick("buy", species, checkout.orderId || undefined);
          }}
          onPaymentFailed={(detail) => {
            trackPetV4Event({
              eventName: "v4_checkout_abandoned",
              species,
              amountCents: checkout.amountCents || PET_V4_PRICE_CENTS,
              attemptId: checkout.orderId || undefined,
              failureCategory: detail?.failureCode || "payment_failed",
              ctaLocation: "checkout",
            });
          }}
          onCheckoutInitError={() => {
            trackPetV4Event({
              eventName: "v4_checkout_abandoned",
              species,
              failureCategory: "checkout_error",
              ctaLocation: "checkout",
            });
          }}
          onExpressCancel={() => {
            trackPetV4Event({
              eventName: "v4_checkout_abandoned",
              species,
              amountCents: checkout.amountCents || PET_V4_PRICE_CENTS,
              attemptId: checkout.orderId || undefined,
              ctaLocation: "checkout",
            });
          }}
        />
      ) : null}

      {step === "teaser" && !draft.generatedPreviewDataUrl && teaserBusy ? (
        <div className="mx-auto max-w-md space-y-4 py-10 text-center">
          <div className="mx-auto h-24 w-24 animate-pulse rounded-2xl bg-[#f6efe4]/10" aria-hidden="true" />
          <p className="text-lg font-semibold text-[#f6efe4]">Preparing your secret-life teaser…</p>
          <p className="text-sm text-[#f6efe4]/65">Usually ready in a few seconds. No charge yet.</p>
        </div>
      ) : null}

      {/* Keep session preview quota helper referenced for abuse module tree-shaking safety */}
      <span className="hidden" aria-hidden="true">
        {remainingSessionPreviews()}
      </span>
    </V2Shell>
  );
}
