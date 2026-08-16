import type { ReactNode } from "react";
import { ArrowLeft, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PET_OFFER } from "../catalog";
import { PET_PRODUCT_NAME, PET_PRODUCT_PROMISE } from "../types";
import type { PetFunnelNavigation } from "../types";
import { PriceBadge } from "./PriceBadge";

export function PetShell({
  children,
  navigation,
  showBack = false,
  backLabel = "Back",
  onBack,
  footerNote,
}: {
  children: ReactNode;
  navigation?: PetFunnelNavigation;
  showBack?: boolean;
  backLabel?: string;
  onBack?: () => void;
  footerNote?: string;
}) {
  return (
    <div className="pet-funnel min-h-screen bg-[#140e0a] text-[#f6efe4]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(1000px_500px_at_15%_-10%,rgba(212,168,75,0.16),transparent_55%),radial-gradient(800px_400px_at_90%_10%,rgba(196,92,62,0.12),transparent_50%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 py-2">
          <button
            type="button"
            onClick={() => navigation?.goToLanding()}
            className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a84b]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#d4a84b] text-[#1a140e]">
              <PawPrint className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-left">
              <span className="block text-sm font-semibold tracking-tight">
                {PET_PRODUCT_NAME}
              </span>
              <span className="hidden text-[11px] text-[#f6efe4]/60 sm:block">
                {PET_PRODUCT_PROMISE}
              </span>
            </span>
          </button>
          <PriceBadge size="sm" className="hidden sm:inline-flex" />
        </header>

        {showBack ? (
          <div className="mt-2">
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-0 text-[#f6efe4]/75 hover:bg-transparent hover:text-[#f6efe4]"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {backLabel}
            </Button>
          </div>
        ) : null}

        <main className="flex-1 py-6">{children}</main>

        <footer className="mt-8 border-t border-[#f6efe4]/10 pt-6 text-sm text-[#f6efe4]/55">
          <p>
            {PET_OFFER.priceDisplay} one-time payment · {PET_OFFER.subscriptionCopy} · Human quality control
          </p>
          <p className="mt-2 max-w-3xl leading-6">
            {footerNote ??
              "Original scenes only. No existing film characters, racing teams, newspapers, or comic brands. Same pet identity in every portrait."}
          </p>
        </footer>
      </div>
    </div>
  );
}
