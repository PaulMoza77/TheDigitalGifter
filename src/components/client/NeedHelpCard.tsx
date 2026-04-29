// FILE: src/domains/account/components/NeedHelpCard.tsx

import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LifeBuoy,
  Loader2,
  Mail,
  MessageSquareText,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type CustomerSubscriptionRow = {
  subscription_status: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
};

function formatDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function isActiveSubscription(status: string | null) {
  return ["active", "trialing", "past_due"].includes(String(status ?? ""));
}

export default function NeedHelpCard() {
  const [loading, setLoading] = React.useState(true);
  const [cancelling, setCancelling] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [subscription, setSubscription] =
    React.useState<CustomerSubscriptionRow | null>(null);

  const loadSubscription = React.useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSubscription(null);
        return;
      }

      const { data, error } = await supabase
        .from("customers")
        .select(
          "subscription_status, cancel_at_period_end, current_period_end"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      setSubscription(data ?? null);
    } catch (error) {
      console.error(error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  const active = isActiveSubscription(subscription?.subscription_status ?? null);
  const alreadyCancelling = Boolean(subscription?.cancel_at_period_end);
  const endDate = formatDate(subscription?.current_period_end ?? null);

  async function handleCancelSubscription() {
    setCancelling(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "cancel-subscription",
        {
          body: {
            cancel_at_period_end: true,
          },
        }
      );

      if (error) throw error;

      if (!data?.ok) {
        throw new Error(data?.message || "Could not cancel subscription.");
      }

      toast.success("Subscription cancellation scheduled.");
      setConfirmOpen(false);

      setSubscription({
        subscription_status: data.subscription_status ?? "active",
        cancel_at_period_end: true,
        current_period_end:
          data.current_period_end ?? subscription?.current_period_end ?? null,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not cancel subscription."
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <div className="rounded-[24px] border border-white/10 bg-zinc-950/70 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur sm:rounded-[28px] sm:p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white sm:h-12 sm:w-12">
          <LifeBuoy className="h-5 w-5" />
        </div>

        <h3 className="mt-5 text-lg font-semibold text-white">Need Help?</h3>

        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Support, troubleshooting and account assistance can be connected here.
        </p>

        <div className="mt-5 space-y-3">
          <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
            <Mail className="h-4 w-4 shrink-0 text-zinc-400" />
            <span className="min-w-0 truncate">support@yourproject.com</span>
          </div>

          <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
            <MessageSquareText className="h-4 w-4 shrink-0 text-zinc-400" />
            <span className="min-w-0 truncate">Help center coming soon</span>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking subscription...
            </div>
          ) : alreadyCancelling ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Subscription cancellation scheduled</p>
                <p className="mt-1 text-xs leading-5 text-amber-100/75">
                  Your access stays active until {endDate ?? "the end of your billing period"}.
                </p>
              </div>
            </div>
          ) : active ? (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition",
                "hover:bg-red-500/15 hover:text-red-100",
                "focus:outline-none focus:ring-2 focus:ring-red-400/30"
              )}
            >
              Cancel subscription
            </button>
          ) : null}
        </div>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-200">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={cancelling}
                className="rounded-full p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h4 className="mt-5 text-lg font-semibold text-white">
              Cancel your subscription?
            </h4>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Your subscription will remain active until{" "}
              <span className="font-medium text-zinc-200">
                {endDate ?? "the end of your current billing period"}
              </span>
              . After that, monthly credits will no longer renew.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={cancelling}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-50"
              >
                Keep subscription
              </button>

              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  "Yes, cancel subscription"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}