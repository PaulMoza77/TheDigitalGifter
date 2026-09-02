import { CHRISTMAS_PACKS, CHRISTMAS_STARTER_SCENES } from "../config";
import { Button } from "@/components/ui/button";

export function ChristmasOfferScreen({
  previewUrl,
  onContinue,
  onChangePhoto,
}: {
  previewUrl?: string | null;
  onContinue: () => void;
  onChangePhoto: () => void;
}) {
  const pack = CHRISTMAS_PACKS.starter;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C9A227]">Starter offer</p>
        <h1 className="cv2-display mt-1 text-3xl font-semibold tracking-tight text-[#F7F0E4] sm:text-4xl">
          Your 3 AI Christmas Portraits
        </h1>
        <p className="mt-2 text-sm text-[#F7F0E4]/70">
          From your photo — identity preserved, premium Christmas styling.
        </p>
      </div>

      {previewUrl ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[#F7F0E4]/12 bg-[#F7F0E4]/06 p-3">
          <img src={previewUrl} alt="Uploaded portrait" className="h-16 w-16 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#F7F0E4]">Photo ready</p>
            <button
              type="button"
              className="text-xs text-[#C9A227] underline-offset-2 hover:underline"
              onClick={onChangePhoto}
            >
              Change photo
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {CHRISTMAS_STARTER_SCENES.map((scene) => (
          <article
            key={scene.key}
            className="overflow-hidden rounded-2xl border border-[#F7F0E4]/12 bg-[#F7F0E4]/08"
          >
            <div className="aspect-[3/4] bg-[#2a0810]">
              {scene.exampleImage ? (
                <img src={scene.exampleImage} alt={scene.label} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="px-3 py-3">
              <p className="text-sm font-semibold text-[#F7F0E4]">{scene.label}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-[1.5rem] border border-[#C9A227]/35 bg-[#F7F0E4] p-5 text-[#3b0610] shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#5c0a14]/70">{pack.name}</p>
            <p className="cv2-display text-4xl font-semibold tracking-tight">{pack.priceDisplay}</p>
          </div>
          <p className="text-right text-xs text-[#5c0a14]/60">
            3 portraits
            <br />
            one-time
          </p>
        </div>
        <Button
          type="button"
          onClick={onContinue}
          className="mt-4 h-12 w-full rounded-full bg-[#1B4332] text-base font-semibold text-[#F7F0E4] hover:bg-[#245C41]"
        >
          {pack.cta}
        </Button>
        <p className="mt-3 text-center text-xs text-[#5c0a14]/55">
          Secure checkout • No subscription • Perfect for gifts & social posts
        </p>
      </div>
    </div>
  );
}
