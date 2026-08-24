import { Button } from "@/components/ui/button";
import { PET_V2_TEST_PRICE_DISPLAY } from "../types";

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
  const headline = petName?.trim()
    ? `Love it? Unlock ${petName.trim()}’s full Secret Lives collection.`
    : "Love it? Unlock the full collection.";

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
          Prototype preview: live AI generation is off, so this is your photo in a royal frame — not the paid Kontext Pro model.
        </p>
      ) : null}
      <div className="rounded-2xl border border-[#f6efe4]/12 px-4 py-4">
        <p className="text-sm text-[#f6efe4]/70">
          Prototype offer copy: <span className="font-semibold text-[#f6efe4]">{PET_V2_TEST_PRICE_DISPLAY}</span> one-time.
          Production Secret Lives is still $27 and is not changed by this test.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-[#f6efe4]/68">
          <li>6 HD personalized portraits (positioning for this test)</li>
          <li>Paid product behind this prototype is still 12 portraits + 2 clips</li>
          <li>One-time purchase · no subscription</li>
        </ul>
      </div>
      <Button
        type="button"
        onClick={onUnlock}
        className="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
      >
        Unlock the full collection
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
