import { Button } from "@/components/ui/button";
import { PET_OFFER } from "../catalog";

export function StickyCta({
  onClick,
  label = `Create their secret lives — ${PET_OFFER.priceDisplay}`,
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-[#f6efe4]/10 bg-[#140e0a]/95 px-4 py-3 backdrop-blur md:hidden">
      <Button
        type="button"
        onClick={onClick}
        className="h-12 w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
      >
        {label}
      </Button>
      <p className="mt-2 text-center text-xs text-[#f6efe4]/60">
        {PET_OFFER.priceDisplay} one-time · {PET_OFFER.subscriptionCopy}
      </p>
    </div>
  );
}
