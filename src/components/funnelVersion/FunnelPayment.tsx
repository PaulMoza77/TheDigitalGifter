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
  discount_percent: number | string | null;
  commission_percent: number | string | null;
  max_uses: number | string | null;
  times_used: number | string | null;
  active: boolean | null;
};

type AffiliateProfileRow = {
  user_id: string;
  affiliate_code: string | null;
  referral_slug: string | null;
};

type PromoValidationResult = {
  code: string;
  discountPercent: number;
  affiliateUserId: string;
};

type FunnelContext = {
  canceled: boolean;
  email: string;
  templateId: string;
  photo: string;
  photoBucket: string;
  styleId: string;
  funnelSlug: string;
  occasion: string;
};

type UiPrice = {
  displayMain: string;
  displaySub: string;
  showThen: boolean;
  thenText: string;
  showWasOverride: boolean;
  wasOverride: string;
};

const DEFAULT_PROFILE_DISCOUNT_PERCENT = 70;

const PROMO_STORAGE_KEYS = {
  code: "tdg_promo_code",
  applied: "tdg_promo_applied",
  discountPercent: "tdg_promo_discount_percent",
  affiliateUserId: "tdg_affiliate_user_id",
} as const;

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

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePromoCode(value: string): string {
  return value.trim().toUpperCase();
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPercent(value: unknown, fallback = DEFAULT_PROFILE_DISCOUNT_PERCENT): number {
  const parsed = toFiniteNumber(value, fallback);
  return Math.max(0, Math.min(100, Math.trunc(parsed)));
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
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")} : ${String(seconds).padStart(2, "0")}`;
}

function getPublicSupabaseConfig(): { url: string; anon: string } {
  const env = import.meta.env as {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
  };

  const url = safeString(env.VITE_SUPABASE_URL);
  const anon = safeString(env.VITE_SUPABASE_ANON_KEY);

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
  const parsed = Number(String(eur).replace("€", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatEuro(value: number): string {
  return `€${(Math.round(value * 100) / 100).toFixed(2)}`;
}

function calcUiPriceForPlan(plan: Plan, promoApplied: boolean, discountPercent: number): UiPrice {
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

  const firstMonthPrice = standard * (1 - discountPercent / 100);

  return {
    displayMain: formatEuro(firstMonthPrice),
    displaySub: `first month -${discountPercent}%`,
    showThen: true,
    thenText: `then ${formatEuro(standard)}/month`,
    showWasOverride: true,
    wasOverride: plan.price,
  };
}

function resolveFunnelContext(search: string): FunnelContext {
  const params = new URLSearchParams(search);
  const session = readSession() || {};

  const templateIdFromUrl = safeString(params.get("template_id"));
  const emailFromUrl = safeString(params.get("email"));

  const email =
    emailFromUrl ||
    safeString(session.email) ||
    safeString(localStorage.getItem("tdg_email"));

  const templateId =
    templateIdFromUrl ||
    safeString(session.template_id) ||
    safeString(localStorage.getItem("tdg_template_id"));

  const photo =
    safeString(session.photo_path) ||
    safeString(localStorage.getItem("tdg_funnel_photo")) ||
    safeString(localStorage.getItem("tdg_funnel_photo_path")) ||
    safeString(localStorage.getItem("tdg_uploaded_photo_path")) ||
    safeString(localStorage.getItem("tdg_uploaded_photo_url"));

  const photoBucket =
    safeString(session.photo_bucket) ||
    safeString(localStorage.getItem("tdg_funnel_bucket")) ||
    "templates";

  const styleId =
    safeString(session.style_id) ||
    safeString(localStorage.getItem("tdg_funnel_style"));

  const funnelSlug =
    safeString(session.funnel_slug) ||
    safeString(localStorage.getItem("tdg_funnel_slug"));

  const occasion =
    safeString(session.occasion) ||
    safeString(session.gift_type) ||
    safeString(localStorage.getItem("tdg_funnel_occasion"));

  if (email || templateId || photo || photoBucket || styleId || funnelSlug || occasion) {
    mergeSession({
      ...session,
      email: email || session.email || "",
      template_id: templateId || session.template_id || null,
      photo_bucket: photoBucket || session.photo_bucket || "templates",
      photo_path: photo || session.photo_path || null,
      style_id: styleId || session.style_id || undefined,
      funnel_slug: funnelSlug || session.funnel_slug || undefined,
      occasion: occasion || session.occasion || null,
      gift_type: occasion || session.gift_type || undefined,
    });
  }

  if (email) localStorage.setItem("tdg_email", email);
  if (templateId) localStorage.setItem("tdg_template_id", templateId);
  if (photoBucket) localStorage.setItem("tdg_funnel_bucket", photoBucket);

  return {
    canceled: safeString(params.get("canceled")) === "1",
    email,
    templateId,
    photo,
    photoBucket,
    styleId,
    funnelSlug,
    occasion,
  };
}

async function getEdgeFunctionHeaders(anonKey: string): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = safeString(session?.access_token);

  return {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${accessToken || anonKey}`,
  };
}

function savePromo(result: PromoValidationResult): void {
  localStorage.setItem(PROMO_STORAGE_KEYS.code, result.code);
  localStorage.setItem(PROMO_STORAGE_KEYS.applied, "1");
  localStorage.setItem(PROMO_STORAGE_KEYS.discountPercent, String(result.discountPercent));
  localStorage.setItem(PROMO_STORAGE_KEYS.affiliateUserId, result.affiliateUserId);
}

function clearPromo(): void {
  localStorage.removeItem(PROMO_STORAGE_KEYS.code);
  localStorage.removeItem(PROMO_STORAGE_KEYS.applied);
  localStorage.removeItem(PROMO_STORAGE_KEYS.discountPercent);
  localStorage.removeItem(PROMO_STORAGE_KEYS.affiliateUserId);
}

function isTableMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;

  const message = String(error.message || "").toLowerCase();

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the table")
  );
}

function isAffiliateCodeUsable(row: AffiliateCodeRow): boolean {
  if (row.active !== true) return false;

  const maxUses = row.max_uses === null ? null : toFiniteNumber(row.max_uses, 0);
  const timesUsed = toFiniteNumber(row.times_used, 0);

  return !(maxUses !== null && maxUses > 0 && timesUsed >= maxUses);
}

async function findAffiliateCode(code: string): Promise<PromoValidationResult | null> {
  const { data, error } = await supabase
    .from("affiliate_codes")
    .select("id,user_id,code,discount_percent,commission_percent,max_uses,times_used,active")
    .ilike("code", code)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isTableMissingError(error)) return null;
    return null;
  }

  const row = data as AffiliateCodeRow | null;

  if (!row || !isAffiliateCodeUsable(row)) {
    return null;
  }

  return {
    code: normalizePromoCode(row.code || code),
    discountPercent: clampPercent(row.discount_percent, DEFAULT_PROFILE_DISCOUNT_PERCENT),
    affiliateUserId: row.user_id,
  };
}

async function findAffiliateProfile(code: string): Promise<PromoValidationResult | null> {
  const { data, error } = await supabase
    .from("affiliate_profiles")
    .select("user_id,affiliate_code,referral_slug")
    .or(`affiliate_code.ilike.${code},referral_slug.ilike.${code}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isTableMissingError(error)) return null;
    return null;
  }

  const row = data as AffiliateProfileRow | null;

  if (!row?.user_id) {
    return null;
  }

  const matchedCode = row.affiliate_code || row.referral_slug || code;

  return {
    code: normalizePromoCode(matchedCode),
    discountPercent: DEFAULT_PROFILE_DISCOUNT_PERCENT,
    affiliateUserId: row.user_id,
  };
}

async function validatePromoCode(codeRaw: string): Promise<PromoValidationResult> {
  const code = normalizePromoCode(codeRaw);

  if (!code) {
    throw new Error("Enter a promo code.");
  }

  const affiliateCodeResult = await findAffiliateCode(code);
  if (affiliateCodeResult) {
    return affiliateCodeResult;
  }

  const profileResult = await findAffiliateProfile(code);
  if (profileResult) {
    return profileResult;
  }

  throw new Error("Invalid promo code");
}

export default function FunnelPayment(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

  const [selected, setSelected] = useState<PlanId>(() => plans.find((plan) => plan.default)?.id ?? "pro");
  const [promo, setPromo] = useState<string>(() => localStorage.getItem(PROMO_STORAGE_KEYS.code) || "");
  const [promoApplied, setPromoApplied] = useState<boolean>(
    () => localStorage.getItem(PROMO_STORAGE_KEYS.applied) === "1"
  );
  const [promoDiscountPercent, setPromoDiscountPercent] = useState<number>(() =>
    clampPercent(localStorage.getItem(PROMO_STORAGE_KEYS.discountPercent), 0)
  );
  const [affiliateUserId, setAffiliateUserId] = useState<string>(
    () => localStorage.getItem(PROMO_STORAGE_KEYS.affiliateUserId) || ""
  );
  const [applyingPromo, setApplyingPromo] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const ms = getDealExpiresAtMs() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });
  const [isPaying, setIsPaying] = useState<boolean>(false);

  const funnel = useMemo(() => resolveFunnelContext(location.search), [location.search]);
  const selectedPlan = useMemo<Plan>(() => plans.find((plan) => plan.id === selected) ?? plans[1], [selected]);
  const expired = secondsLeft <= 0;
  const formattedTimer = useMemo(() => formatMMSS(secondsLeft).split(" : "), [secondsLeft]);

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

    if (!funnel.templateId) {
      toast.error("Choose a style/template first.");
      navigate("/funnel/styleSelect", { replace: true });
      return;
    }

    if (!funnel.email) {
      toast.error("Please enter your email to continue.");
      navigate("/funnel/email", { replace: true });
    }
  }, [navigate, funnel.photo, funnel.styleId, funnel.templateId, funnel.email]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const ms = getDealExpiresAtMs() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  async function applyPromo(): Promise<void> {
    if (applyingPromo || promoApplied) return;

    try {
      setApplyingPromo(true);

      const result = await validatePromoCode(promo);

      savePromo(result);

      setPromo(result.code);
      setPromoDiscountPercent(result.discountPercent);
      setAffiliateUserId(result.affiliateUserId);
      setPromoApplied(true);

      toast.success(`${result.code} applied — ${result.discountPercent}% off first month.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid promo code";
      toast.error(message);
    } finally {
      setApplyingPromo(false);
    }
  }

  function removePromo(): void {
    clearPromo();
    setPromo("");
    setPromoApplied(false);
    setPromoDiscountPercent(0);
    setAffiliateUserId("");
    toast.message("Promo removed.");
  }

  async function onCheckout(): Promise<void> {
    if (isPaying) return;

    if (!funnel.photo) {
      toast.error("Upload a photo first.");
      navigate("/funnel/uploadPhoto", { replace: true });
      return;
    }

    if (!funnel.styleId || !funnel.templateId) {
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
      const { url: supabaseUrl, anon: anonKey } = getPublicSupabaseConfig();
      const headers = await getEdgeFunctionHeaders(anonKey);
      const session = readSession();

      const payload = {
        plan: selected,
        email: funnel.email,
        template_id: funnel.templateId || null,
        promo_code: promoApplied ? normalizePromoCode(promo) : "",
        affiliate_user_id: promoApplied ? affiliateUserId || null : null,
        promo_discount_percent: promoApplied ? promoDiscountPercent : 0,
        style_id: funnel.styleId || null,
        funnel_slug: funnel.funnelSlug || null,
        occasion: funnel.occasion || null,
        photo_path: funnel.photo || null,
        photo_bucket: funnel.photoBucket || session?.photo_bucket || "templates",
      };

      const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await safeReadJson(res);

      if (!res.ok) {
        const message = safeString(data.error || data.message || `Checkout error (${res.status})`);
        throw new Error(message);
      }

      if (data.id) {
        localStorage.setItem("tdg_last_checkout_session_id", data.id);
      }

      if (data.generation_id) {
        mergeSession({
          generation_id: data.generation_id,
          template_id: funnel.templateId || null,
          style_id: funnel.styleId || undefined,
          photo_bucket: funnel.photoBucket || "templates",
          photo_path: funnel.photo || null,
        });
      }

      const checkoutUrl = safeString(data.url);
      if (!checkoutUrl) {
        throw new Error("Missing checkout URL");
      }

      window.location.href = checkoutUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed. Please try again.";
      toast.error(message);
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
              <div className="text-4xl font-semibold tabular-nums leading-none">{formattedTimer[0]}</div>
              <div className="pb-1 text-4xl font-semibold leading-none">:</div>
              <div className="text-4xl font-semibold tabular-nums leading-none">{formattedTimer[1]}</div>
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
              {promoApplied ? `Promo applied (${normalizePromoCode(promo)})` : "Have a promo code?"}
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
              onChange={(event) => setPromo(event.target.value)}
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
              ✅ {normalizePromoCode(promo)} applied — <b>{promoDiscountPercent}% off your first month</b>. Regular
              monthly price starts next month.
            </div>
          ) : null}
        </div>

        <div id="tdg-plans" className="mx-auto mt-10 max-w-xl space-y-4">
          {plans.map((plan) => {
            const active = plan.id === selected;
            const uiPrice = calcUiPriceForPlan(plan, promoApplied, promoDiscountPercent);

            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelected(plan.id)}
                className={cn(
                  "w-full rounded-2xl border bg-white/55 text-left transition",
                  active ? "border-[#D44B4B] bg-white" : "border-black/10 hover:bg-white/70"
                )}
              >
                <div className="relative p-5">
                  {plan.badge ? (
                    <div
                      className={cn(
                        "absolute -top-3 right-5 rounded-full px-3 py-1 text-[11px] font-semibold",
                        plan.badgeTone === "yellow" ? "bg-[#F3D35B] text-[#10221B]" : "bg-[#D44B4B] text-white"
                      )}
                    >
                      {plan.badge}
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
                        <div className="text-lg font-semibold">{plan.title}</div>
                        <div className="mt-0.5 text-sm text-[#10221B]/65">
                          {plan.subtitle} • ({plan.generations} generations)
                        </div>

                        {promoApplied && uiPrice.showThen ? (
                          <div className="mt-2 text-xs text-[#10221B]/60">{uiPrice.thenText}</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-right">
                      {uiPrice.showWasOverride ? (
                        <div className="text-xs text-[#10221B]/45 line-through">{uiPrice.wasOverride}</div>
                      ) : plan.was ? (
                        <div className="text-xs text-[#10221B]/45 line-through">{plan.was}</div>
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
              {["MC", "VISA", "Pay", "GPay"].map((label) => (
                <div
                  key={label}
                  className="flex h-9 min-w-[56px] items-center justify-center rounded-xl border border-black/10 bg-white/70 px-3 text-xs font-semibold text-[#10221B]/70"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-6 text-center text-xs text-[#10221B]/55">
              ✔ Reset lunar (nu se acumulează) • ✔ Recurent automat • ✔ Anulare oricând
            </div>
          </div>

          <div className="pt-6 text-center text-[11px] text-[#10221B]/35">
            Selected: {selectedPlan.id} • Credits: {selectedPlan.credits} • Promo:{" "}
            {promoApplied ? normalizePromoCode(promo) : "none"} • Style: {funnel.styleId || "missing"} • Template:{" "}
            {funnel.templateId || "missing"}
          </div>
        </div>
      </div>
    </div>
  );
}