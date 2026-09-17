import { useEffect, useMemo, useState } from "react";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { startChristmasCheckout } from "@/features/christmas/photoApi";
import { attributionParamsForInternal, captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { getChristmasFunnelSessionId } from "@/features/christmas/analytics";
import { trackPlannerEvent } from "./analytics";
import { persistPlannerOrder, type PlannerCatalogRow } from "./api";
import { money } from "./Paywall";
import { PLANNER_WELCOME_ROUTE } from "./types";

function guestToken(): string {
  const key = "tdg.christmas.planner.guest";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem(key, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

export function PlannerCheckoutSheet({
  open,
  onClose,
  selected,
  addons,
  email,
}: {
  open: boolean;
  onClose: () => void;
  selected: PlannerCatalogRow | null;
  addons: PlannerCatalogRow[];
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
      captureFunnelAttribution(window.location.search);
      const attr = attributionParamsForInternal();
      const origin = window.location.origin;
      trackPlannerEvent("planner_checkout_started", {
        packageKey: pack.packageKey,
        metadata: { addons: addons.map((a) => a.packageKey).join(",") },
      });
      try {
        const result = await startChristmasCheckout({
          product_key: pack.productKey,
          package_key: pack.packageKey,
          addon_keys: addons.map((a) => a.packageKey),
          email: email.trim() || undefined,
          amount_cents: 1,
          currency: "usd",
          landing_path: "/christmas/planner",
          source_route: "/christmas/planner",
          guest_token: guestToken(),
          funnel_session_id: getChristmasFunnelSessionId(),
          utm_source: attr.utm_source,
          utm_medium: attr.utm_medium,
          utm_campaign: attr.utm_campaign,
          utm_content: attr.utm_content,
          utm_term: attr.utm_term,
          campaign_id: attr.campaign_id,
          adset_id: attr.adset_id,
          ad_id: attr.ad_id,
          success_url: `${origin}${PLANNER_WELCOME_ROUTE}?checkout=success`,
          cancel_url: `${origin}/christmas/planner?checkout=canceled`,
        });
        if (cancelled) return;
        persistPlannerOrder({
          orderId: result.orderId,
          publicToken: result.publicToken,
          sessionId: result.sessionId,
          packageKey: pack.packageKey,
          addons: addons.map((a) => a.packageKey),
          amountCents: result.amountCents,
          currency: result.currency,
        });
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
          code === "planner_checkout_disabled" || code === "not_purchasable"
            ? "Planner paid checkout is not live yet. You can start the free planner now."
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
  }, [open, selected?.productKey, selected?.packageKey, addons.map((a) => a.packageKey).join(","), email]);

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
            {addons.length ? ` + ${addons.map((a) => a.packageName).join(", ")}` : ""}
          </p>
        ) : null}
        {busy ? <p className="tdg-planner-muted">Preparing Apple Pay, Google Pay, and card…</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {session ? (
          <CustomStripeCheckout
            clientSecret={session.clientSecret}
            publishableKey={session.publishableKey}
            email={email}
            dueDisplay={due}
            appearanceTheme="night"
            payButtonLabel={(pay) => `Pay ${pay} — unlock this season`}
            loadingLabel="Checking wallet availability…"
            onPaymentInteraction={() =>
              trackPlannerEvent("planner_payment_submitted", {
                packageKey: selected?.packageKey,
                orderId: session.orderId,
                amountCents: session.amountCents,
              })
            }
            onWalletAvailability={(info) => {
              trackPlannerEvent("planner_wallet_presented", {
                packageKey: selected?.packageKey,
                metadata: {
                  applePay: info.applePay,
                  googlePay: info.googlePay,
                  any: info.any,
                },
              });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
