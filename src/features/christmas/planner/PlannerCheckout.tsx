import { useEffect, useMemo, useState } from "react";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { getChristmasFunnelSessionId } from "@/features/christmas/analytics";
import { trackPlannerEvent } from "./analytics";
import { startPlannerCheckout } from "./api";
import { getOrCreatePlannerGuestToken, persistPlannerOrderRecovery } from "./guest";
import { money } from "./Paywall";

export type PlannerCheckoutSelection = {
  packageKey: string;
  packageName: string;
};

/** In-app upgrade sheet — uses funnel commerce (`christmas_planner_2026`). */
export function PlannerCheckoutSheet({
  open,
  onClose,
  selected,
  addonKeys = [],
  email,
}: {
  open: boolean;
  onClose: () => void;
  selected: PlannerCheckoutSelection | null;
  addonKeys?: string[];
  email: string;
}) {
  const [session, setSession] = useState<{
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    currency: string;
    orderId: string;
    publicToken: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const due = useMemo(() => {
    if (!session) return "";
    return money(session.amountCents, session.currency);
  }, [session]);

  useEffect(() => {
    if (!open || !selected) return;
    const pack = selected;
    let cancelled = false;
    async function boot() {
      setBusy(true);
      setError(null);
      setSession(null);
      trackPlannerEvent("planner_checkout_started", {
        packageKey: pack.packageKey,
        metadata: { addons: addonKeys.join(",") },
      });
      try {
        const result = await startPlannerCheckout({
          packageKey: pack.packageKey,
          addonKeys,
          email: email.trim() || undefined,
          guestToken: getOrCreatePlannerGuestToken(),
          funnelSessionId: getChristmasFunnelSessionId(),
        });
        if (cancelled) return;
        if (result.publicToken) {
          persistPlannerOrderRecovery({
            orderId: result.orderId,
            publicToken: result.publicToken,
            packageKey: pack.packageKey,
            addonKeys,
            funnelSessionId: getChristmasFunnelSessionId(),
          });
        }
        setSession({
          clientSecret: result.clientSecret,
          publishableKey: result.publishableKey,
          amountCents: result.amountCents,
          currency: result.currency,
          orderId: result.orderId,
          publicToken: result.publicToken,
        });
      } catch (err) {
        if (cancelled) return;
        const code = (err as { code?: string }).code || "";
        const message =
          code === "planner_checkout_disabled" ||
          code === "checkout_disabled" ||
          code === "not_purchasable" ||
          /not enabled|checkout_disabled/i.test(err instanceof Error ? err.message : "")
            ? "Planner paid checkout is not live yet. You can explore the free planner now."
            : err instanceof Error
              ? err.message
              : "Checkout failed";
        setError(message);
        trackPlannerEvent("planner_purchase_failed", {
          packageKey: pack.packageKey,
          metadata: { code },
        });
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [open, selected?.packageKey, addonKeys.join(","), email]);

  if (!open) return null;

  return (
    <div className="tdg-planner-sheet" role="dialog" aria-modal="true" aria-label="Checkout">
      <button type="button" className="tdg-planner-sheet-backdrop" onClick={onClose} aria-label="Close checkout" />
      <div className="tdg-planner-sheet-card">
        <div className="tdg-planner-sheet-head">
          <p>Secure checkout</p>
          <button type="button" className="tdg-planner-btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {selected ? (
          <p className="tdg-planner-muted">
            {selected.packageName}
            {addonKeys.length ? ` + ${addonKeys.join(", ")}` : ""}
          </p>
        ) : null}
        {busy ? <p className="tdg-planner-muted">Preparing checkout…</p> : null}
        {error ? <p className="tdg-planner-muted">{error}</p> : null}
        {session?.clientSecret ? (
          <>
            <p className="tdg-planner-muted">Due today: {due}</p>
            <CustomStripeCheckout
              clientSecret={session.clientSecret}
              publishableKey={session.publishableKey}
              dueDisplay={due}
              email={email}
              appearanceTheme="night"
              walletCapabilityOnly
              payButtonLabel={() => "Pay"}
              onPaymentInteraction={() => {
                trackPlannerEvent("planner_payment_submitted", {
                  packageKey: selected?.packageKey,
                  orderId: session.orderId,
                  amountCents: session.amountCents,
                });
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
