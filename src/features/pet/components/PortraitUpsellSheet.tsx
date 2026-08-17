import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Gift,
  ImageIcon,
  Loader2,
  LockOpen,
  Printer,
  ShieldCheck,
  Sparkles,
  TreePine,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PetFunnelApi } from "../api";
import { PetApiError } from "../api";
import type {
  PetOrderUpsellCatalog,
  PetSceneResult,
  PetSceneUpsellView,
  PetUpsellKey,
  PetUpsellOfferView,
} from "../types";
import { downloadUpsellExport } from "../upsellExports";
import {
  UPSELL_ORDER_SECTION,
  UPSELL_SCENE_SECTION,
  UPSELL_SHEET_SUBTITLE,
  UPSELL_SHEET_TITLE,
  UPSELL_TRUST_LINE,
  upsellReturnUrls,
} from "../upsellUi";
import { RetryPackPanel } from "./RetryPackPanel";

const OFFER_ICONS: Record<Exclude<PetUpsellKey, "retry_3_scenes">, typeof Gift> = {
  gift_pack: Gift,
  holiday_card: TreePine,
  print_pack: Printer,
};

const SCENE_OFFER_ORDER: Exclude<PetUpsellKey, "retry_3_scenes">[] = [
  "gift_pack",
  "holiday_card",
  "print_pack",
];

export function PortraitUpsellSheet({
  open,
  onOpenChange,
  scene,
  sceneUpsell,
  petName,
  publicToken,
  api,
  upsells,
  allScenes,
  onPurchased,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scene: PetSceneResult | null;
  sceneUpsell: PetSceneUpsellView | null;
  petName: string;
  publicToken: string;
  api: PetFunnelApi;
  upsells?: PetOrderUpsellCatalog | null;
  allScenes?: PetSceneResult[];
  onPurchased?: () => void;
}) {
  const [loadingKey, setLoadingKey] = useState<PetUpsellKey | null>(null);
  const [exportingKey, setExportingKey] = useState<PetUpsellKey | null>(null);

  const sceneOffers = useMemo(() => {
    const byKey = new Map(
      (sceneUpsell?.offers ?? [])
        .filter((offer) => offer.key !== "retry_3_scenes")
        .map((offer) => [offer.key, offer]),
    );
    return SCENE_OFFER_ORDER.map((key) => byKey.get(key)).filter(
      (offer): offer is PetUpsellOfferView => Boolean(offer),
    );
  }, [sceneUpsell?.offers]);

  const retryOffer =
    upsells?.orderUpsells.find((item) => item.key === "retry_3_scenes") ?? null;

  const livePreview =
    scene?.previewUrl && !scene.previewUrl.startsWith("preview://") ? scene.previewUrl : null;

  async function startCheckout(offer: PetUpsellOfferView) {
    if (!scene || offer.purchased || !offer.available) return;
    setLoadingKey(offer.key);
    try {
      const urls = upsellReturnUrls(publicToken);
      const checkout = await api.createUpsellCheckout({
        publicToken,
        upsellKey: offer.key,
        sceneKey: scene.sceneId,
        successUrl: urls.successUrl,
        cancelUrl: urls.cancelUrl,
      });
      if (checkout.checkoutUrl.startsWith("preview://")) {
        toast.success("Unlocked — download your files below.");
        onPurchased?.();
        onOpenChange(false);
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
      setLoadingKey(null);
    }
  }

  async function downloadPack(offer: PetUpsellOfferView) {
    if (!scene || !livePreview || !offer.purchased) return;
    setExportingKey(offer.key);
    try {
      await downloadUpsellExport({
        upsellKey: offer.key as "gift_pack" | "holiday_card" | "print_pack",
        imageUrl: livePreview,
        petName,
        sceneTitle: scene.title,
        width: sceneUpsell?.width,
        height: sceneUpsell?.height,
      });
      toast.success("Download started");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Download failed");
    } finally {
      setExportingKey(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-3xl border-white/10 bg-zinc-950 px-4 pb-8 pt-6 text-white sm:px-6"
      >
        <div className="mx-auto w-full max-w-lg">
          <SheetHeader className="text-left">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-200">
              <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />
              One-time unlock
            </div>
            <SheetTitle className="text-2xl font-semibold tracking-tight text-white">
              {UPSELL_SHEET_TITLE}
            </SheetTitle>
            <SheetDescription className="text-zinc-400">{UPSELL_SHEET_SUBTITLE}</SheetDescription>
          </SheetHeader>

          {scene && livePreview ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <img
                src={livePreview}
                alt=""
                className="h-20 w-20 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">{scene.title}</p>
                <p className="text-sm text-zinc-400">{petName}’s portrait</p>
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
              {UPSELL_SCENE_SECTION}
            </h3>
            <div className="mt-3 space-y-3">
              {sceneOffers.map((offer) => {
                const Icon = OFFER_ICONS[offer.key as keyof typeof OFFER_ICONS] ?? ImageIcon;
                const busy = loadingKey === offer.key || exportingKey === offer.key;
                const featured = offer.key === "gift_pack";
                return (
                  <article
                    key={offer.key}
                    className={`relative overflow-hidden rounded-2xl border p-4 ${
                      featured
                        ? "border-amber-400/35 bg-gradient-to-br from-amber-950/40 to-zinc-900/80"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    {featured && !offer.purchased ? (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-950">
                        <Zap className="h-3 w-3" aria-hidden="true" />
                        Popular
                      </span>
                    ) : null}
                    <div className="flex gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-amber-300">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1 pr-16">
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="font-semibold text-white">{offer.name}</h4>
                          <span className="text-sm font-bold text-amber-300">{offer.priceDisplay}</span>
                        </div>
                        <p className="mt-1 text-sm leading-snug text-zinc-400">{offer.description}</p>
                        {offer.key === "print_pack" && offer.printMaxSizeLabel ? (
                          <p className="mt-1.5 text-xs text-emerald-400/90">
                            Print-ready up to {offer.printMaxSizeLabel}
                          </p>
                        ) : null}
                        {!offer.available && offer.unavailableReason ? (
                          <p className="mt-1.5 text-xs text-amber-300/90">{offer.unavailableReason}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4">
                      {offer.purchased ? (
                        <Button
                          type="button"
                          className="h-11 w-full rounded-xl bg-amber-400 font-semibold text-zinc-950 hover:bg-amber-300"
                          disabled={busy || !livePreview}
                          onClick={() => void downloadPack(offer)}
                        >
                          {busy ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          )}
                          Download now
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          className={`h-11 w-full rounded-xl font-semibold ${
                            featured
                              ? "bg-amber-400 text-zinc-950 hover:bg-amber-300"
                              : "bg-white text-zinc-950 hover:bg-zinc-100"
                          }`}
                          disabled={busy || !offer.available}
                          onClick={() => void startCheckout(offer)}
                        >
                          {busy ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                          )}
                          Unlock — {offer.priceDisplay}
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {retryOffer && allScenes?.length ? (
            <div className="mt-8">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                {UPSELL_ORDER_SECTION}
              </h3>
              <div className="mt-3">
                <RetryPackPanel
                  embedded
                  offer={retryOffer}
                  scenes={allScenes}
                  publicToken={publicToken}
                  api={api}
                  onPurchased={onPurchased}
                />
              </div>
            </div>
          ) : null}

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {UPSELL_TRUST_LINE}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
