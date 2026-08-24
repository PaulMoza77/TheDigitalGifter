import { Button } from "@/components/ui/button";
import { V2PackOffer, v2PackOfferCopy } from "../V2PackOffer";

export function V2PreviewScreen({
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
  const offer = v2PackOfferCopy();
  const headline = petName?.trim()
    ? `Love it? Unlock ${petName.trim()}’s 12 secret lives.`
    : "Love it? Unlock all 12 secret lives.";

  return (
    <div className="space-y-6 pb-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#d4a84b]">Your pet, transformed</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f6efe4]">{headline}</h1>
      </div>
      <figure className="overflow-hidden rounded-3xl border border-[#d4a84b]/30 bg-[#1a1410]">
        <img src={previewUrl} alt="Personalized preview of your pet" className="w-full object-cover" />
      </figure>
      {mode === "mock" ? (
        <p className="rounded-2xl border border-[#d4a84b]/30 bg-[#d4a84b]/10 px-4 py-3 text-sm text-[#f3d48a]">
          Prototype preview: live AI generation is off in this environment, so this is your photo in a royal frame.
        </p>
      ) : null}
      <V2PackOffer />
      <ul className="space-y-1.5 text-sm text-[#f6efe4]/68">
        <li>12 secret lives of the same pet</li>
        <li>2 mini cinematic clips</li>
        <li>One-time {offer.priceDisplay} · no subscription</li>
      </ul>
      <Button
        type="button"
        onClick={onUnlock}
        className="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
      >
        Get 12 lives + 2 clips for {offer.priceDisplay}
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
