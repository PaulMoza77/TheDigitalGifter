import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PetFunnelApi } from "../api";
import { PetApiError } from "../api";
import type { PetSceneResult, PetUpsellOfferView } from "../types";
import { upsellReturnUrls } from "../upsellUi";

export function RetryPackPanel({
  offer,
  scenes,
  publicToken,
  api,
  onPurchased,
  embedded = false,
}: {
  offer: PetUpsellOfferView | null;
  scenes: PetSceneResult[];
  publicToken: string;
  api: PetFunnelApi;
  onPurchased?: () => void;
  embedded?: boolean;
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
      const urls = upsellReturnUrls(publicToken, "retry");
      const checkout = await api.createUpsellCheckout({
        publicToken,
        upsellKey: "retry_3_scenes",
        sceneKeys: selected,
        successUrl: urls.successUrl,
        cancelUrl: urls.cancelUrl,
      });
      if (checkout.checkoutUrl.startsWith("preview://")) {
        toast.success("Retry queued");
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

  if (embedded) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">3-Scene Retry</p>
            <p className="mt-1 text-xs text-zinc-400">
              Pick up to 3 portraits to regenerate — same pet photo.
            </p>
          </div>
          <p className="text-lg font-bold text-amber-300">{offer.priceDisplay}</p>
        </div>

        {offer.purchased ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Retry purchased — refresh to see updated portraits.
          </p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {readyScenes.map((scene) => {
                const active = selected.includes(scene.sceneId);
                return (
                  <button
                    key={scene.sceneId}
                    type="button"
                    onClick={() => toggleScene(scene.sceneId)}
                    className={`overflow-hidden rounded-lg border transition ${
                      active
                        ? "border-amber-400 ring-2 ring-amber-400/30"
                        : "border-white/10 opacity-80 hover:opacity-100"
                    }`}
                  >
                    {scene.previewUrl ? (
                      <img src={scene.previewUrl} alt="" className="aspect-square w-full object-cover" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              disabled={loading || selected.length < 1}
              className="mt-3 h-11 w-full rounded-xl bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300"
              onClick={() => void checkout()}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Retry {selected.length || 3} scenes — {offer.priceDisplay}
            </Button>
            <p className="mt-2 text-center text-[11px] text-zinc-500">
              {selected.length}/3 selected
            </p>
          </>
        )}
      </div>
    );
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
          <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
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
                    <img src={scene.previewUrl} alt="" className="aspect-square w-full object-cover" />
                  ) : null}
                  <div className="truncate px-2 py-1.5 text-[10px] font-medium text-[#f6efe4]">
                    {scene.title}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#f6efe4]/60">{selected.length}/3 selected</p>
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
