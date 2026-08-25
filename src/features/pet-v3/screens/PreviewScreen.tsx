import { Button } from "@/components/ui/button";
import { PET_V3_FUNNEL_CONFIG, v3PackOfferCopy } from "../config";
import { V3PackOffer } from "../V3PackOffer";

export function V3PreviewScreen({
  previewUrl,
  petName,
  mode,
  canRegenerate,
  onRegenerate,
  onUnlock,
}: {
  previewUrl: string;
  petName?: string;
  mode: "live" | "mock" | null;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onUnlock: () => void;
}) {
  const copy = PET_V3_FUNNEL_CONFIG.copy;
  const offer = v3PackOfferCopy();
  const headline = copy.previewHeadline(petName);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#d4a84b]">{copy.previewEyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f6efe4]">{headline}</h1>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/68">{copy.previewSubhead}</p>
      </div>
      <figure className="overflow-hidden rounded-3xl border border-[#d4a84b]/30 bg-[#1a1410]">
        <img src={previewUrl} alt={copy.previewImageAlt} className="w-full object-cover" />
      </figure>
      {mode === "mock" ? (
        <p className="rounded-2xl border border-[#d4a84b]/30 bg-[#d4a84b]/10 px-4 py-3 text-sm text-[#f3d48a]">
          {copy.mockPreviewNote}
        </p>
      ) : null}
      <V3PackOffer />
      <ul className="space-y-1.5 text-sm text-[#f6efe4]/68">
        <li>12 secret lives of the same cat</li>
        <li>2 mini cinematic clips</li>
        <li>One-time {offer.priceDisplay} · no subscription</li>
      </ul>
      <Button
        type="button"
        onClick={onUnlock}
        className="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
      >
        {copy.unlockCta(offer.priceDisplay)}
      </Button>
      {canRegenerate ? (
        <button
          type="button"
          onClick={onRegenerate}
          className="block w-full text-center text-sm text-[#f6efe4]/60 underline-offset-4 hover:underline"
        >
          Try one more preview
        </button>
      ) : null}
    </div>
  );
}
