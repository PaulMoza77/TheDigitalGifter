import { useEffect, useMemo, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { christmasFunnelApi } from "../api";
import { CHRISTMAS_PACKS, CHRISTMAS_V2_ORDER_ROUTE } from "../config";

const EXPRESS_OPTIONS = {
  buttonHeight: 52,
  buttonTheme: { applePay: "black" as const, googlePay: "black" as const },
  buttonType: { applePay: "buy" as const, googlePay: "buy" as const },
  layout: { maxColumns: 1, maxRows: 4 },
  paymentMethodOrder: ["applePay", "googlePay"],
  paymentMethods: {
    applePay: "always" as const,
    googlePay: "always" as const,
    link: "auto" as const,
    paypal: "never" as const,
    amazonPay: "never" as const,
    klarna: "never" as const,
  },
};

function CheckoutBody({
  email,
  publicToken,
  sessionId,
  onReady,
  onPaymentInteraction,
  onSubmit,
  onExpressCancel,
}: {
  email?: string;
  publicToken: string | null;
  sessionId: string | null;
  onReady?: () => void;
  onPaymentInteraction?: () => void;
  onSubmit?: () => void;
  onExpressCancel?: () => void;
}) {
  const checkoutState = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readyFired = useRef(false);

  useEffect(() => {
    if (checkoutState.type === "success" && !readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
  }, [checkoutState.type, onReady]);

  async function finalizeAndNavigate(confirmedSessionId?: string | null) {
    const resolvedSessionId = confirmedSessionId || sessionId;
    // Best-effort fulfillment nudge — verifies payment with Stripe and runs the same
    // RPC the webhook uses, so results unlock immediately even if stripe-webhook (Edge)
    // hasn't been redeployed yet. Never block navigation on this call.
    if (publicToken && resolvedSessionId) {
      try {
        await christmasFunnelApi.confirmStripePayment({ publicToken, sessionId: resolvedSessionId });
      } catch (err) {
        console.error("confirmStripePayment failed", err);
      }
    }
    const params = new URLSearchParams();
    if (publicToken) params.set("token", publicToken);
    if (resolvedSessionId) params.set("session_id", resolvedSessionId);
    window.location.assign(`${CHRISTMAS_V2_ORDER_ROUTE}?${params.toString()}`);
  }

  async function confirm() {
    if (checkoutState.type !== "success") return;
    setBusy(true);
    setError(null);
    onSubmit?.();
    try {
      const result = await checkoutState.checkout.confirm({ email: email || undefined, redirect: "if_required" });
      if (result.type === "error") {
        setError(result.error.message || "Payment failed. Please try again.");
        return;
      }
      await finalizeAndNavigate(result.type === "success" ? result.session?.id : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (checkoutState.type === "loading") {
    return <p className="text-sm text-[#5c0a14]/65">Loading secure payment…</p>;
  }
  if (checkoutState.type === "error") {
    return <p className="text-sm text-[#9a3412]">{checkoutState.error.message}</p>;
  }

  return (
    <div className="space-y-4">
      <ExpressCheckoutElement
        options={EXPRESS_OPTIONS}
        onConfirm={async (event: StripeExpressCheckoutElementConfirmEvent) => {
          onPaymentInteraction?.();
          onSubmit?.();
          setBusy(true);
          try {
            const result = await checkoutState.checkout.confirm({
              expressCheckoutConfirmEvent: event,
              redirect: "if_required",
            });
            if (result.type === "error") {
              setError(result.error.message || "Payment failed.");
              return;
            }
            await finalizeAndNavigate(result.type === "success" ? result.session?.id : undefined);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Payment failed.");
          } finally {
            setBusy(false);
          }
        }}
        onCancel={() => onExpressCancel?.()}
      />
      <div className="relative py-1 text-center text-xs uppercase tracking-wide text-[#5c0a14]/45">
        <span className="bg-[#F7F0E4] px-2">or pay with card</span>
      </div>
      <PaymentElement options={{ layout: "tabs" }} onChange={() => onPaymentInteraction?.()} />
      {error ? <p className="text-sm text-[#9a3412]">{error}</p> : null}
      <Button
        type="button"
        disabled={busy}
        onClick={() => void confirm()}
        className="h-12 w-full rounded-full bg-[#1B4332] text-base font-semibold text-[#F7F0E4] hover:bg-[#245C41]"
      >
        {busy ? "Processing…" : `Pay ${CHRISTMAS_PACKS.starter.priceDisplay} securely`}
      </Button>
    </div>
  );
}

export function ChristmasCheckoutScreen({
  clientSecret,
  publishableKey,
  publicToken,
  sessionId,
  email,
  onEmail,
  customerName,
  onCustomerName,
  loading,
  initError,
  onRetry,
  onReady,
  onPaymentInteraction,
  onSubmit,
  onExpressCancel,
  hostedFallbackUrl,
}: {
  clientSecret: string | null;
  publishableKey: string | null;
  publicToken?: string | null;
  sessionId?: string | null;
  email: string;
  onEmail: (value: string) => void;
  customerName: string;
  onCustomerName: (value: string) => void;
  loading: boolean;
  initError: string | null;
  onRetry: () => void;
  onReady?: () => void;
  onPaymentInteraction?: () => void;
  onSubmit?: () => void;
  onExpressCancel?: () => void;
  hostedFallbackUrl?: string | null;
}) {
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C9A227]">Secure checkout</p>
        <h1 className="cv2-display mt-1 text-3xl font-semibold text-[#F7F0E4]">Create My 3 Christmas Photos</h1>
        <p className="mt-2 text-sm text-[#F7F0E4]/70">
          {CHRISTMAS_PACKS.starter.priceDisplay} · No subscription · Delivered to your email
        </p>
      </div>

      <div className="space-y-3 rounded-[1.4rem] border border-[#F7F0E4]/12 bg-[#F7F0E4] p-4 text-[#3b0610]">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cv2-name">Name (optional)</Label>
            <Input
              id="cv2-name"
              value={customerName}
              onChange={(e) => onCustomerName(e.target.value)}
              className="mt-1 border-[#3b0610]/15 bg-white"
              placeholder="Your name"
            />
          </div>
          <div>
            <Label htmlFor="cv2-email">Email for delivery</Label>
            <Input
              id="cv2-email"
              type="email"
              value={email}
              onChange={(e) => onEmail(e.target.value)}
              className="mt-1 border-[#3b0610]/15 bg-white"
              placeholder="you@email.com"
              required
            />
          </div>
        </div>

        {loading ? <p className="text-sm text-[#5c0a14]/65">Starting secure checkout…</p> : null}
        {initError ? (
          <div className="space-y-2">
            <p className="text-sm text-[#9a3412]">{initError}</p>
            <Button type="button" variant="outline" onClick={onRetry}>
              Try again
            </Button>
            {hostedFallbackUrl ? (
              <a className="block text-sm text-[#1B4332] underline" href={hostedFallbackUrl}>
                Continue on Stripe hosted checkout
              </a>
            ) : null}
          </div>
        ) : null}

        {clientSecret && stripePromise ? (
          <CheckoutElementsProvider
            stripe={stripePromise}
            options={{
              clientSecret,
              elementsOptions: {
                appearance: {
                  theme: "stripe",
                  variables: {
                    colorPrimary: "#1B4332",
                    colorBackground: "#F7F0E4",
                    colorText: "#3b0610",
                    colorDanger: "#9a3412",
                    borderRadius: "14px",
                    fontFamily: "Source Sans 3, Segoe UI, sans-serif",
                  },
                },
              },
            }}
          >
            <CheckoutBody
              email={email}
              publicToken={publicToken ?? null}
              sessionId={sessionId ?? null}
              onReady={onReady}
              onPaymentInteraction={onPaymentInteraction}
              onSubmit={onSubmit}
              onExpressCancel={onExpressCancel}
            />
          </CheckoutElementsProvider>
        ) : null}
      </div>
    </div>
  );
}
