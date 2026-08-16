import {
  BadgeCheck,
  Download,
  Printer,
  Share2,
  Smartphone,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { PET_OFFER } from "../catalog";

const ICONS = [Sparkles, Download, Smartphone, Share2, Printer, UserRoundCheck];

export function OfferStack() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {PET_OFFER.includes.map((item, index) => {
        const Icon = ICONS[index] ?? BadgeCheck;
        return (
          <li
            key={item}
            className="flex items-start gap-3 rounded-2xl border border-[#f6efe4]/10 bg-[#1f1712]/80 px-4 py-3"
          >
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#d4a84b]/15 text-[#d4a84b]">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm leading-6 text-[#f6efe4]/88">{item}</span>
          </li>
        );
      })}
    </ul>
  );
}
