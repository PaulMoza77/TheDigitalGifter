import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { trackChristmasEvent } from "../analytics";
import {
  SEND_A_GIFT_PRODUCT_KEY,
  SEND_A_GIFT_SERVICE_ROUTES,
} from "./packageComposition";
import {
  fetchGiftByShareId,
  markGiftOpened,
  redeemGiftEntitlement,
  type GiftPublicView,
} from "./sendAGiftApi";

type LoadState =
  | { status: "loading" }
  | { status: "empty"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; gift: GiftPublicView };

export default function GiftRedeemPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const opened = useRef(false);

  async function load() {
    if (!shareId || shareId.length < 32) {
      setState({ status: "empty", message: "This gift link is invalid." });
      return;
    }
    setState({ status: "loading" });
    try {
      const gift = await fetchGiftByShareId(shareId);
      if (!gift) {
        setState({ status: "empty", message: "This gift is unavailable or has been disabled." });
        return;
      }
      setState({ status: "ready", gift });
      if (!opened.current) {
        opened.current = true;
        void markGiftOpened(shareId);
        void trackChristmasEvent("recipient_open", {
          productKey: SEND_A_GIFT_PRODUCT_KEY,
          packageKey: gift.package_key,
          pathname: "/gift/:shareId",
          metadata: { funnel: "christmas_send_a_gift" },
        });
      }
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Could not load gift",
      });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1a3a2a_0%,_#0b1220_55%,_#070b14_100%)] text-slate-50">
      <PageHead
        title="Your Gift | The Digital Gifter"
        description="Redeem your prepaid TDG gift."
        path={`/gift/${shareId || ""}`}
      />
      <main className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
        {state.status === "loading" ? (
          <p className="text-sm text-slate-300">Opening your gift…</p>
        ) : null}
        {state.status === "empty" ? (
          <div className="space-y-3">
            <h1 className="font-serif text-3xl">Gift unavailable</h1>
            <p className="text-sm text-slate-300">{state.message}</p>
          </div>
        ) : null}
        {state.status === "error" ? (
          <div className="space-y-3">
            <h1 className="font-serif text-3xl">Something went wrong</h1>
            <p className="text-sm text-slate-300">{state.message}</p>
            <button
              type="button"
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950"
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
        ) : null}
        {state.status === "ready" ? (
          <div className="space-y-6">
            <header className="space-y-2">
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-300/80">Prepaid gift</p>
              <h1 className="font-serif text-4xl">For you</h1>
              <p className="text-sm text-slate-300">
                {state.gift.sender_label
                  ? `From ${state.gift.sender_label}`
                  : "Someone sent you TDG Christmas services."}
              </p>
            </header>
            <ul className="space-y-3">
              {state.gift.entitlements.map((e) => {
                const route = SEND_A_GIFT_SERVICE_ROUTES[e.service_key] || "/christmas";
                const remaining = e.quantity_remaining;
                return (
                  <li
                    key={e.service_key}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{e.service_key.replaceAll("_", " ")}</p>
                        <p className="text-xs text-slate-400">
                          {remaining} of {e.quantity_total} remaining
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={remaining <= 0 || busyKey === e.service_key}
                        className="rounded-xl bg-emerald-500 px-3 py-1.5 text-sm font-medium text-slate-950 disabled:opacity-40"
                        onClick={async () => {
                          if (!shareId) return;
                          setBusyKey(e.service_key);
                          try {
                            void trackChristmasEvent("redeem_started", {
                              productKey: SEND_A_GIFT_PRODUCT_KEY,
                              packageKey: state.gift.package_key,
                              metadata: {
                                funnel: "christmas_send_a_gift",
                                service_key: e.service_key,
                              },
                            });
                            const res = await redeemGiftEntitlement({
                              shareId,
                              serviceKey: e.service_key,
                              idempotencyKey: crypto.randomUUID(),
                            });
                            void trackChristmasEvent("redeem_completed", {
                              productKey: SEND_A_GIFT_PRODUCT_KEY,
                              packageKey: state.gift.package_key,
                              metadata: {
                                funnel: "christmas_send_a_gift",
                                service_key: e.service_key,
                                status: res.result?.status,
                              },
                            });
                            await load();
                            if (remaining > 0) window.location.assign(route);
                          } catch (err) {
                            void trackChristmasEvent("redeem_failed", {
                              productKey: SEND_A_GIFT_PRODUCT_KEY,
                              metadata: {
                                funnel: "christmas_send_a_gift",
                                safe_error:
                                  err instanceof Error ? err.message.slice(0, 120) : "redeem_failed",
                              },
                            });
                            setState({
                              status: "error",
                              message: err instanceof Error ? err.message : "Redeem failed",
                            });
                          } finally {
                            setBusyKey(null);
                          }
                        }}
                      >
                        {remaining <= 0 ? "Used" : "Redeem"}
                      </button>
                    </div>
                    <Link className="mt-2 inline-block text-xs text-emerald-200 underline" to={route}>
                      Open service
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </main>
    </div>
  );
}
