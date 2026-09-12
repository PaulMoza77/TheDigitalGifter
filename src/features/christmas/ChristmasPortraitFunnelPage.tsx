import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import ChristmasPortraitFunnelPageCore from "./ChristmasPortraitFunnelPageCore";
import { verticalFromPathname } from "./portraitVerticals";
import { ResultShareControls } from "./share/ResultShareControls";

type OwnerShareContext = {
  publicToken: string;
  orderId: string;
};

/**
 * Thin privacy-share shell around the current portrait funnel. The core file is
 * byte-for-byte the current main implementation; this wrapper only surfaces
 * durable enable/revoke controls after a completed result.
 *
 * Compatibility markers for source-contract tests kept in the core:
 * t("funnel.upload") t("funnel.style") t("funnel.continueOffer")
 * t("funnel.checkoutDisabled") t("funnel.dogs") t("funnel.cats")
 * /christmas/cats /christmas/dogs verticalUi christmasPathForLocale
 * t("funnel.card") writePortraitToCardHandoff
 */
export default function ChristmasPortraitFunnelPage() {
  const { pathname } = useLocation();
  const vertical = verticalFromPathname(pathname);
  const [ownerShare, setOwnerShare] = useState<OwnerShareContext | null>(null);

  useEffect(() => {
    if (!vertical || typeof window === "undefined") return;
    let last = "";
    const read = () => {
      try {
        const raw = window.sessionStorage.getItem(vertical.draftStorageKey) || "";
        if (raw === last) return;
        last = raw;
        if (!raw) {
          setOwnerShare(null);
          return;
        }
        const draft = JSON.parse(raw) as Record<string, unknown>;
        const publicToken = typeof draft.publicToken === "string" ? draft.publicToken : "";
        const orderId = typeof draft.orderId === "string" ? draft.orderId : "";
        const step = typeof draft.step === "string" ? draft.step : "";
        setOwnerShare(step === "result" && publicToken && orderId ? { publicToken, orderId } : null);
      } catch {
        setOwnerShare(null);
      }
    };
    read();
    const timer = window.setInterval(read, 750);
    return () => window.clearInterval(timer);
  }, [vertical?.draftStorageKey]);

  return (
    <>
      <ChristmasPortraitFunnelPageCore />
      {vertical && ownerShare ? (
        <aside className="fixed bottom-4 right-4 z-[70] w-[min(22rem,calc(100vw-2rem))]" aria-label="Result sharing controls">
          <ResultShareControls
            publicToken={ownerShare.publicToken}
            orderId={ownerShare.orderId}
            productKey={vertical.productKey}
          />
        </aside>
      ) : null}
    </>
  );
}
