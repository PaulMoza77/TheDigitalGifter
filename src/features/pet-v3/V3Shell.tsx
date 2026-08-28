import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isV3AnalyticsTestModeActive } from "./v3TestMode";

export function V3Shell({
  children,
  showBack,
  footer,
  padForSticky,
  onBack,
}: {
  children: ReactNode;
  showBack?: boolean;
  footer?: string;
  padForSticky?: boolean;
  onBack?: () => void;
}) {
  return (
    <div className="min-h-[100dvh] bg-[#140e0a] text-[#f6efe4]">
      {isV3AnalyticsTestModeActive() ? (
        <div className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-xs text-amber-100">
          Analytics test mode active — this session is excluded from production KPIs.
        </div>
      ) : null}
      <div className={`mx-auto w-full max-w-3xl px-4 sm:px-6 ${padForSticky ? "pb-28" : "pb-8"} pt-6`}>
        {showBack ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="-ml-2 mb-4 h-10 gap-1 px-2 text-[#f6efe4]/70 hover:bg-[#f6efe4]/5 hover:text-[#f6efe4]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        ) : null}
        {children}
        {footer ? <p className="mt-10 text-center text-xs text-[#f6efe4]/45">{footer}</p> : null}
      </div>
    </div>
  );
}
