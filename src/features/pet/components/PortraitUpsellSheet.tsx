import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Gift,
  ImageIcon,
  Loader2,
  Printer,
  Sparkles,
  TreePine,
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
import type { PetSceneResult, PetSceneUpsellView, PetUpsellKey, PetUpsellOfferView } from "../types";
import { downloadUpsellExport } from "../upsellExports";

const OFFER_ICONS: Record<PetUpsellKey, typeof Gift> = {
  gift_pack: Gift,
  holiday_card: TreePine,
  print_pack: Printer,
  retry_3_scenes: Sparkles,
};

export function PortraitUpsellSheet({
  open,
  onOpenChange,
  scene,
  sceneUpsell,
  petName,
  publicToken,
  api,
  onPurchased,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scene: PetSceneResult | null;
  sceneUpsell: PetSceneUpsellView | null;
  petName: string;
  publicToken: string;
  api: PetFunnelApi;
  onPurchased?: () => void;
}) {
  const [loadingKey, setLoadingKey] = useState<PetUpsellKey | null>(null);
  const [exportingKey, setExportingKey] = useState<PetUpsellKey | null>(null);

  const offers = useMemo(() => sceneUpsell?.offers ?? [], [sceneUpsell?.offers]);
  const livePreview =
    scene?.previewUrl && !scene.previewUrl.startsWith("preview://") ? scene.previewUrl : null;

  async function startCheckout(offer: PetUpsellOfferView) {
    if (!scene || offer.purchased || !offer.available) return;
    setLoadingKey(offer.key);
    try {
      const checkout = await api.createUpsellCheckout({
        publicToken,
        upsellKey: offer.key,
        sceneKey: scene.sceneId,
        successUrl: `${window.location.origin}/pet/order?token=${encodeURIComponent(publicToken)}&upsell=success`,
        cancelUrl: `${window.location.origin}/pet/order?token=${encodeURIComponent(publicToken)}`,
      });
      if (checkout.checkoutUrl.startsWith("preview://")) {
        toast.success("Preview checkout complete");
        onPurchased?.();
        onOpenChange(false);
        return;
      }
      window.location.assign(checkout.checkoutUrl);
    } catch (caught) {
      const message =
        caught instanceof PetApiError
          ? caught.message
          : "Could not start checkout. No payment was taken.";
      toast.error(message);
    } finally {
      setLoadingKey(null);
    }
  }

  async function downloadPack(offer: PetUpsellOfferView) {
    if (!scene || !livePreview || !offer.purchased) return;
    if (offer.key === "retry_3_scenes") return;
    setExportingKey(offer.key);
    try {
      await downloadUpsellExport({
        upsellKey: offer.key,
        imageUrl: livePreview,
        petName,
        sceneTitle: scene.title,
        width: sceneUpsell?.width,
        height: sceneUpsell?.height,
      });
      toast.success(`${offer.name} downloaded`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Download failed");
    } finally {
      setExportingKey(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-3xl border-[#f6efe4]/10 bg-[#120f0c] text-[#f6efe4]">
        <SheetHeader className="text-left">
          <SheetTitle className="text-2xl font-semibold text-[#f6efe4]">
            {scene?.title ?? "Portrait extras"}
          </SheetTitle>
          <SheetDescription className="text-[#f6efe4]/65">
            Instant downloads after payment. No subscription.
          </SheetDescription>
        </SheetHeader>

        {livePreview ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#f6efe4]/10">
            <img src={livePreview} alt="" className="aspect-[3/4] w-full object-cover" />
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {offers.map((offer) => {
            const Icon = OFFER_ICONS[offer.key] ?? ImageIcon;
            const busy = loadingKey === offer.key || exportingKey === offer.key;
            return (
              <article
                key={offer.key}
                className="rounded-2xl border border-[#f6efe4]/10 bg-[#1a1410] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f6efe4]/8 text-[#d4af37]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-[#f6efe4]">{offer.name}</h3>
                      <span className="text-sm font-semibold text-[#d4af37]">{offer.priceDisplay}</span>
                    </div>
                    <p className="mt-1 text-sm text-[#f6efe4]/65">{offer.description}</p>
                    {offer.key === "print_pack" && offer.printMaxSizeLabel ? (
                      <p className="mt-2 text-xs text-emerald-300/90">
                        Verified for up to {offer.printMaxSizeLabel} at 150 DPI
                        {sceneUpsell?.width && sceneUpsell?.height
                          ? ` (${sceneUpsell.width}×${sceneUpsell.height}px source)`
                          : ""}
                      </p>
                    ) : null}
                    {!offer.available && offer.unavailableReason ? (
                      <p className="mt-2 text-xs text-amber-300/90">{offer.unavailableReason}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4">
                  {offer.purchased ? (
                    <Button
                      type="button"
                      className="h-11 w-full rounded-xl bg-[#d4af37] text-[#120f0c] hover:bg-[#e0bc4a]"
                      disabled={busy || offer.key === "retry_3_scenes" || !livePreview}
                      onClick={() => void downloadPack(offer)}
                    >
                      {busy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      {offer.purchasedCta}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="h-11 w-full rounded-xl bg-[#f6efe4] text-[#120f0c] hover:bg-white"
                      disabled={busy || !offer.available}
                      onClick={() => void startCheckout(offer)}
                    >
                      {busy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : null}
                      {offer.cta}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
