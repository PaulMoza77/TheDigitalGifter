import { BadgeCheck } from "lucide-react";
import { PET_OFFER } from "../catalog";
import { cn } from "@/lib/utils";

export function PriceBadge({
  className,
  size = "md",
  priceDisplay = PET_OFFER.priceDisplay,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  priceDisplay?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-2 rounded-full border border-[#d4a84b]/40 bg-[#d4a84b]/10 px-3 py-1.5 text-[#f6efe4]",
        className
      )}
    >
      <span
        className={cn(
          "font-semibold tracking-tight text-[#f3d48a]",
          size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg"
        )}
      >
        {priceDisplay}
      </span>
      <span className="text-xs uppercase tracking-[0.16em] text-[#f6efe4]/70">
        one-time
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-[#1f1712] px-2 py-0.5 text-[11px] font-medium text-[#d4a84b]">
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
        {PET_OFFER.subscriptionCopy}
      </span>
    </div>
  );
}
