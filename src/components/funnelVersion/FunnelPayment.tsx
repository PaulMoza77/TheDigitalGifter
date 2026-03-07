import React, { JSX, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

type FunnelSession = {
  gift_type?: string;
  style_id?: string;
  script?: string;
  email?: string;
  lead_id?: string | number | null;
  funnel_slug?: string;
  generation_id?: string | null;
  template_id?: string | null;
};

type PlanId = "starter" | "pro" | "elite";

type Plan = {
  id: PlanId;
  title: string;
  subtitle: string;
  credits: number;
  generations: number;
  price: string;
  was?: string;
  badge?: string;
  badgeTone?: "yellow" | "red";
  default?: boolean;
};

type CheckoutResponse = {
  url?: string;
  id?: string;
  error?: string;
  message?: string;
};

function readSession(): FunnelSession | null {
  try {
    return JSON.parse(localStorage.getItem("tdg_funnel_session") || "null") as FunnelSession | null;
  } catch {
    return null;
  }
}

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const plans: Plan[] = [
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

  const next = Date.now() + 30 * 60 * 1000;
  localStorage.setItem(key, String(next));
  return next;
}

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")} : ${String(s).padStart(2, "0")}`;
}

function getPublicSupabaseConfig(): { url: string; anon: string } {
  const env = import.meta.env as {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
  };

  const url = (env.VITE_SUPABASE_URL || "").trim();
  const anon = (env.VITE_SUPABASE_ANON_KEY || "").trim();

  if (!url || !anon) {
    throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  }

  return { url, anon };
}

async function safeReadJson(res: Response): Promise<CheckoutResponse> {
  try {
    return (await res.json()) as CheckoutResponse;
  } catch {
    return {};
  }
}

function parseEuro(eur: string): number {
  const n = Number(String(eur).replace("€", "").trim());
  return Number.isFinite(n) ? n : 0;
}

function formatEuro(n: number): string {
  const v = Math.round(n * 100) / 100;
  return `€${v.toFixed(2)}`;
}

type PromoEffect =
  | { kind: "none" }
  | { kind: "percent_first_month"; percent: number };

function getPromoEffect(codeRaw: string): PromoEffect {
  const code = codeRaw.trim().toUpperCase();
  if (!code) return { kind: "none" };
  if (code === "START70") {
    return { kind: "percent_first_month", percent: 70 };
  }
  return { kind: "none" };
}

function calcUiPriceForPlan(plan: Plan, promoApplied: boolean, promoCode: string) {
  const standard = parseEuro(plan.price);

  if (!promoApplied) {
    return {
      displayMain: plan.price,
      displaySub: "per month",
      showThen: false,
      thenText: "",
      showWasOverride: false,
      wasOverride: "",
    };
  }

  const effect = getPromoEffect(promoCode);
  if (effect.kind === "none") {
    return {
      displayMain: plan.price,
      displaySub: "per month",
      showThen: false,
      thenText: "",
      showWasOverride: false,
      wasOverride: "",
    };
  }

  const first = standard * (1 - effect.percent / 100);

  return {
    displayMain: formatEuro(first),
    displaySub: `first month (-${effect.percent}%)`,
    showThen: true,
    thenText: `then ${formatEuro(standard)}/month`,
    showWasOverride: true,
    wasOverride: plan.price,
  };
}

