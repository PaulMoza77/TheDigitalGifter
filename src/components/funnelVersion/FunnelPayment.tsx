// src/components/funnelVersion/FunnelPayment.tsx
import React, { JSX, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type FunnelSession = {
  gift_type?: string;
  style_id?: string;
  script?: string;
  email?: string;
  lead_id?: string | number | null;
  funnel_slug?: string;
};

function readSession(): FunnelSession | null {
  try {
    return JSON.parse(
      localStorage.getItem("tdg_funnel_session") || "null"
    ) as FunnelSession | null;
  } catch {
    return null;
  }
}

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")} : ${String(s).padStart(2, "0")}`;
}

type PlanId = "starter" | "pro" | "elite";

const plans: Array<{
  id: PlanId;
  title: string;
  subtitle: string;
  credits: number;
  generations: number;
  price: string; // display
  // optional “was” price for UI strike-through (for style parity)
  was?: string;
  badge?: string;
  badgeTone?: "yellow" | "red";
  default?: boolean;
}> = [
  {
    id: "starter",
    title: "Starter",
    subtitle: "30 credits / month",
    credits: 30,
    generations: 6,
    price: "€1.99",
    was: "€3.98",
    badge: "Special offer • save 50%",
    badgeTone: "red",
  },
  {
    id: "pro",
    title: "Pro ⭐",
    subtitle: "100 credits / month",
    credits: 100,
    generations: 20,
    price: "€4.99",
    was: "€14.25",
    badge: "Special value • save 65%",
    badgeTone: "yellow",
    default: true,
  },
  {
    id: "elite",
    title: "Elite",
    subtitle: "300 credits / month",
    credits: 300,
    generations: 60,
    price: "€9.99",
  },
];

function getDealExpiresAtMs(): number {
  const key = "tdg_payment_deal_expires_at";
  const existing = Number(localStorage.getItem(key) || "0");
  if (existing && Number.isFinite(existing) && existing > Date.now()) return existing;

  // 30 minutes offer window (AliveMoment-style)
  const next = Date.now() + 30 * 60 * 1000;
  localStorage.setItem(key, String(next));
  return next;
}

