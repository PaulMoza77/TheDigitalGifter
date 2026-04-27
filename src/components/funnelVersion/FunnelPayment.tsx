import React, { JSX, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type FunnelSession = {
  gift_type?: string;
  style_id?: string;
  script?: string;
  email?: string;
  lead_id?: string | number | null;
  funnel_slug?: string;
  generation_id?: string | null;
  template_id?: string | null;
  occasion?: string | null;
  photo_bucket?: string | null;
  photo_path?: string | null;
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
  generation_id?: string;
  user_id?: string | null;
};

type AffiliateCodeRow = {
  id: string;
  user_id: string;
  code: string;
  discount_percent: number | null;
  commission_percent: number | null;
  max_uses: number | null;
  times_used: number | null;
  active: boolean | null;
};

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function readSession(): FunnelSession | null {
  try {
    return JSON.parse(localStorage.getItem("tdg_funnel_session") || "null") as FunnelSession | null;
  } catch {
    return null;
  }
}

function writeSession(next: FunnelSession): void {
  try {
    localStorage.setItem("tdg_funnel_session", JSON.stringify(next));
  } catch {
    // no-op
  }
}

function mergeSession(partial: Partial<FunnelSession>): FunnelSession {
  const current = readSession() || {};
  const next: FunnelSession = { ...current, ...partial };
  writeSession(next);
  return next;
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

  if (existing && Number.isFinite(existing) && existing > Date.now()) {
    return existing;
  }

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

function clampPercent(value: unknown, fallback = 70): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.trunc(n)));
}

function calcUiPriceForPlan(plan: Plan, promoApplied: boolean, discountPercent: number) {
  const standard = parseEuro(plan.price);

  if (!promoApplied || discountPercent <= 0) {
    return {
      displayMain: plan.price,
      displaySub: "per month",
      showThen: false,
      thenText: "",
      showWasOverride: false,
      wasOverride: "",
    };
  }

  const first = standard * (1 - discountPercent / 100);

  return {
    displayMain: formatEuro(first),
    displaySub: `first month (-${discountPercent}%)`,
    showThen: true,
    thenText: `then ${formatEuro(standard)}/month`,
    showWasOverride: true,
    wasOverride: plan.price,
  };
}

function resolveFunnelContext(search: string) {
  const params = new URLSearchParams(search);
  const session = readSession() || {};

  const templateIdFromUrl = (params.get("template_id") || "").trim();
  const emailFromUrl = (params.get("email") || "").trim();

  const email =
    emailFromUrl ||
    String(session.email || "").trim() ||
    (localStorage.getItem("tdg_email") || "").trim();

  const templateId =
    templateIdFromUrl ||
    String(session.template_id || "").trim() ||
    (localStorage.getItem("tdg_template_id") || "").trim();

  const photo =
    String(session.photo_path || "").trim() ||
    (localStorage.getItem("tdg_funnel_photo") || "").trim() ||
    (localStorage.getItem("tdg_funnel_photo_path") || "").trim() ||
    (localStorage.getItem("tdg_uploaded_photo_path") || "").trim() ||
    (localStorage.getItem("tdg_uploaded_photo_url") || "").trim();

  const styleId =
    String(session.style_id || "").trim() ||
    (localStorage.getItem("tdg_funnel_style") || "").trim();

  const funnelSlug =
    String(session.funnel_slug || "").trim() ||
    (localStorage.getItem("tdg_funnel_slug") || "").trim();

  const occasion =
    String(session.occasion || "").trim() ||
    String(session.gift_type || "").trim() ||
    (localStorage.getItem("tdg_funnel_occasion") || "").trim();

  if (email || templateId || photo || styleId || funnelSlug || occasion) {
    mergeSession({
      ...session,
      email: email || session.email || "",
      template_id: templateId || session.template_id || null,
      photo_path: photo || session.photo_path || null,
      style_id: styleId || session.style_id || undefined,
      funnel_slug: funnelSlug || session.funnel_slug || undefined,
      occasion: occasion || session.occasion || null,
      gift_type: occasion || session.gift_type || undefined,
    });
  }

  if (email) localStorage.setItem("tdg_email", email);
  if (templateId) localStorage.setItem("tdg_template_id", templateId);

  return {
    canceled: (params.get("canceled") || "").trim() === "1",
    email,
    templateId,
    photo,
    styleId,
    funnelSlug,
    occasion,
  };
}

