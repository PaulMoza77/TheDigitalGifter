import React, { JSX, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getPublicSupabaseConfig } from "@/lib/env";
import { productTruth, isCheckoutEnabled } from "@/config/productTruth";
import { productModel } from "@/config/productModel";
import { readOrCreateCheckoutRequestId } from "@/lib/checkoutRequest";

type FunnelSession = {
  gift_type?: string;
  style_id?: string;
  script?: string;
  email?: string;
  lead_id?: string | number | null;
  funnel_slug?: string;
  generation_id?: string | null;
  order_id?: string | null;
  template_id?: string | null;
  occasion?: string | null;
  photo_bucket?: string | null;
  photo_path?: string | null;
  upload_id?: string | null;
  access_token?: string | null;
};

type CheckoutResponse = {
  url?: string;
  checkoutUrl?: string;
  sessionUrl?: string;
  id?: string;
  error?: string;
  message?: string;
  generation_id?: string;
  order_id?: string;
  access_token?: string;
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
  uploadId: string;
  accessToken: string;
};

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

function readSession(): FunnelSession | null {
  try {
    return JSON.parse(
      localStorage.getItem("tdg_funnel_session") || "null",
    ) as FunnelSession | null;
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

async function safeReadJson(res: Response): Promise<CheckoutResponse> {
  try {
    return (await res.json()) as CheckoutResponse;
  } catch {
    return {};
  }
}

function resolveFunnelContext(search: string): FunnelContext {
  const params = new URLSearchParams(search);
  const session = readSession() || {};

  const email =
    safeString(params.get("email")) ||
    safeString(session.email) ||
    safeString(localStorage.getItem("tdg_email"));

  const templateId =
    safeString(params.get("template_id")) ||
    safeString(session.template_id) ||
    safeString(localStorage.getItem("tdg_template_id"));

  const photo =
    safeString(session.photo_path) ||
    safeString(localStorage.getItem("tdg_funnel_photo")) ||
    safeString(localStorage.getItem("tdg_funnel_photo_path")) ||
    safeString(localStorage.getItem("tdg_uploaded_photo_path"));

  const photoBucket =
    safeString(session.photo_bucket) ||
    safeString(localStorage.getItem("tdg_funnel_bucket")) ||
    "customer-uploads";

  const uploadId =
    safeString(session.upload_id) ||
    safeString(localStorage.getItem("tdg_upload_id"));

  const accessToken =
    safeString(session.access_token) ||
    safeString(localStorage.getItem("tdg_upload_access_token"));

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

  mergeSession({
    ...session,
    email: email || session.email || "",
    template_id: templateId || session.template_id || null,
    photo_bucket: photoBucket,
    photo_path: photo || session.photo_path || null,
    upload_id: uploadId || session.upload_id || null,
    access_token: accessToken || session.access_token || null,
    style_id: styleId || session.style_id || undefined,
    funnel_slug: funnelSlug || session.funnel_slug || undefined,
    occasion: occasion || session.occasion || null,
  });

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
    uploadId,
    accessToken,
  };
}

async function getEdgeFunctionHeaders(anonKey: string): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${safeString(session?.access_token) || anonKey}`,
  };
}

export default function FunnelPayment(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [isPaying, setIsPaying] = useState(false);
  const [consent, setConsent] = useState(false);

  const funnel = useMemo(
    () => resolveFunnelContext(location.search),
    [location.search],
  );

  useEffect(() => {
    if (funnel.canceled) {
      toast.error("Checkout was abandoned. No payment was taken.");
    }
  }, [funnel.canceled]);

  useEffect(() => {
    if (!funnel.uploadId || !funnel.accessToken) {
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
      toast.error("Please enter your email to continue.");
      navigate("/funnel/email", { replace: true });
    }
  }, [navigate, funnel.uploadId, funnel.accessToken, funnel.styleId, funnel.templateId, funnel.email]);

  async function onCheckout(): Promise<void> {
    if (isPaying) return;

    if (!isCheckoutEnabled()) {
      toast.error(productTruth.copy.checkoutUnavailable);
      return;
    }

    if (!consent) {
      toast.error("Please confirm immediate supply of the digital image.");
      return;
    }

    setIsPaying(true);

    try {
      const { url: supabaseUrl, anon: anonKey } = getPublicSupabaseConfig();
      const headers = await getEdgeFunctionHeaders(anonKey);
      const checkoutRequestId = readOrCreateCheckoutRequestId(funnel.uploadId);

      const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: funnel.email,
          template_id: funnel.templateId || null,
          style_id: funnel.styleId || null,
          funnel_slug: funnel.funnelSlug || null,
          occasion: funnel.occasion || null,
          upload_id: funnel.uploadId,
          access_token: funnel.accessToken,
          checkout_request_id: checkoutRequestId,
          digital_content_consent: true,
          source: "tdg_funnel_mvp",
        }),
      });

      const data = await safeReadJson(res);
      if (!res.ok) {
        throw new Error(
          safeString(data.error || data.message || `Checkout error (${res.status})`),
        );
      }

      if (data.id) localStorage.setItem("tdg_last_checkout_session_id", data.id);
      if (data.order_id) localStorage.setItem("tdg_last_order_id", data.order_id);
      localStorage.removeItem("tdg_order_access_token");

      mergeSession({
        generation_id: data.generation_id || null,
        order_id: data.order_id || null,
        template_id: funnel.templateId || null,
        style_id: funnel.styleId || undefined,
        photo_bucket: funnel.photoBucket || "customer-uploads",
        photo_path: funnel.photo || null,
        upload_id: funnel.uploadId,
        access_token: funnel.accessToken,
      });

      const checkoutUrl = safeString(data.url || data.checkoutUrl || data.sessionUrl);
      if (!checkoutUrl) throw new Error("Missing checkout URL");
      window.location.href = checkoutUrl;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Checkout failed. Please try again.",
      );
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#F6F0E6] text-[#10221B]">
      <div className="mx-auto w-full max-w-xl px-5 py-10 sm:py-14">
        <div className="text-center">
          <div className="text-2xl font-semibold tracking-tight">
            {productTruth.brandName}
          </div>
          <h1 className="mx-auto mt-8 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
            One personalized still image
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[#10221B]/70 sm:text-base">
            {productModel.displayPrice} · {productTruth.publicCurrency} · one purchase,
            no subscription, no credits.
          </p>
        </div>

        <div className="mx-auto mt-10 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{productModel.name}</h2>
              <p className="mt-2 text-sm leading-6 text-[#10221B]/70">
                {productModel.description}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold">{productModel.displayPrice}</div>
              <div className="text-xs uppercase tracking-wide text-[#10221B]/50">
                one-time · EUR
              </div>
            </div>
          </div>

          <ul className="mt-5 space-y-2 text-sm text-[#10221B]/80">
            <li>Still image only</li>
            <li>One included regeneration if the first result is not usable</li>
            <li>{productTruth.copy.licenseSentence}</li>
            <li>Support usually within {productTruth.copy.supportResponseTime}</li>
            <li>VAT may be added at checkout for EU customers where required</li>
          </ul>

          <label className="mt-6 flex items-start gap-3 rounded-xl border border-black/10 bg-[#F6F0E6] p-4 text-sm leading-6">
            <input
              type="checkbox"
              className="mt-1"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>
              {productTruth.copy.digitalContentConsent} See the{" "}
              <Link to="/refunds" className="underline">
                Refund Policy
              </Link>{" "}
              and{" "}
              <Link to="/terms" className="underline">
                Terms
              </Link>
              .
            </span>
          </label>

          {!isCheckoutEnabled() ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {productTruth.copy.checkoutUnavailable}
            </p>
          ) : null}

          <button
            type="button"
            disabled={!isCheckoutEnabled() || isPaying || !consent}
            className={cn(
              "mt-5 h-12 w-full rounded-full text-sm font-semibold transition",
              !isCheckoutEnabled() || isPaying || !consent
                ? "cursor-not-allowed bg-[#1B3A30]/15 text-[#10221B]/45"
                : "bg-[#1B3A30] text-white hover:brightness-105",
            )}
            onClick={() => void onCheckout()}
          >
            {!isCheckoutEnabled()
              ? "Checkout unavailable"
              : isPaying
                ? "Opening checkout…"
                : `Pay ${productModel.displayPrice}`}
          </button>
        </div>
      </div>
    </div>
  );
}
