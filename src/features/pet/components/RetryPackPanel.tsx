import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PetFunnelApi } from "../api";
import { PetApiError } from "../api";
import type { PetSceneResult, PetUpsellOfferView } from "../types";

export function RetryPackPanel({
  offer,
  scenes,
  publicToken,
  api,
  onPurchased,
}: {
  offer: PetUpsellOfferView | null;
  scenes: PetSceneResult[];
  publicToken: string;
  api: PetFunnelApi;
  onPurchased?: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const readyScenes = useMemo(
    () => scenes.filter((scene) => scene.status === "ready" && scene.previewUrl),
    [scenes],
  );

  if (!offer) return null;

  function toggleScene(sceneId: string) {
    setSelected((current) => {
      if (current.includes(sceneId)) return current.filter((id) => id !== sceneId);
      if (current.length >= 3) {
        toast.message("Pick up to 3 portraits");
        return current;
      }
      return [...current, sceneId];
    });
  }

  async function checkout() {
    if (offer.purchased) return;
    if (selected.length < 1) {
      toast.message("Pick at least one portrait to retry");
      return;
    }
    setLoading(true);
    try {
      const checkout = await api.createUpsellCheckout({
        publicToken,
        upsellKey: "retry_3_scenes",
        sceneKeys: selected,
        successUrl: `${window.location.origin}/pet/order?token=${encodeURIComponent(publicToken)}&upsell=retry`,
        cancelUrl: `${window.location.origin}/pet/order?token=${encodeURIComponent(publicToken)}`,
      });
      if (checkout.checkoutUrl.startsWith("preview://")) {
        toast.success("Retry queued (preview)");
        onPurchased?.();
        return;
      }
      window.location.assign(checkout.checkoutUrl);
    } catch (caught) {
      toast.error(
        caught instanceof PetApiError
          ? caught.message
          : "Could not start checkout. No payment was taken.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[#d4af37]/25 bg-gradient-to-br from-[#1a1410] via-[#201812] to-[#142018] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#d4af37]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#d4af37]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Not quite right?
          </div>
          <h3 className="mt-3 text-2xl font-semibold text-[#f6efe4]">{offer.name}</h3>
          <p className="mt-2 text-sm text-[#f6efe4]/70">{offer.description}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold text-[#d4af37]">{offer.priceDisplay}</p>
          <p className="text-xs text-[#f6efe4]/50">One-time · same pet photo</p>
        </div>
      </div>

      {offer.purchased ? (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Your retry is queued or complete. Refresh this page to see updated portraits.
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {readyScenes.map((scene) => {
              const active = selected.includes(scene.sceneId);
              return (
                <button
                  key={scene.sceneId}
                  type="button"
                  onClick={() => toggleScene(scene.sceneId)}
                  className={`overflow-hidden rounded-xl border text-left transition ${
                    active
                      ? "border-[#d4af37] ring-2 ring-[#d4af37]/40"
                      : "border-[#f6efe4]/10 hover:border-[#f6efe4]/25"
                  }`}
                >
                  {scene.previewUrl ? (
                    <img
                      src={scene.previewUrl}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                  ) : null}
                  <div className="px-2 py-2 text-xs font-medium text-[#f6efe4]">{scene.title}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#f6efe4]/60">
              {selected.length}/3 selected · ~$0.12 AI cost per scene
            </p>
            <Button
              type="button"
              disabled={loading || selected.length < 1}
              className="h-11 rounded-xl bg-[#d4af37] px-6 text-[#120f0c] hover:bg-[#e0bc4a]"
              onClick={() => void checkout()}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {offer.cta}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
