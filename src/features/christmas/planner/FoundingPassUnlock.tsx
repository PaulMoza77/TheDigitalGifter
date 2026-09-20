import { useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { trackPlannerEvent } from "./analytics";
import { startPlannerCheckout } from "./api";
import { getChristmasFunnelSessionId } from "@/features/christmas/analytics";
import { getOrCreatePlannerGuestToken, persistPlannerOrderRecovery } from "./guest";
import { money } from "./Paywall";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { supabase } from "@/lib/supabase";
import {
  FOUNDING_PASS_PACKAGE_KEY,
  FOUNDING_PASS_PRICE_CENTS,
  FOUNDING_PASS_PRICE_LABEL,
  type PlannerFeatureKey,
} from "./types";
import { upgradePackageForFeature } from "./entitlements";

const OFFER_CTA = `Unlock your complete Christmas plan — ${FOUNDING_PASS_PRICE_LABEL} one-time`;

export function FoundingPassUnlockButton({
  feature,
  label = OFFER_CTA,
}: {
  feature: PlannerFeatureKey;
  label?: string;
}) {
  const location = useLocation();
  const pack = upgradePackageForFeature(feature);
  const inflight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<{
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    currency: string;
    orderId: string;
  } | null>(null);

  function close() {
    if (inflight.current) return;
    setOpen(false);
    setError(null);
    setSession(null);
  }

  async function startPay() {
    if (inflight.current || busy) return;
    inflight.current = true;
    setBusy(true);
    setError(null);
    setSession(null);
    setOpen(true);
    trackPlannerEvent("planner_upgrade_clicked", { feature, packageKey: FOUNDING_PASS_PACKAGE_KEY });
    trackPlannerEvent("planner_checkout_started", { feature, packageKey: FOUNDING_PASS_PACKAGE_KEY });
    try {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email || undefined;
      const result = await startPlannerCheckout({
        packageKey: FOUNDING_PASS_PACKAGE_KEY,
        addonKeys: [],
        email,
        guestToken: getOrCreatePlannerGuestToken(),
        funnelSessionId: getChristmasFunnelSessionId(),
        returnPath: `${location.pathname}${location.search}`,
      });
      setSession({
        clientSecret: result.clientSecret,
        publishableKey: result.publishableKey,
        amountCents: result.amountCents,
        currency: result.currency,
        orderId: result.orderId,
      });
      if (result.publicToken) {
        persistPlannerOrderRecovery({
          orderId: result.orderId,
          publicToken: result.publicToken,
          packageKey: FOUNDING_PASS_PACKAGE_KEY,
          addonKeys: [],
          funnelSessionId: getChristmasFunnelSessionId(),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start checkout.";
      setError(msg || "Could not start checkout.");
      trackPlannerEvent("planner_purchase_failed", {
        feature,
        packageKey: FOUNDING_PASS_PACKAGE_KEY,
        metadata: { code: (err as { code?: string }).code || "error" },
      });
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  const due =
    session != null
      ? money(session.amountCents, session.currency)
      : money(FOUNDING_PASS_PRICE_CENTS, "usd");

  return (
    <>
      <button
        type="button"
        className="tdg-planner-btn primary"
        data-testid="founding-pass-unlock"
        data-upgrade-feature={feature}
        data-upgrade-package={pack.packageKey}
        disabled={busy}
        onClick={() => void startPay()}
      >
        {busy && !session ? "Starting checkout…" : label}
      </button>
      {open ? (
        <div className="tdg-planner-sheet" role="dialog" aria-modal="true" aria-labelledby="founding-pass-checkout-title">
          <button type="button" className="tdg-planner-sheet-backdrop" onClick={close} aria-label="Close checkout" />
          <div className="tdg-planner-sheet-card tdg-founding-checkout" data-testid="founding-pass-checkout">
            <div className="tdg-planner-sheet-head">
              <p className="tdg-planner-kicker">Secure checkout</p>
              <button type="button" className="tdg-planner-btn ghost" onClick={close}>
                Close
              </button>
            </div>
            <h2 id="founding-pass-checkout-title">Christmas 2026 Founding Pass</h2>
            <p className="tdg-planner-muted">Due today: {due}</p>
            {error ? (
              <p className="tdg-planner-launch" role="alert" data-testid="planner-checkout-error">
                {error}
              </p>
            ) : null}
            {busy && !session && !error ? (
              <p className="tdg-planner-muted" data-testid="planner-checkout-loading">
                Starting checkout…
              </p>
            ) : null}
            {session?.clientSecret ? (
              <CustomStripeCheckout
                clientSecret={session.clientSecret}
                publishableKey={session.publishableKey}
                dueDisplay={money(session.amountCents, session.currency)}
                appearanceTheme="night"
                walletCapabilityOnly
                payButtonLabel={(value) => `Pay ${value}`}
                onPaymentInteraction={() => {
                  trackPlannerEvent("planner_payment_submitted", {
                    packageKey: FOUNDING_PASS_PACKAGE_KEY,
                    orderId: session.orderId,
                    amountCents: session.amountCents,
                  });
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
