import { BadgeCheck } from "lucide-react";
import { PET_OFFER } from "../catalog";

export function OfferStack() {
  return (
    <ul className="space-y-2">
      {PET_OFFER.includes.map((item) => (
        <li key={item} className="flex items-center gap-2 text-sm text-[#f6efe4]/80">
          <BadgeCheck className="h-4 w-4 shrink-0 text-[#d4a84b]" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}
