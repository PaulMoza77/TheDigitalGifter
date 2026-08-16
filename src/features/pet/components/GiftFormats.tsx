import { Download, Printer, Share2, Smartphone } from "lucide-react";
import { PET_RESULT_FORMATS } from "../catalog";

const ICONS = {
  high_res: Download,
  wallpaper: Smartphone,
  social: Share2,
  poster: Printer,
} as const;

export function GiftFormats() {
  return (
    <section aria-labelledby="pet-formats-heading" className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.22em] text-[#d4a84b]">What you keep</p>
        <h2 id="pet-formats-heading" className="mt-2 text-3xl font-semibold tracking-tight text-[#f6efe4]">
          12 QC-approved portraits
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#f6efe4]/70">
          This purchase is the portrait gallery. Extra crops stay listed only as Coming later and are
          not part of what you pay for today.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PET_RESULT_FORMATS.map((format) => {
          const Icon = ICONS[format.kind];
          return (
            <article
              key={format.kind}
              className="rounded-3xl border border-[#f6efe4]/10 bg-[#1f1712]/80 p-5"
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#d4a84b]/15 text-[#d4a84b]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[#f6efe4]">
                {format.label}
                {format.comingLater ? (
                  <span className="ml-2 align-middle text-xs font-medium uppercase tracking-[0.14em] text-[#d4a84b]">
                    Coming later
                  </span>
                ) : null}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#f6efe4]/70">
                {format.comingLater
                  ? `${format.description} Not included in this purchase.`
                  : format.description}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
