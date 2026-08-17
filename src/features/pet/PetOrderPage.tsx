import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PetApiError, type PetFunnelApi } from "./api";
import { petFunnelApi } from "./supabaseApi";
import { OrderStatusList, PetShell, ResultsGrid } from "./components";
import type {
  PetFunnelNavigation,
  PetGenerationProgress,
  PetOrder,
  PetOrderResults,
} from "./types";
import { createPreviewResults } from "./previewApi";
import { trackMetaPurchaseOnce } from "@/lib/metaPixel";
import {
  isFatalOrderLookupError,
  isTransientPollError,
  mergeOrderWithProgress,
  ORDER_POLL_INTERVAL_MS,
  shouldKeepPolling,
  withTimeout,
} from "./orderStatusPolling";

export type PetOrderPageProps = {
  navigation?: PetFunnelNavigation;
  api?: PetFunnelApi;
  publicToken?: string;
  previewOrder?: PetOrder;
  previewResults?: PetOrderResults;
};

export function PetOrderPage({
  navigation,
  api = petFunnelApi,
  publicToken,
  previewOrder,
  previewResults,
}: PetOrderPageProps) {
  const [order, setOrder] = useState<PetOrder | null>(previewOrder ?? null);
  const [progress, setProgress] = useState<PetGenerationProgress | null>(null);
  const [results, setResults] = useState<PetOrderResults | null>(previewResults ?? null);
  const [error, setError] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(!previewOrder);

  const orderRef = useRef(order);
  const resultsRef = useRef(results);
  orderRef.current = order;
  resultsRef.current = results;

  useEffect(() => {
    if (previewOrder) {
      setOrder(previewOrder);
      setResults(previewResults ?? createPreviewResults(previewOrder));
      setLoading(false);
      setError(null);
      setStatusHint(null);
      return;
    }

    if (!publicToken) {
      setLoading(false);
      setError("This order link is missing its secure token.");
      return;
    }

    let cancelled = false;
    let inFlight = false;
    let loadedOnce = Boolean(orderRef.current);
    let intervalId: number | undefined;

    async function refresh() {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const token = publicToken!;
        const nextOrder = loadedOnce
          ? orderRef.current
          : await withTimeout(api.getOrderByPublicToken({ publicToken: token }));
        if (cancelled) return;
        if (!nextOrder) {
          throw new PetApiError("ORDER_NOT_FOUND", "We could not find that order.", 404);
        }
        if (!loadedOnce) {
          loadedOnce = true;
          orderRef.current = nextOrder;
          setOrder(nextOrder);
          setLoading(false);
        }

        const nextProgress = await withTimeout(api.pollGenerationProgress({ publicToken: token }));
        if (cancelled) return;

        const merged = mergeOrderWithProgress(nextOrder, nextProgress);
        loadedOnce = true;
        orderRef.current = merged;
        setOrder(merged);
        setProgress(nextProgress);
        setError(null);
        setStatusHint(null);
        setLoading(false);

        if (merged.paidAt && (merged.chargedAmountCents ?? merged.amountCents) > 0) {
          trackMetaPurchaseOnce({
            eventId: merged.purchaseEventId || `pet_purchase_${merged.id}`,
            amountCents: merged.chargedAmountCents ?? merged.amountCents,
            orderId: merged.id,
            paidAt: merged.paidAt,
          });
        }

        if (merged.status === "complete" && !resultsRef.current) {
          const nextResults = await withTimeout(api.getOrderResults({ publicToken: token }));
          if (!cancelled) setResults(nextResults);
        }

        if (!shouldKeepPolling(merged.status) && intervalId !== undefined) {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }
      } catch (caught) {
        if (cancelled) return;
        setLoading(false);
        const hasOrder = loadedOnce || Boolean(orderRef.current);
        if (hasOrder && isTransientPollError(caught)) {
          setStatusHint("Still checking the studio. You can leave this page — generation keeps going.");
          setError(null);
          return;
        }
        if (hasOrder && !isFatalOrderLookupError(caught)) {
          setStatusHint("Still checking the studio. You can leave this page — generation keeps going.");
          setError(null);
          return;
        }
        if (caught instanceof PetApiError && caught.code === "PET_API_NOT_CONNECTED") {
          setError("Order tracking is typed and ready, but the backend is not connected yet.");
        } else if (caught instanceof PetApiError && caught.code === "ORDER_NOT_FOUND") {
          setError("We could not find that order. Check the link from your email.");
        } else if (caught instanceof Error) {
          setError(caught.message);
        } else {
          setError("Could not load this order.");
        }
      } finally {
        inFlight = false;
      }
    }

    void refresh();
    intervalId = window.setInterval(() => {
      void refresh();
    }, ORDER_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [api, previewOrder, previewResults, publicToken]);

  const scenes = progress?.scenes ?? order?.scenes ?? [];
  const overallPercent = useMemo(() => {
    if (progress) return progress.overallPercent;
    if (!scenes.length) return 0;
    return Math.round(scenes.reduce((sum, scene) => sum + scene.progressPercent, 0) / scenes.length);
  }, [progress, scenes]);

  const showResults = Boolean(results) && order?.status === "complete";
  const live = Boolean(order) && shouldKeepPolling(order?.status);

  return (
    <PetShell
      navigation={navigation}
      species={order?.species ?? "dog"}
      showBack
      backLabel="Back"
      onBack={() => navigation?.goToLanding(order?.species)}
    >
      <div className="space-y-8">
        <section>
          <h1 className="text-3xl font-semibold tracking-tight text-[#f6efe4] sm:text-4xl">
            {order ? `${order.petName}’s portraits` : "Your pet portraits"}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#f6efe4]/65">
            {statusCopy(order?.status, progress?.phase || order?.phase)}
          </p>
          <p className="mt-2 text-sm text-[#f6efe4]/55">Replicate starts as soon as you pay. Portraits usually appear within a few minutes.</p>
          {live ? (
            <p className="mt-2 text-sm text-[#f6efe4]/50">
              This page stays live and never locks. You can go back anytime — the studio keeps working.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="min-w-[180px] flex-1">
              <div
                className="h-1.5 overflow-hidden rounded-full bg-[#f6efe4]/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={overallPercent}
                aria-busy={live}
                aria-label="Overall portrait progress"
              >
                <div
                  className={`h-full rounded-full bg-[#d4a84b] transition-all ${
                    live && overallPercent === 0 ? "animate-pulse" : ""
                  }`}
                  style={{ width: live && overallPercent === 0 ? "12%" : `${overallPercent}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-[#f6efe4]/55">
                {overallPercent}% complete
                {live ? " · checking status" : ""}
              </p>
            </div>
            <p className="inline-flex items-center gap-2 text-sm text-[#f6efe4]/60">
              <ShieldCheck className="h-4 w-4 text-[#d4a84b]" aria-hidden="true" />
              Human QC
            </p>
          </div>
        </section>

        {loading && !order ? (
          <p className="inline-flex items-center gap-2 text-sm text-[#f6efe4]/70">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading the studio…
          </p>
        ) : null}

        {statusHint ? (
          <p className="text-sm text-[#f6efe4]/60" role="status">
            {statusHint}
          </p>
        ) : null}

        {error ? (
          <div className="rounded-3xl border border-[#e07a5f]/30 bg-[#e07a5f]/10 p-5" role="alert">
            <p className="font-medium text-[#f0b4a0]">{error}</p>
            <Button
              type="button"
              className="mt-4 h-10 rounded-full bg-[#f6efe4] text-[#1a140e] hover:bg-white"
              onClick={() => navigation?.goToCreate()}
            >
              Start a new portrait order
            </Button>
          </div>
        ) : null}

        {order && scenes.length > 0 ? (
          <div aria-live="polite" aria-busy={live}>
            <OrderStatusList
              scenes={scenes}
              petName={order.petName}
              species={order.species}
              clips={progress?.clips ?? order.clips ?? []}
            />
          </div>
        ) : null}

        {showResults && results ? (
          <ResultsGrid results={results} species={order?.species} />
        ) : null}

        {!order && !loading && !error ? (
          <p className="text-sm text-[#f6efe4]/70">
            Preview this page with a sample order, or return after checkout.
          </p>
        ) : null}
      </div>
    </PetShell>
  );
}

function statusCopy(status: PetOrder["status"] | undefined, phase?: string): string {
  switch (phase) {
    case "generating_portraits":
      return "Creating the twelve portraits now.";
    case "portrait_qc":
      return "A person is checking that every portrait still looks like your pet.";
    case "selecting_video_scenes":
      return "Portraits passed review. Two scenes will be turned into cinematic clips.";
    case "generating_clips":
      return "Creating two 5-second cinematic clips from the approved portraits.";
    case "video_qc":
      return "A person is checking both cinematic clips before release.";
    default:
      break;
  }
  switch (status) {
    case "generating":
    case "processing":
      return "Creating the twelve portraits now.";
    case "awaiting_qc":
    case "quality_control":
      return "A person is checking that every portrait still looks like your pet.";
    case "selecting_video_scenes":
      return "Portraits passed review. Two scenes will be turned into cinematic clips.";
    case "generating_videos":
      return "Creating two 5-second cinematic clips from the approved portraits.";
    case "awaiting_video_qc":
      return "A person is checking both cinematic clips before release.";
    case "partial_failure":
      return "Most of the pack finished. A failed portrait or clip needs a retry.";
    case "complete":
      return "Ready. Download the portraits and clips below.";
    case "failed":
      return "Paused. Nothing extra was charged.";
    case "refunded":
      return "This order was refunded.";
    case "paid":
      return "Paid. The twelve scenes are lining up.";
    default:
      return "Watch each portrait and clip move from queued to ready. Delivery only after QC.";
  }
}