async function getEdgeFunctionHeaders(anonKey: string): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token?.trim();

  return {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${accessToken || anonKey}`,
  };
}

async function validatePromoCode(codeRaw: string): Promise<{ code: string; discountPercent: number }> {
  const code = codeRaw.trim().toUpperCase();

  if (!code) {
    throw new Error("Enter a promo code.");
  }

  if (code === "START70") {
    return { code, discountPercent: 70 };
  }

  const { data, error } = await supabase
    .from("affiliate_codes")
    .select("id,user_id,code,discount_percent,commission_percent,max_uses,times_used,active")
    .ilike("code", code)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("[FunnelPayment] affiliate code validation error:", error);
    throw new Error("Could not validate promo code. Please try again.");
  }

  if (!data) {
    throw new Error("Invalid promo code.");
  }

  const affiliate = data as AffiliateCodeRow;
  const maxUses = affiliate.max_uses;
  const timesUsed = affiliate.times_used ?? 0;

  if (typeof maxUses === "number" && maxUses > 0 && timesUsed >= maxUses) {
    throw new Error("This promo code has expired.");
  }

  return {
    code: affiliate.code.toUpperCase(),
    discountPercent: clampPercent(affiliate.discount_percent, 70),
  };
}

export default function FunnelPayment(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

  const [selected, setSelected] = useState<PlanId>(() => plans.find((p) => p.default)?.id ?? "pro");
  const [promo, setPromo] = useState<string>(() => localStorage.getItem("tdg_promo_code") || "");
  const [promoApplied, setPromoApplied] = useState<boolean>(() => localStorage.getItem("tdg_promo_applied") === "1");
  const [promoDiscountPercent, setPromoDiscountPercent] = useState<number>(() =>
    clampPercent(localStorage.getItem("tdg_promo_discount_percent") || 0, 0)
  );
  const [applyingPromo, setApplyingPromo] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const ms = getDealExpiresAtMs() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });
  const [isPaying, setIsPaying] = useState<boolean>(false);

  const funnel = useMemo(() => resolveFunnelContext(location.search), [location.search]);

  const selectedPlan = useMemo<Plan>(() => plans.find((p) => p.id === selected) ?? plans[1], [selected]);
  const expired = secondsLeft <= 0;

  useEffect(() => {
    if (funnel.canceled) {
      toast.error("Checkout canceled.");
    }
  }, [funnel.canceled]);

  useEffect(() => {
    if (!funnel.photo) {
      toast.error("Upload a photo first.");
      navigate("/funnel/uploadPhoto", { replace: true });
      return;
    }

    if (!funnel.styleId) {
      toast.error("Choose a style first.");
      navigate("/funnel/styleSelect", { replace: true });
      return;
    }

    if (!funnel.email) {
      toast.error("Please enter your email to continue.");
      navigate("/funnel/email", { replace: true });
    }
  }, [navigate, funnel.photo, funnel.styleId, funnel.email]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const ms = getDealExpiresAtMs() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    }, 1000);

    return () => window.clearInterval(t);
  }, []);

  async function applyPromo(): Promise<void> {
    if (applyingPromo || promoApplied) return;

    try {
      setApplyingPromo(true);

      const result = await validatePromoCode(promo);

      localStorage.setItem("tdg_promo_code", result.code);
      localStorage.setItem("tdg_promo_applied", "1");
      localStorage.setItem("tdg_promo_discount_percent", String(result.discountPercent));

      setPromo(result.code);
      setPromoDiscountPercent(result.discountPercent);
      setPromoApplied(true);

      toast.success(`${result.code} applied — ${result.discountPercent}% off first month.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Invalid promo code.";
      toast.error(msg);
    } finally {
      setApplyingPromo(false);
    }
  }

  function removePromo(): void {
    localStorage.removeItem("tdg_promo_code");
    localStorage.removeItem("tdg_promo_applied");
    localStorage.removeItem("tdg_promo_discount_percent");
    setPromo("");
    setPromoApplied(false);
    setPromoDiscountPercent(0);
    toast.message("Promo removed.");
  }

  async function onCheckout(): Promise<void> {
    if (isPaying) return;

    if (!funnel.photo) {
      toast.error("Upload a photo first.");
      navigate("/funnel/uploadPhoto", { replace: true });
      return;
    }

    if (!funnel.styleId) {
      toast.error("Choose a style first.");
      navigate("/funnel/styleSelect", { replace: true });
      return;
    }

    if (!funnel.email) {
      toast.error("Missing email. Please re-enter your email.");
      navigate("/funnel/email", { replace: true });
      return;
    }

    setIsPaying(true);

    try {
      const { url: SUPABASE_URL, anon: ANON_KEY } = getPublicSupabaseConfig();
      const headers = await getEdgeFunctionHeaders(ANON_KEY);

      const payload = {
        plan: selected,
        email: funnel.email,
        template_id: funnel.templateId || null,
        promo_code: promoApplied ? promo.trim().toUpperCase() : "",
        style_id: funnel.styleId || null,
        funnel_slug: funnel.funnelSlug || null,
        occasion: funnel.occasion || null,
        photo_path: funnel.photo || null,
      };

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await safeReadJson(res);

      if (!res.ok) {
        const msg = (data.error || data.message || `Checkout error (${res.status})`).toString();
        throw new Error(msg);
      }

      if (data?.id) {
        localStorage.setItem("tdg_last_checkout_session_id", data.id);
      }

      if (data?.generation_id) {
        mergeSession({
          generation_id: data.generation_id,
        });
      }

      const checkoutUrl = (data.url || "").toString();
      if (!checkoutUrl) {
        throw new Error("Missing checkout URL");
      }

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
              {promoApplied ? `Promo applied (${promo.toUpperCase()})` : "Have a promo code?"}
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
              disabled={promoApplied || applyingPromo}
            />

            <button
              type="button"
              onClick={() => void applyPromo()}
              className={cn(
                "h-11 rounded-xl px-4 text-sm font-semibold transition",
                promoApplied || applyingPromo
                  ? "bg-black/5 text-black/45"
                  : "bg-[#1B3A30] text-white hover:brightness-105"
              )}
              disabled={promoApplied || applyingPromo}
            >
              {applyingPromo ? "Checking..." : promoApplied ? "Applied" : "Apply"}
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
              ✅ {promo.toUpperCase()} applied — <b>{promoDiscountPercent}% off your first month</b>. Regular monthly price starts next month.
            </div>
          ) : null}
        </div>

        <div id="tdg-plans" className="mx-auto mt-10 max-w-xl space-y-4">
          {plans.map((p) => {
            const active = p.id === selected;
            const uiPrice = calcUiPriceForPlan(p, promoApplied, promoDiscountPercent);

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
                    ? `Continue to checkout (${promoDiscountPercent}% off first month)`
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
            {promoApplied ? promo.toUpperCase() : "none"} • Style: {funnel.styleId || "missing"}
          </div>
        </div>
      </div>
    </div>
  );
}