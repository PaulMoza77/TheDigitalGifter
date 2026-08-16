import { useEffect, useMemo, useState } from "react";
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
  const [loading, setLoading] = useState(!previewOrder);

  useEffect(() => {
    if (previewOrder) {
      setOrder(previewOrder);
      setResults(previewResults ?? createPreviewResults(previewOrder));
      setLoading(false);
      setError(null);
      return;
    }

    if (!publicToken) {
      setLoading(false);
      setError("This order link is missing its secure token.");
      return;
    }

    let cancelled = false;

    async function refresh() {
      try {
        const nextOrder = await api.getOrderByPublicToken({ publicToken: publicToken! });
        const nextProgress = await api.pollGenerationProgress({ publicToken: publicToken! });
        if (cancelled) return;
        setOrder(nextOrder);
        setProgress(nextProgress);
        setError(null);
        setLoading(false);

        if (nextOrder.paidAt) {
          trackMetaPurchaseOnce(nextOrder.purchaseEventId || `pet_purchase_${nextOrder.id}`);
        }

        if (nextOrder.status === "complete") {
          const nextResults = await api.getOrderResults({ publicToken: publicToken! });
          if (!cancelled) setResults(nextResults);
        }
      } catch (caught) {
        if (cancelled) return;
        setLoading(false);
        if (caught instanceof PetApiError && caught.code === "PET_API_NOT_CONNECTED") {
          setError("Order tracking is typed and ready, but the backend is not connected yet.");
        } else if (caught instanceof PetApiError && caught.code === "ORDER_NOT_FOUND") {
          setError("We could not find that order. Check the link from your email.");
        } else if (caught instanceof Error) {
          setError(caught.message);
        } else {
          setError("Could not load this order.");
        }
      }
    }

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [api, previewOrder, previewResults, publicToken]);

  const scenes = progress?.scenes ?? order?.scenes ?? [];
  const overallPercent = useMemo(() => {
    if (progress) return progress.overallPercent;
    if (!scenes.length) return 0;
    return Math.round(scenes.reduce((sum, scene) => sum + scene.progressPercent, 0) / scenes.length);
  }, [progress, scenes]);

  const showResults = Boolean(results) && order?.status === "complete";

  return (
    <PetShell
      navigation={navigation}
      showBack
      backLabel="Back to the offer"
      onBack={() => navigation?.goToLanding()}
    >
      <div className="space-y-8">
        <section className="rounded-[28px] border border-[#f6efe4]/10 bg-[#1f1712]/80 p-5 sm:p-7">
          <p className="text-xs uppercase tracking-[0.22em] text-[#d4a84b]">Order studio</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f6efe4] sm:text-4xl">
            {order ? `${order.petName}’s secret lives` : "Your pet portraits"}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#f6efe4]/72">
            {statusCopy(order?.status)} We keep the same pet in every scene, then a person checks the
            faces before downloads unlock.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="min-w-[180px] flex-1">
              <div
                className="h-2 overflow-hidden rounded-full bg-[#f6efe4]/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={overallPercent}
                aria-label="Overall portrait progress"
              >
                <div
                  className="h-full rounded-full bg-[#d4a84b] transition-all"
                  style={{ width: `${overallPercent}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-[#f6efe4]/65">{overallPercent}% complete</p>
            </div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[#d4a84b]/12 px-3 py-1.5 text-sm text-[#f3d48a]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Human quality control
            </p>
          </div>
        </section>

        {loading ? (
          <p className="inline-flex items-center gap-2 text-sm text-[#f6efe4]/70">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading the studio…
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
          <div aria-live="polite">
            <OrderStatusList scenes={scenes} petName={order.petName} />
          </div>
        ) : null}

        {showResults && results ? (
          <div className="space-y-3">
            <ResultsGrid results={results} />
            <p className="text-sm text-[#f6efe4]/60">
              These are the 12 QC-approved portraits. Dimensions shown are the real generated file size.
              Wallpaper, social, and poster crops are Coming later and are not included.
            </p>
          </div>
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

function statusCopy(status: PetOrder["status"] | undefined): string {
  switch (status) {
    case "generating":
    case "processing":
      return "The studio is painting the twelve lives now.";
    case "awaiting_qc":
    case "quality_control":
      return "A person is checking that every portrait still looks like your pet.";
    case "partial_failure":
      return "Most scenes finished. A few need a retry before quality control can release the gallery.";
    case "complete":
      return "The gallery is ready. Download high-resolution files after human quality control.";
    case "failed":
      return "Generation paused. Nothing extra was charged.";
    case "refunded":
      return "This order was refunded. Downloads stay closed.";
    case "paid":
      return "Payment received. The twelve scenes are lining up.";
    default:
      return "Watch each secret life move from queued to ready.";
  }
}