export default function FunnelPayment(): JSX.Element {
  const navigate = useNavigate();

  const [selected, setSelected] = useState<PlanId>(() => {
    const d = plans.find((p) => p.default)?.id ?? "pro";
    return d;
  });

  const [promo, setPromo] = useState<string>(() => localStorage.getItem("tdg_promo_code") || "");
  const [promoApplied, setPromoApplied] = useState<boolean>(() => Boolean(localStorage.getItem("tdg_promo_applied")));
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const ms = getDealExpiresAtMs() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });

  const [isPaying, setIsPaying] = useState<boolean>(false);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selected) ?? plans[1],
    [selected]
  );

  // ✅ GUARD: nu intra la payment fără photo + email
  useEffect(() => {
    const photo = (localStorage.getItem("tdg_funnel_photo") || "").trim();
    if (!photo) {
      toast.error("Upload a photo first.");
      navigate("/funnel/uploadPhoto", { replace: true });
      return;
    }

    const s = readSession();
    const email = String(s?.email || "").trim();
    if (!email) {
      toast.error("Please enter your email to continue.");
      navigate("/funnel/email", { replace: true });
      return;
    }
  }, [navigate]);

  // countdown
  useEffect(() => {
    const t = window.setInterval(() => {
      const ms = getDealExpiresAtMs() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  function applyPromo(): void {
    const code = promo.trim();
    if (!code) {
      toast.error("Enter a promo code.");
      return;
    }
    // MVP: just UI state (poți lega mai târziu la Stripe promotion codes)
    localStorage.setItem("tdg_promo_code", code);
    localStorage.setItem("tdg_promo_applied", "1");
    setPromoApplied(true);
    toast.success("Promo code applied!");
  }

  async function onCheckout(): Promise<void> {
    if (isPaying) return;

    const s = readSession();
    const email = String(s?.email || "").trim();
    const photo = (localStorage.getItem("tdg_funnel_photo") || "").trim();

    if (!photo) {
      toast.error("Upload a photo first.");
      navigate("/funnel/uploadPhoto", { replace: true });
      return;
    }
    if (!email) {
      toast.error("Please enter your email to continue.");
      navigate("/funnel/email", { replace: true });
      return;
    }

    setIsPaying(true);
    try {
      // ✅ Uses Supabase Edge Function (create-checkout-session)
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { plan: selected, email },
      });

      if (error) throw error;

      const url = (data as any)?.url as string | undefined;
      if (!url) throw new Error("Missing checkout URL");

      window.location.href = url;
    } catch (e: any) {
      console.error("[FunnelPayment] checkout error:", e);
      toast.error(e?.message || "Checkout failed. Please try again.");
    } finally {
      setIsPaying(false);
    }
  }

  const expired = secondsLeft <= 0;

  return (
    <div className="min-h-screen w-full bg-[#F6F0E6] text-[#10221B]">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
        {/* Brand */}
        <div className="text-center">
          <div className="text-2xl font-semibold tracking-tight">thedigitalgifter</div>

          {/* Timer strip (AliveMoment vibe) */}
          <div className="mx-auto mt-6 flex max-w-xl items-center justify-center gap-4">
            <div className="flex items-end gap-3 rounded-2xl bg-transparent px-4 py-3">
              <div className="text-4xl font-semibold tabular-nums leading-none">
                {formatMMSS(secondsLeft).split(" : ")[0]}
              </div>
              <div className="pb-1 text-4xl font-semibold leading-none">:</div>
              <div className="text-4xl font-semibold tabular-nums leading-none">
                {formatMMSS(secondsLeft).split(" : ")[1]}
              </div>
              <div className="ml-2 pb-1 text-xs uppercase tracking-wide text-[#10221B]/55">
                minutes&nbsp;&nbsp;&nbsp;seconds
              </div>
            </div>

            <button
              type="button"
              disabled={expired}
              className={cn(
                "h-11 rounded-full px-6 text-sm font-semibold transition",
                expired
                  ? "cursor-not-allowed bg-[#1B3A30]/10 text-[#10221B]/45"
                  : "bg-[#1B3A30] text-white hover:brightness-105 active:brightness-95"
              )}
              onClick={() => {
                // Just a CTA hook; optionally scroll to plans
                const el = document.getElementById("tdg-plans");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Claim my offer
            </button>
          </div>

          <h1 className="mx-auto mt-10 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
            Bring your memories to life
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm text-[#10221B]/70 sm:text-base">
            Pick a monthly plan to unlock credits. Reset monthly • recurring • cancel anytime.
          </p>
        </div>

        {/* Promo box */}
        <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-black/10 bg-white/55 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/5">%</span>
            {promoApplied ? "Your promo code is applied!" : "Have a promo code?"}
          </div>

          <div className="mt-3 flex gap-3">
            <input
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder="Enter code"
              className="h-11 w-full rounded-xl border border-black/10 bg-white px-4 text-sm outline-none placeholder:text-black/35"
            />
            <button
              type="button"
              onClick={applyPromo}
              className={cn(
                "h-11 rounded-xl px-4 text-sm font-semibold transition",
                promoApplied ? "bg-black/5 text-black/45" : "bg-[#1B3A30] text-white hover:brightness-105"
              )}
              disabled={promoApplied}
            >
              {promoApplied ? "Applied" : "Apply"}
            </button>

            <div
              className={cn(
                "h-11 min-w-[92px] rounded-xl px-3 text-sm font-semibold flex items-center justify-center",
                expired ? "bg-black/5 text-black/45" : "bg-black/5 text-black/70"
              )}
            >
              {expired ? "Expired" : "Active"}
            </div>
          </div>
        </div>

        {/* Plans */}
        <div id="tdg-plans" className="mx-auto mt-10 max-w-xl space-y-4">
          {plans.map((p) => {
            const active = p.id === selected;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={cn(
                  "w-full rounded-2xl border bg-white/55 text-left transition",
                  active ? "border-[#D44B4B] bg-white" : "border-black/10 hover:bg-white/70"
                )}
              >
                <div className="relative p-5">
                  {/* badge */}
                  {p.badge ? (
                    <div
                      className={cn(
                        "absolute -top-3 right-5 rounded-full px-3 py-1 text-[11px] font-semibold",
                        p.badgeTone === "yellow"
                          ? "bg-[#F3D35B] text-[#10221B]"
                          : "bg-[#D44B4B] text-white"
                      )}
                    >
                      {p.badge}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {/* radio */}
                      <div
                        className={cn(
                          "mt-1 h-5 w-5 rounded-full border flex items-center justify-center",
                          active ? "border-[#D44B4B]" : "border-black/15"
                        )}
                      >
                        {active ? <div className="h-2.5 w-2.5 rounded-full bg-[#D44B4B]" /> : null}
                      </div>

                      <div>
                        <div className="text-lg font-semibold">{p.title}</div>
                        <div className="mt-0.5 text-sm text-[#10221B]/65">
                          {p.subtitle} • ({p.generations} generations)
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {p.was ? (
                        <div className="text-xs text-[#10221B]/45 line-through">{p.was}</div>
                      ) : (
                        <div className="text-xs text-transparent">.</div>
                      )}
                      <div className="text-2xl font-semibold">{p.price}</div>
                      <div className="text-xs text-[#10221B]/60">per month</div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {/* CTA */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => void onCheckout()}
              disabled={isPaying}
              className={cn(
                "w-full h-12 rounded-full text-sm font-semibold transition",
                isPaying
                  ? "bg-black/10 text-black/45 cursor-not-allowed"
                  : "bg-[#F3D35B] text-[#10221B] hover:brightness-105 active:brightness-95"
              )}
            >
              {isPaying ? "Redirecting…" : "Claim my plan"}
            </button>

            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#10221B]/65">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/10 bg-white">✓</span>
              Secure checkout • Monthly reset • Cancel anytime
            </div>

            {/* payment icons (simple placeholders; poți pune PNG-uri când vrei) */}
            <div className="mt-4 flex items-center justify-center gap-3">
              {["MC", "VISA", "Pay", "GPay"].map((x) => (
                <div
                  key={x}
                  className="h-9 min-w-[56px] rounded-xl border border-black/10 bg-white/70 px-3 flex items-center justify-center text-xs font-semibold text-[#10221B]/70"
                >
                  {x}
                </div>
              ))}
            </div>

            <div className="mt-6 text-center text-xs text-[#10221B]/55">
              ✔ Reset lunar (nu se acumulează) • ✔ Recurent automat • ✔ Anulare oricând
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}