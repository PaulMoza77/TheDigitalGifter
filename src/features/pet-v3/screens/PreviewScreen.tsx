import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  canUnlockWithIdentityConfirm,
  identityConfirmLabel,
} from "../../pet-funnel-shared/identityConfirm";
import { PET_V3_FUNNEL_CONFIG, v3PackOfferCopy } from "../config";
import { V3PackOffer } from "../V3PackOffer";

export function V3PreviewScreen({
  previewUrl,
  sourceUrl,
  petName,
  mode,
  canRegenerate,
  onRegenerate,
  onUnlock,
}: {
  previewUrl: string;
  sourceUrl?: string | null;
  petName?: string;
  mode: "live" | "mock" | null;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onUnlock: () => void;
}) {
  const copy = PET_V3_FUNNEL_CONFIG.copy;
  const [offer, setOffer] = useState(() => v3PackOfferCopy());
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [identityError, setIdentityError] = useState<string | undefined>();
  const headline = copy.previewHeadline(petName);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#d4a84b]">{copy.previewEyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f6efe4]">{headline}</h1>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/68">{copy.previewSubhead}</p>
      </div>
      {sourceUrl ? (
        <div className="grid grid-cols-2 gap-3">
          <figure className="overflow-hidden rounded-2xl border border-[#d4a84b]/20 bg-[#1a1410]">
            <img src={sourceUrl} alt="Your uploaded cat" className="aspect-square w-full object-cover" />
            <figcaption className="px-3 py-2 text-center text-xs text-[#f6efe4]/55">Your photo</figcaption>
          </figure>
          <figure className="overflow-hidden rounded-2xl border border-[#d4a84b]/30 bg-[#1a1410]">
            <img src={previewUrl} alt={copy.previewImageAlt} className="aspect-square w-full object-cover" />
            <figcaption className="px-3 py-2 text-center text-xs text-[#f6efe4]/55">Royal preview</figcaption>
          </figure>
        </div>
      ) : (
        <figure className="overflow-hidden rounded-3xl border border-[#d4a84b]/30 bg-[#1a1410]">
          <img src={previewUrl} alt={copy.previewImageAlt} className="w-full object-cover" />
        </figure>
      )}
      {mode === "mock" ? (
        <p className="rounded-2xl border border-[#d4a84b]/30 bg-[#d4a84b]/10 px-4 py-3 text-sm text-[#f3d48a]">
          {copy.mockPreviewNote}
        </p>
      ) : null}
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#d4a84b]/25 bg-[#1a1410]/80 px-4 py-3 text-sm leading-5 text-[#f6efe4]/85">
        <input
          type="checkbox"
          checked={identityConfirmed}
          onChange={(e) => {
            setIdentityConfirmed(e.target.checked);
            setIdentityError(undefined);
          }}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#d4a84b]"
        />
        <span>{identityConfirmLabel("cat")}</span>
      </label>
      {identityError ? <p className="text-sm text-[#f3a6a6]">{identityError}</p> : null}
      <V3PackOffer onExpire={() => setOffer(v3PackOfferCopy())} />
      <ul className="space-y-1.5 text-sm text-[#f6efe4]/68">
        <li>12 secret lives of the same cat</li>
        <li>2 mini cinematic clips</li>
        <li>
          One-time <s className="text-[#f6efe4]/45">{offer.compareAtDisplay}</s> {offer.priceDisplay}
        </li>
      </ul>
      <Button
        type="button"
        onClick={() => {
          const gate = canUnlockWithIdentityConfirm({ confirmed: identityConfirmed, kind: "cat" });
          if (!gate.ok) {
            setIdentityError(gate.message);
            return;
          }
          onUnlock();
        }}
        className="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
      >
        {copy.unlockCta(offer.priceDisplay)}
      </Button>
      {canRegenerate ? (
        <button
          type="button"
          onClick={() => {
            setIdentityConfirmed(false);
            setIdentityError(undefined);
            onRegenerate();
          }}
          className="block w-full text-center text-sm text-[#f6efe4]/60 underline-offset-4 hover:underline"
        >
          Try one more preview
        </button>
      ) : null}
    </div>
  );
}
