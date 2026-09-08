import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { christmasFunnelApi } from "../api";
import { trackChristmasV2Event } from "../analytics";
import { CHRISTMAS_PACKS, CHRISTMAS_V2_ORDER_ROUTE } from "../config";
import type { ExpressWalletAvailability } from "@/features/pet/expressCheckoutOptions";

function trackV2WalletAvailability(info: ExpressWalletAvailability) {
  trackChristmasV2Event({
    eventName: info.applePay
      ? "christmas_v2_apple_pay_available"
      : "christmas_v2_apple_pay_unavailable",
  });
  if (info.any) {
    trackChristmasV2Event({ eventName: "christmas_v2_express_checkout_available" });
  }
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
  const finalizeAndNavigate = useCallback(
    async (confirmedSessionId?: string | null) => {
      const resolvedSessionId = confirmedSessionId || sessionId;
      // Best-effort fulfillment nudge — verifies payment with Stripe and runs the same
      // RPC the webhook uses, so results unlock immediately even if stripe-webhook (Edge)
      // hasn't been redeployed yet. Never block navigation on this call.
      if (publicToken && resolvedSessionId) {
        try {
          await christmasFunnelApi.confirmStripePayment({
            publicToken,
            sessionId: resolvedSessionId,
          });
        } catch (err) {
          console.error("confirmStripePayment failed", err);
        }
      }
      const params = new URLSearchParams();
      if (publicToken) params.set("token", publicToken);
      if (resolvedSessionId) params.set("session_id", resolvedSessionId);
      window.location.assign(`${CHRISTMAS_V2_ORDER_ROUTE}?${params.toString()}`);
    },
    [publicToken, sessionId],
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

        {clientSecret && publishableKey ? (
          <CustomStripeCheckout
            clientSecret={clientSecret}
            publishableKey={publishableKey}
            email={email}
            dueDisplay={CHRISTMAS_PACKS.starter.priceDisplay}
            loadingLabel="Loading secure payment…"
            payButtonLabel={() => `Pay ${CHRISTMAS_PACKS.starter.priceDisplay} securely`}
            payButtonClassName="h-12 w-full rounded-full bg-[#1B4332] text-base font-semibold text-[#F7F0E4] hover:bg-[#245C41]"
            appearanceVariables={{
              colorPrimary: "#1B4332",
              colorBackground: "#F7F0E4",
              colorText: "#3b0610",
              colorDanger: "#9a3412",
              borderRadius: "14px",
              fontFamily: "Source Sans 3, Segoe UI, sans-serif",
            }}
            redirectIfRequired
            onReady={onReady}
            onPaymentInteraction={onPaymentInteraction}
            onConfirmStart={onSubmit}
            onExpressCancel={onExpressCancel}
            onConfirmSuccess={(detail) => void finalizeAndNavigate(detail.sessionId)}
            onWalletAvailability={trackV2WalletAvailability}
          />
        ) : null}
      </div>
    </div>
  );
}
