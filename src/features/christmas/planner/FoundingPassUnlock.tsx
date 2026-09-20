import { useEffect, useState } from "react";
import { trackPlannerEvent } from "./analytics";
import { fetchPlannerCatalog, startPlannerCheckout, type PlannerCatalog } from "./api";
import { getChristmasFunnelSessionId } from "@/features/christmas/analytics";
import { getOrCreatePlannerGuestToken, persistPlannerOrderRecovery } from "./guest";
import { money } from "./Paywall";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { supabase } from "@/lib/supabase";
import {
  FOUNDING_PASS_PACKAGE_KEY,
  FOUNDING_PASS_PRICE_LABEL,
  type PlannerFeatureKey,
} from "./types";
import { upgradePackageForFeature } from "./entitlements";

const OFFER_TITLE = "Christmas 2026 Founding Pass";
const OFFER_CTA = `Unlock your complete Christmas plan — ${FOUNDING_PASS_PRICE_LABEL} one-time`;
const CHECKOUT_SOON = "Christmas Planner launch access is opening soon.";

export function FoundingPassUnlockButton({
  feature,
  label = OFFER_CTA,
}: {
  feature: PlannerFeatureKey;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const pack = upgradePackageForFeature(feature);
  return (
    <>
      <button
        type="button"
        className="tdg-planner-btn primary"
        data-testid="founding-pass-unlock"
        data-upgrade-feature={feature}
        data-upgrade-package={pack.packageKey}
        onClick={() => {
          trackPlannerEvent("planner_upgrade_clicked", { feature, packageKey: FOUNDING_PASS_PACKAGE_KEY });
          setOpen(true);
        }}
      >
        {label}
      </button>
      <FoundingPassOfferSheet open={open} onClose={() => setOpen(false)} feature={feature} />
    </>
  );
}

export function FoundingPassOfferSheet({
  open,
  onClose,
  feature,
}: {
  open: boolean;
  onClose: () => void;
  feature: PlannerFeatureKey;
}) {
  const [catalog, setCatalog] = useState<PlannerCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<{
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    currency: string;
    orderId: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setSession(null);
    void fetchPlannerCatalog()
      .then((row) => {
        if (!cancelled) setCatalog(row);
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog(null);
          setError(CHECKOUT_SOON);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selected =
    catalog?.packages.find((pkg) => pkg.packageKey === FOUNDING_PASS_PACKAGE_KEY) || catalog?.packages[0] || null;
  const checkoutLive = Boolean(catalog?.checkoutLive);
  const priceLabel = selected ? money(selected.priceCents, selected.currency) : FOUNDING_PASS_PRICE_LABEL;

  async function startPay() {
    if (!checkoutLive || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email || undefined;
      const result = await startPlannerCheckout({
        packageKey: FOUNDING_PASS_PACKAGE_KEY,
        addonKeys: [],
        email,
        guestToken: getOrCreatePlannerGuestToken(),
        funnelSessionId: getChristmasFunnelSessionId(),
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
      const code = (err as { code?: string }).code || "";
      const msg = err instanceof Error ? err.message : "";
      setError(
        code === "checkout_disabled" ||
          code === "planner_checkout_disabled" ||
          code === "not_purchasable" ||
          /not enabled|checkout_disabled/i.test(msg)
          ? CHECKOUT_SOON
          : msg || CHECKOUT_SOON,
      );
      trackPlannerEvent("planner_purchase_failed", {
        feature,
        packageKey: FOUNDING_PASS_PACKAGE_KEY,
        metadata: { code: code || "error" },
      });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="tdg-planner-sheet" role="dialog" aria-modal="true" aria-labelledby="founding-pass-offer-title">
      <button type="button" className="tdg-planner-sheet-backdrop" onClick={onClose} aria-label="Close Founding Pass offer" />
      <div className="tdg-planner-sheet-card tdg-founding-offer" data-testid="founding-pass-offer">
        <div className="tdg-planner-sheet-head">
          <p className="tdg-planner-kicker">Founding Pass</p>
          <button type="button" className="tdg-planner-btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <h2 id="founding-pass-offer-title">{OFFER_TITLE}</h2>
        <p className="tdg-planner-lede">{priceLabel} one-time. Plan gifts, meals, budget and the rest of Christmas in one place.</p>
        {!checkoutLive || error ? (
          <div className="tdg-planner-launch" data-testid="planner-checkout-disabled">
            <strong>{error || CHECKOUT_SOON}</strong>
            <p>Apple Pay, Google Pay and card will appear here when checkout opens — checkout stays off until launch QA.</p>
          </div>
        ) : session?.clientSecret ? (
          <>
            <p className="tdg-planner-muted">Due today: {money(session.amountCents, session.currency)}</p>
            <CustomStripeCheckout
              clientSecret={session.clientSecret}
              publishableKey={session.publishableKey}
              dueDisplay={money(session.amountCents, session.currency)}
              appearanceTheme="night"
              walletCapabilityOnly
              payButtonLabel={(due) => `Pay ${due}`}
              onPaymentInteraction={() => {
                trackPlannerEvent("planner_payment_submitted", {
                  packageKey: FOUNDING_PASS_PACKAGE_KEY,
                  orderId: session.orderId,
                  amountCents: session.amountCents,
                });
              }}
            />
          </>
        ) : (
          <button type="button" className="tdg-planner-btn primary" disabled={busy} onClick={() => void startPay()}>
            {busy ? "Starting checkout…" : `Continue · ${priceLabel}`}
          </button>
        )}
      </div>
    </div>
  );
}
