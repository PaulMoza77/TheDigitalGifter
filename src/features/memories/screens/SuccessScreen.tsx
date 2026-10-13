import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { MEMORIES_PLANS, MEMORIES_ROUTE, type MemoriesPlanKey } from "../config";

export function MemoriesSuccessScreen({
  loading,
  paymentVerified,
  waitlisted,
  planKey,
  status,
  commercialMode,
  onPortal,
  onCancel,
  busyAction,
}: {
  loading: boolean;
  paymentVerified: boolean;
  waitlisted: boolean;
  planKey?: MemoriesPlanKey | null;
  status?: string | null;
  commercialMode?: string | null;
  onPortal?: () => void;
  onCancel?: () => void;
  busyAction?: boolean;
}) {
  const plan = planKey ? MEMORIES_PLANS[planKey] : null;

  return (
    <div className="mx-auto max-w-xl space-y-6 px-5 py-16 sm:px-8">
      <Link to={MEMORIES_ROUTE} className="text-sm text-[#D4AF7A] hover:underline">
        ← Memories home
      </Link>
      {loading ? (
        <div className="flex items-center gap-2 text-[#F4EDE3]/75">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your status…
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF7A]">
            Early Access — Product in Development
          </p>
          <h1 className="memories-display text-3xl font-semibold text-[#F7F0E4]">
            {paymentVerified
              ? "Subscription confirmed"
              : waitlisted
                ? "You're on the list"
                : "Thanks for joining Memories"}
          </h1>
          <p className="text-sm leading-6 text-[#F4EDE3]/75">
            {paymentVerified
              ? "Stripe verified your payment. Memories AI generation is not available yet — you are subscribed to early access and will be notified when the product is ready."
              : waitlisted
                ? "No payment was collected. We recorded your interest and will email you when Memories is available. This page alone never marks a sale as paid."
                : "We're confirming your order status from Stripe. If you just completed checkout, verification can take a moment."}
          </p>
          {plan ? (
            <p className="text-sm text-[#D4AF7A]">
              {plan.displayName} · {plan.priceDisplay}
            </p>
          ) : null}
          {status ? (
            <p className="text-xs text-[#F4EDE3]/5">
              Status: {status}
              {commercialMode ? ` · mode ${commercialMode}` : ""}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            {paymentVerified && onPortal ? (
              <button
                type="button"
                disabled={busyAction}
                onClick={onPortal}
                className="rounded-full bg-[#D4AF7A] px-5 py-3 text-sm font-semibold text-[#1a1510] disabled:opacity-40"
              >
                Manage billing
              </button>
            ) : null}
            {paymentVerified && onCancel ? (
              <button
                type="button"
                disabled={busyAction}
                onClick={onCancel}
                className="rounded-full border border-[#F4EDE3]/25 px-5 py-3 text-sm font-semibold text-[#F4EDE3] disabled:opacity-40"
              >
                Cancel at period end
              </button>
            ) : null}
          </div>
          <p className="text-xs text-[#F4EDE3]/45">
            Support: support@thedigitalgifter.com
          </p>
        </>
      )}
    </div>
  );
}