export default function FunnelPayment(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

  const [selected, setSelected] = useState<PlanId>(() => plans.find((p) => p.default)?.id ?? "pro");
  const [promo, setPromo] = useState<string>(() => localStorage.getItem("tdg_promo_code") || "");
  const [promoApplied, setPromoApplied] = useState<boolean>(() => localStorage.getItem("tdg_promo_applied") === "1");
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const ms = getDealExpiresAtMs() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });
  const [isPaying, setIsPaying] = useState<boolean>(false);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const generationIdFromUrl = (params.get("generation_id") || "").trim();
  const canceled = (params.get("canceled") || "").trim() === "1";

  const selectedPlan = useMemo<Plan>(() => plans.find((p) => p.id === selected) ?? plans[1], [selected]);
  const expired = secondsLeft <= 0;

  const sessionData = useMemo(() => readSession(), []);
  const email = String(sessionData?.email || "").trim();
  const templateId = String(sessionData?.template_id || "").trim();

  const generationId =
    generationIdFromUrl ||
    String(sessionData?.generation_id || "").trim() ||
    (localStorage.getItem("tdg_generation_id") || "").trim();

  useEffect(() => {
    if (canceled) {
      toast.error("Checkout canceled.");
    }
  }, [canceled]);

  useEffect(() => {
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
  }, [navigate, email]);

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

    if (code.toUpperCase() !== "START70") {
      toast.error("Invalid promo code.");
      return;
    }

    localStorage.setItem("tdg_promo_code", code);
    localStorage.setItem("tdg_promo_applied", "1");
    setPromoApplied(true);
    toast.success("Promo applied!");
  }

  function removePromo(): void {
    localStorage.removeItem("tdg_promo_code");
    localStorage.removeItem("tdg_promo_applied");
    setPromo("");
    setPromoApplied(false);
    toast.message("Promo removed.");
  }

  async function onCheckout(): Promise<void> {
    if (isPaying) return;

    if (!email) {
      toast.error("Missing email. Please re-enter your email.");
      navigate("/funnel/email", { replace: true });
      return;
    }

    if (!generationId) {
      toast.error("Generation is not ready yet. Please complete the previous funnel step first.");
      return;
    }

    setIsPaying(true);

    try {
      const { url: SUPABASE_URL, anon: ANON_KEY } = getPublicSupabaseConfig();

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          plan: selected,
          email,
          generation_id: generationId,
          template_id: templateId || null,
          promo_code: promoApplied ? promo.trim() : "",
        }),
      });

      const data = await safeReadJson(res);

      if (!res.ok) {
        const msg = (data.error || data.message || `Checkout error (${res.status})`).toString();
        throw new Error(msg);
      }

      if (data?.id && generationId) {
        localStorage.setItem(`tdg_session_generation:${data.id}`, generationId);
        localStorage.setItem("tdg_last_generation_id", generationId);
      }

      const checkoutUrl = (data.url || "").toString();
      if (!checkoutUrl) throw new Error("Missing checkout URL");

      window.location.href = checkoutUrl;
    } catch (err: unknown) {
      console.error("[FunnelPayment] checkout error:", err);
      const msg = err instanceof Error ? err.message : "Checkout failed. Please try again.";
      toast.error(msg);
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#F6F0E6] text-[#10221B]">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
        <div className="text-center">
          <div className="text-2xl font-semibold tracking-tight">thedigitalgifter</div>

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

        <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-black/10 bg-white/55 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/5">%</span>
              {promoApplied ? "Promo applied (START70)" : "Have a promo code?"}
            </div>

            {promoApplied ? (
              <button
                type="button"
                onClick={removePromo}
                className="text-xs font-semibold text-[#10221B]/70 underline decoration-black/20 underline-offset-4 hover:text-[#10221B]"
              >
                Remove
              </button>
            ) : null}
          </div>

          <div className="mt-3 flex gap-3">
            <input
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder="Enter code"
              className="h-11 w-full rounded-xl border border-black/10 bg-white px-4 text-sm outline-none placeholder:text-black/35"
              disabled={promoApplied}
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
                "flex h-11 min-w-[92px] items-center justify-center rounded-xl px-3 text-sm font-semibold",
                expired ? "bg-black/5 text-black/45" : "bg-black/5 text-black/70"
              )}
            >
              {expired ? "Expired" : "Active"}
            </div>
          </div>

          {promoApplied ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              ✅ START70 applied — <b>70% off your first month</b>. Regular monthly price starts next month.
            </div>
          ) : null}
        </div>

        <div id="tdg-plans" className="mx-auto mt-10 max-w-xl space-y-4">
          {plans.map((p) => {
            const active = p.id === selected;
            const uiPrice = calcUiPriceForPlan(p, promoApplied, promo);

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
                  {p.badge ? (
                    <div
                      className={cn(
                        "absolute -top-3 right-5 rounded-full px-3 py-1 text-[11px] font-semibold",
                        p.badgeTone === "yellow" ? "bg-[#F3D35B] text-[#10221B]" : "bg-[#D44B4B] text-white"
                      )}
                    >
                      {p.badge}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-1 flex h-5 w-5 items-center justify-center rounded-full border",
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

                        {promoApplied && uiPrice.showThen ? (
                          <div className="mt-2 text-xs text-[#10221B]/60">{uiPrice.thenText}</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-right">
                      {uiPrice.showWasOverride ? (
                        <div className="text-xs text-[#10221B]/45 line-through">{uiPrice.wasOverride}</div>
                      ) : p.was ? (
                        <div className="text-xs text-[#10221B]/45 line-through">{p.was}</div>
                      ) : (
                        <div className="text-xs text-transparent">.</div>
                      )}

                      <div className="text-2xl font-semibold">{uiPrice.displayMain}</div>
                      <div className="text-xs text-[#10221B]/60">{uiPrice.displaySub}</div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          <div className="pt-2">
            <button
              type="button"
              onClick={() => void onCheckout()}
              disabled={isPaying || expired}
              className={cn(
                "h-12 w-full rounded-full text-sm font-semibold transition",
                isPaying || expired
                  ? "cursor-not-allowed bg-black/10 text-black/45"
                  : "bg-[#F3D35B] text-[#10221B] hover:brightness-105 active:brightness-95"
              )}
            >
              {isPaying
                ? "Redirecting…"
                : expired
                  ? "Offer expired"
                  : promoApplied
                    ? "Continue to checkout (70% off first month)"
                    : "Claim my plan"}
            </button>

            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#10221B]/65">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/10 bg-white">
                ✓
              </span>
              Secure checkout • Monthly reset • Cancel anytime
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              {["MC", "VISA", "Pay", "GPay"].map((x) => (
                <div
                  key={x}
                  className="flex h-9 min-w-[56px] items-center justify-center rounded-xl border border-black/10 bg-white/70 px-3 text-xs font-semibold text-[#10221B]/70"
                >
                  {x}
                </div>
              ))}
            </div>

            <div className="mt-6 text-center text-xs text-[#10221B]/55">
              ✔ Reset lunar (nu se acumulează) • ✔ Recurent automat • ✔ Anulare oricând
            </div>
          </div>

          <div className="pt-6 text-center text-[11px] text-[#10221B]/35">
            Selected: {selectedPlan.id} • Credits: {selectedPlan.credits} • Promo:{" "}
            {promoApplied ? promo.toUpperCase() : "none"} • Generation: {generationId || "missing"}
          </div>
        </div>
      </div>
    </div>
  );
}