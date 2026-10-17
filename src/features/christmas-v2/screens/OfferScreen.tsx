import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CHRISTMAS_PACKS,
  CHRISTMAS_STARTER_SCENES,
  type ChristmasPackKey,
} from "../config";

const PACK_ORDER: ChristmasPackKey[] = ["starter", "magic", "ultimate"];

function entitlementLine(packKey: ChristmasPackKey): string {
  const pack = CHRISTMAS_PACKS[packKey];
  if (pack.videoCount <= 0) return `${pack.imageCount} Christmas photos · no videos`;
  if (pack.videoCount === 1) {
    return `${pack.imageCount} Christmas photos · 1 short video`;
  }
  return `${pack.imageCount} Christmas photos · ${pack.videoCount} short videos`;
}

export function ChristmasOfferScreen({
  previewUrl,
  selectedPackKey,
  onSelectPack,
  onContinue,
  onChangePhoto,
}: {
  previewUrl?: string | null;
  selectedPackKey: ChristmasPackKey;
  onSelectPack: (packKey: ChristmasPackKey) => void;
  onContinue: () => void;
  onChangePhoto: () => void;
}) {
  const selected = CHRISTMAS_PACKS[selectedPackKey];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C9A227]">
          Choose your pack
        </p>
        <h1 className="cv2-display mt-1 text-3xl font-semibold tracking-tight text-[#F7F0E4] sm:text-4xl">
          Christmas photo packs
        </h1>
        <p className="mt-2 text-sm text-[#F7F0E4]/70">
          One-time purchase · no subscription · portraits styled from your photo.
        </p>
      </div>

      {previewUrl ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[#F7F0E4]/12 bg-[#F7F0E4]/06 p-3">
          <img
            src={previewUrl}
            alt="Your uploaded photo preview"
            className="h-16 w-16 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#F7F0E4]">Your photo ready</p>
            <p className="text-xs text-[#F7F0E4]/55">Local preview only · not AI-generated yet</p>
            <button
              type="button"
              className="mt-1 min-h-11 text-xs text-[#C9A227] underline-offset-2 hover:underline"
              onClick={onChangePhoto}
            >
              Change photo
            </button>
          </div>
        </div>
      ) : null}

      <div
        className="grid gap-3"
        role="radiogroup"
        aria-label="Christmas package selection"
        data-testid="cv2-offer-packs"
      >
        {PACK_ORDER.map((key) => {
          const pack = CHRISTMAS_PACKS[key];
          const active = selectedPackKey === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={`cv2-pack-${key}`}
              onClick={() => onSelectPack(key)}
              className={cn(
                "relative min-h-[5.5rem] rounded-[1.35rem] border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:ring-offset-2 focus-visible:ring-offset-[#3b0610]",
                active
                  ? "border-[#C9A227] bg-[#F7F0E4] text-[#3b0610] shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
                  : "border-[#F7F0E4]/15 bg-[#F7F0E4]/06 text-[#F7F0E4]",
              )}
            >
              {pack.badge ? (
                <span
                  className={cn(
                    "absolute -top-2 right-4 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
                    active ? "bg-[#1B4332] text-[#F7F0E4]" : "bg-[#C9A227] text-[#3b0610]",
                  )}
                >
                  {pack.badge}
                </span>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      active ? "text-[#5c0a14]/70" : "text-[#F7F0E4]/70",
                    )}
                  >
                    {pack.name}
                  </p>
                  <p className="cv2-display mt-0.5 text-3xl font-semibold tracking-tight">
                    {pack.priceDisplay}
                  </p>
                  <p className={cn("mt-1 text-sm", active ? "text-[#5c0a14]/70" : "text-[#F7F0E4]/65")}>
                    {entitlementLine(key)}
                  </p>
                </div>
                <span
                  className={cn(
                    "mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border",
                    active
                      ? "border-[#1B4332] bg-[#1B4332] text-[#F7F0E4]"
                      : "border-[#F7F0E4]/35 text-transparent",
                  )}
                  aria-hidden="true"
                >
                  <Check className="h-4 w-4" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <section className="space-y-3" aria-labelledby="cv2-starter-scenes-heading">
        <h2 id="cv2-starter-scenes-heading" className="cv2-display text-xl font-semibold text-[#F7F0E4]">
          Included Christmas looks
        </h2>
        <p className="text-sm text-[#F7F0E4]/60">
          Starter includes these three classic looks. Magic and Ultimate add more scenes and short
          clips from your portraits.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {CHRISTMAS_STARTER_SCENES.map((scene) => (
            <article
              key={scene.key}
              className="overflow-hidden rounded-2xl border border-[#F7F0E4]/12 bg-[#F7F0E4]/08"
            >
              <div className="aspect-[3/4] bg-[#2a0810]">
                {scene.exampleImage ? (
                  <img
                    src={scene.exampleImage}
                    alt={`Example look: ${scene.label}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="px-3 py-3">
                <p className="text-sm font-semibold text-[#F7F0E4]">{scene.label}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="rounded-[1.5rem] border border-[#C9A227]/35 bg-[#F7F0E4] p-5 text-[#3b0610] shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#5c0a14]/70">{selected.name}</p>
            <p className="cv2-display text-4xl font-semibold tracking-tight">{selected.priceDisplay}</p>
          </div>
          <p className="max-w-[10rem] text-right text-xs text-[#5c0a14]/60">
            {entitlementLine(selectedPackKey)}
            <br />
            one-time
          </p>
        </div>
        <Button
          type="button"
          data-testid="cv2-offer-continue"
          onClick={onContinue}
          className="mt-4 h-12 w-full rounded-full bg-[#1B4332] text-base font-semibold text-[#F7F0E4] hover:bg-[#245C41]"
        >
          {selected.cta}
        </Button>
        <p className="mt-3 text-center text-xs text-[#5c0a14]/55">
          Secure checkout · No subscription · Exact amount shown before payment
        </p>
      </div>
    </div>
  );
}
