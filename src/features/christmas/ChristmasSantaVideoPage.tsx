import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { captureFunnelAttribution, attributionParamsForInternal } from "@/features/pet/funnelAttribution";
import { trackChristmasEvent, getChristmasFunnelSessionId } from "./analytics";
import { CHRISTMAS_CATALOG_SEED, findProduct, ctaStateForProduct } from "./catalog";
import { startChristmasCheckout } from "./photoApi";
import {
  SANTA_CONSENT_LABEL,
  SANTA_CONSENT_VERSION,
  SANTA_DEFAULT_PACKAGE,
  SANTA_PRODUCT_KEY,
  SANTA_ROUTE,
  SANTA_V1_ENABLED_TEMPLATES,
  santaAnalyticsDimensions,
  santaProgressCopy,
  validateSantaPersonalization,
  type SantaJobStatus,
  type SantaPersonalization,
} from "./santa/santaTypes";

type Step = "intro" | "form" | "review" | "offer" | "checkout" | "progress" | "result" | "error";

const DRAFT_KEY = "tdg.christmas.santa.v1";

type Draft = {
  step: Step;
  childFirstName: string;
  language: "en" | "ro";
  age: string;
  somethingGood: string;
  hobbyOrInterest: string;
  christmasWish: string;
  customFact: string;
  senderName: string;
  templateKey: string;
  guardianConsent: boolean;
  email: string;
  orderId: string | null;
  publicToken: string | null;
  lastError: string | null;
};

function emptyDraft(): Draft {
  return {
    step: "intro",
    childFirstName: "",
    language: "en",
    age: "",
    somethingGood: "",
    hobbyOrInterest: "",
    christmasWish: "",
    customFact: "",
    senderName: "",
    templateKey: SANTA_V1_ENABLED_TEMPLATES[0],
    guardianConsent: false,
    email: "",
    orderId: null,
    publicToken: null,
    lastError: null,
  };
}

function readDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    return { ...emptyDraft(), ...JSON.parse(raw) };
  } catch {
    return emptyDraft();
  }
}

function writeDraft(d: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

const FUNNEL_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-santa-funnel`;

async function anonHeaders(): Promise<Record<string, string>> {
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
  return {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  };
}

export default function ChristmasSantaVideoPage() {
  const [params] = useSearchParams();
  const [draft, setDraft] = useState<Draft>(() => readDraft());
  const [busy, setBusy] = useState(false);
  const [jobStatus, setJobStatus] = useState<SantaJobStatus | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<{
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
  } | null>(null);
  const pageViewed = useRef(false);
  const product = findProduct(CHRISTMAS_CATALOG_SEED, SANTA_PRODUCT_KEY);
  const pkg = product?.packages.find((p) => p.packageKey === SANTA_DEFAULT_PACKAGE);
  const purchasable = Boolean(pkg?.purchasable && pkg.priceCents > 0);

  const patch = useCallback((next: Partial<Draft>) => {
    setDraft((prev) => {
      const merged = { ...prev, ...next, lastError: next.lastError ?? null };
      writeDraft(merged);
      return merged;
    });
  }, []);

  useEffect(() => {
    if (pageViewed.current) return;
    pageViewed.current = true;
    captureFunnelAttribution(window.location.search);
    void trackChristmasEvent("christmas_page_view", {
      productKey: SANTA_PRODUCT_KEY,
      pathname: SANTA_ROUTE,
    });
  }, []);

  useEffect(() => {
    const token = params.get("token");
    if (!token) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const res = await fetch(FUNNEL_URL, {
          method: "POST",
          headers: await anonHeaders(),
          body: JSON.stringify({ action: "getOrder", public_token: token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Recovery failed");
        if (cancelled) return;
        patch({
          orderId: data.order.id,
          publicToken: token,
          step:
            data.order.fulfillment_status === "completed"
              ? "result"
              : data.order.payment_status === "paid"
                ? "progress"
                : "offer",
        });
        if (data.order.job?.job_status) setJobStatus(data.order.job.job_status);
        if (data.order.resultUrl) setResultUrl(data.order.resultUrl);
      } catch (err) {
        if (!cancelled) {
          patch({
            step: "error",
            lastError: err instanceof Error ? err.message : "Could not recover order",
          });
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, patch]);

  useEffect(() => {
    if (draft.step !== "progress" || !draft.publicToken) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(FUNNEL_URL, {
          method: "POST",
          headers: await anonHeaders(),
          body: JSON.stringify({ action: "getOrder", public_token: draft.publicToken }),
        });
        const data = await res.json();
        if (stop || !res.ok) return;
        const status = data.order?.job?.job_status as SantaJobStatus | undefined;
        if (status) setJobStatus(status);
        if (data.order?.fulfillment_status === "completed" && data.order.resultUrl) {
          setResultUrl(data.order.resultUrl);
          patch({ step: "result" });
          void trackChristmasEvent("generation_success", {
            productKey: SANTA_PRODUCT_KEY,
            orderId: draft.orderId,
            ...santaAnalyticsDimensions({
              language: draft.language,
              templateKey: draft.templateKey,
            }),
          });
          return;
        }
        if (data.order?.fulfillment_status === "failed" || status === "failed") {
          patch({
            step: "error",
            lastError: data.order?.job?.error_message_safe || data.order?.last_error || "Generation failed",
          });
          void trackChristmasEvent("generation_failed", {
            productKey: SANTA_PRODUCT_KEY,
            orderId: draft.orderId,
          });
        }
      } catch {
        /* keep polling */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [draft.step, draft.publicToken, draft.orderId, draft.language, draft.templateKey, patch]);

  function validated(): SantaPersonalization | null {
    const result = validateSantaPersonalization({
      childFirstName: draft.childFirstName,
      language: draft.language,
      age: draft.age ? Number(draft.age) : null,
      somethingGood: draft.somethingGood,
      hobbyOrInterest: draft.hobbyOrInterest,
      christmasWish: draft.christmasWish,
      customFact: draft.customFact,
      senderName: draft.senderName,
      templateKey: draft.templateKey,
      guardianConsent: draft.guardianConsent,
    });
    if (!result.ok) {
      patch({ lastError: result.message });
      return null;
    }
    return result.value;
  }

  function goForm() {
    patch({ step: "form" });
    void trackChristmasEvent("santa_form_started", {
      productKey: SANTA_PRODUCT_KEY,
      pathname: SANTA_ROUTE,
    });
  }

  function goReview() {
    const v = validated();
    if (!v) return;
    patch({ step: "review" });
    void trackChristmasEvent("santa_form_completed", {
      productKey: SANTA_PRODUCT_KEY,
      ...santaAnalyticsDimensions({
        language: v.language,
        templateKey: v.templateKey,
        hasAge: v.age != null,
        hasWish: Boolean(v.christmasWish),
        hasHobby: Boolean(v.hobbyOrInterest),
      }),
    });
  }

  function goOffer() {
    patch({ step: "offer" });
    void trackChristmasEvent("offer_seen", {
      productKey: SANTA_PRODUCT_KEY,
      packageKey: SANTA_DEFAULT_PACKAGE,
      amountCents: pkg?.purchasable ? pkg.priceCents : null,
    });
  }

  async function startCheckout() {
    if (!purchasable) {
      patch({
        step: "offer",
        lastError: "Checkout is not enabled yet — production price is not configured.",
      });
      return;
    }
    const v = validated();
    if (!v) return;
    setBusy(true);
    void trackChristmasEvent("checkout_started", {
      productKey: SANTA_PRODUCT_KEY,
      packageKey: SANTA_DEFAULT_PACKAGE,
    });
    try {
      captureFunnelAttribution(window.location.search);
      const attr = attributionParamsForInternal();
      const result = await startChristmasCheckout({
        product_key: SANTA_PRODUCT_KEY,
        package_key: SANTA_DEFAULT_PACKAGE,
        amount_cents: 1,
        currency: "eur",
        email: draft.email || undefined,
        child_first_name: v.childFirstName,
        language: v.language,
        age: v.age,
        something_good: v.somethingGood,
        hobby_or_interest: v.hobbyOrInterest,
        christmas_wish: v.christmasWish,
        custom_fact: v.customFact,
        sender_name: v.senderName,
        template_key: v.templateKey,
        guardian_consent: true,
        consent_version: SANTA_CONSENT_VERSION,
        source_route: SANTA_ROUTE,
        existing_order_id: draft.orderId,
        public_token: draft.publicToken || undefined,
        funnel_session_id: getChristmasFunnelSessionId(),
        landing_path: `${window.location.pathname}${window.location.search}`.slice(0, 120),
        utm_source: attr.utm_source,
        utm_medium: attr.utm_medium,
        utm_campaign: attr.utm_campaign,
        success_url: `${window.location.origin}${SANTA_ROUTE}?checkout=success`,
      });
      setCheckout({
        clientSecret: result.clientSecret,
        publishableKey: result.publishableKey,
        amountCents: result.amountCents,
      });
      patch({
        step: "checkout",
        orderId: result.orderId,
        publicToken: result.publicToken,
      });
    } catch (err) {
      patch({
        step: "offer",
        lastError: err instanceof Error ? err.message : "Checkout failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onDownload() {
    if (!resultUrl || !draft.orderId) return;
    void trackChristmasEvent("download", {
      productKey: SANTA_PRODUCT_KEY,
      orderId: draft.orderId,
    });
    const res = await fetch(resultUrl);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `tdg-santa-video-${draft.orderId.slice(0, 8)}.mp4`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <>
      <PageHead
        title="Personalized Santa Video | The Digital Gifter"
        description="Santa knows their name this Christmas. A private personalized spoken Santa video in English or Romanian."
        exactTitle
        url="https://www.thedigitalgifter.com/christmas/santa-video"
      />
      <main className="mx-auto min-h-[70vh] max-w-lg px-4 py-8 text-slate-900">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          The Digital Gifter · Christmas
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Santa knows their name this Christmas.
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          A private personalized video where Santa speaks directly to your child — with their name,
          a warm detail or two, and a Christmas wish.
        </p>

        {draft.lastError ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {draft.lastError}
          </p>
        ) : null}

        {draft.step === "intro" && (
          <section className="mt-8 space-y-4">
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>Spoken personalized message</li>
              <li>English or Romanian</li>
              <li>Private delivery — no public gallery</li>
            </ul>
            <button
              type="button"
              className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white"
              onClick={goForm}
            >
              Personalize Santa’s message
            </button>
          </section>
        )}

        {draft.step === "form" && (
          <section className="mt-8 space-y-4">
            <label className="block text-sm">
              Child’s first name *
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={draft.childFirstName}
                onChange={(e) => patch({ childFirstName: e.target.value })}
                maxLength={40}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              Language *
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={draft.language}
                onChange={(e) => patch({ language: e.target.value as "en" | "ro" })}
              >
                <option value="en">English</option>
                <option value="ro">Romanian</option>
              </select>
            </label>
            <label className="block text-sm">
              Age (optional)
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                type="number"
                min={1}
                max={17}
                value={draft.age}
                onChange={(e) => patch({ age: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Something good they did (optional)
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={draft.somethingGood}
                onChange={(e) => patch({ somethingGood: e.target.value })}
                maxLength={120}
              />
            </label>
            <label className="block text-sm">
              Hobby / interest (optional)
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={draft.hobbyOrInterest}
                onChange={(e) => patch({ hobbyOrInterest: e.target.value })}
                maxLength={80}
              />
            </label>
            <label className="block text-sm">
              Christmas wish (optional)
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={draft.christmasWish}
                onChange={(e) => patch({ christmasWish: e.target.value })}
                maxLength={120}
              />
            </label>
            <label className="block text-sm">
              From whom? (optional)
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={draft.senderName}
                onChange={(e) => patch({ senderName: e.target.value })}
                maxLength={60}
              />
            </label>
            <p className="text-sm font-medium">Santa style</p>
            <p className="text-xs text-slate-500">Classic Santa (more styles coming later)</p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={draft.guardianConsent}
                onChange={(e) => patch({ guardianConsent: e.target.checked })}
              />
              <span>{SANTA_CONSENT_LABEL} Details are used only to generate this private video.</span>
            </label>
            <button
              type="button"
              className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white"
              onClick={goReview}
            >
              Review
            </button>
          </section>
        )}

        {draft.step === "review" && (
          <section className="mt-8 space-y-3 text-sm text-slate-700">
            <h2 className="text-lg font-medium text-slate-900">Review</h2>
            <p>
              <span className="text-slate-500">Name:</span> {draft.childFirstName}
            </p>
            <p>
              <span className="text-slate-500">Language:</span>{" "}
              {draft.language === "ro" ? "Romanian" : "English"}
            </p>
            {draft.age ? (
              <p>
                <span className="text-slate-500">Age:</span> {draft.age}
              </p>
            ) : null}
            {draft.somethingGood ? (
              <p>
                <span className="text-slate-500">Something good:</span> {draft.somethingGood}
              </p>
            ) : null}
            {draft.hobbyOrInterest ? (
              <p>
                <span className="text-slate-500">Hobby:</span> {draft.hobbyOrInterest}
              </p>
            ) : null}
            {draft.christmasWish ? (
              <p>
                <span className="text-slate-500">Wish:</span> {draft.christmasWish}
              </p>
            ) : null}
            {draft.senderName ? (
              <p>
                <span className="text-slate-500">From:</span> {draft.senderName}
              </p>
            ) : null}
            <p>
              <span className="text-slate-500">Style:</span> Classic Santa
            </p>
            <p className="text-xs text-slate-500">
              Deliverable: one private personalized Santa video (spoken). Typical length about half a
              minute to about a minute depending on your details.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="flex-1 rounded-md border border-slate-300 px-4 py-3 text-sm font-medium"
                onClick={() => patch({ step: "form" })}
              >
                Edit
              </button>
              <button
                type="button"
                className="flex-1 rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                onClick={goOffer}
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {draft.step === "offer" && (
          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-medium">Unlock your Santa video</h2>
            <p className="text-sm text-slate-600">
              After payment, Santa’s message is prepared, spoken, and rendered as a private MP4. You
              can close this page — reopen your order link anytime.
            </p>
            <label className="block text-sm">
              Email for receipt / recovery (optional)
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                type="email"
                value={draft.email}
                onChange={(e) => patch({ email: e.target.value })}
              />
            </label>
            {purchasable && pkg ? (
              <button
                type="button"
                className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                disabled={busy}
                onClick={() => void startCheckout()}
              >
                {busy ? "Preparing checkout…" : `Pay ${(pkg.priceCents / 100).toFixed(2)}`}
              </button>
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Preview available — purchase is not enabled yet (production price not configured).
                The personalization form works; checkout stays off until launch configuration.
              </p>
            )}
            {product ? (
              <p className="text-xs text-slate-500">Product status: {ctaStateForProduct(product)}</p>
            ) : null}
          </section>
        )}

        {draft.step === "checkout" && checkout && (
          <section className="mt-8 space-y-4">
            <h2 className="text-lg font-medium">Secure payment</h2>
            <CustomStripeCheckout
              clientSecret={checkout.clientSecret}
              publishableKey={checkout.publishableKey}
              dueDisplay={`$${(checkout.amountCents / 100).toFixed(2)}`}
              returnUrl={`${window.location.origin}${SANTA_ROUTE}?checkout=success&token=${encodeURIComponent(draft.publicToken || "")}`}
              email={draft.email}
            />
          </section>
        )}

        {draft.step === "progress" && (
          <section className="mt-8 space-y-3 text-sm text-slate-600">
            <h2 className="text-lg font-medium text-slate-900">Creating your Santa video</h2>
            <p>{santaProgressCopy(jobStatus || "queued")}</p>
            <p className="text-xs">
              This can take several minutes. You can close this page — we’ll keep working, and you can
              reopen your order link{draft.email ? " or check your email" : ""} when it’s ready.
            </p>
          </section>
        )}

        {draft.step === "result" && resultUrl && (
          <section className="mt-8 space-y-4">
            <video
              src={resultUrl}
              controls
              playsInline
              className="w-full rounded-lg bg-black"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                onClick={() => void onDownload()}
              >
                Download MP4
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-3 text-sm font-medium"
                onClick={() => {
                  const next = emptyDraft();
                  writeDraft(next);
                  setDraft(next);
                  setResultUrl(null);
                  setCheckout(null);
                }}
              >
                Create another
              </button>
              <Link to="/christmas/photo-generator" className="text-center text-sm underline">
                Try a Christmas portrait
              </Link>
            </div>
          </section>
        )}

        {draft.step === "error" && (
          <section className="mt-8 space-y-3">
            <h2 className="text-lg font-medium">Something went wrong</h2>
            <p className="text-sm text-slate-600">
              If you already paid, keep your order link — support can retry without charging again.
            </p>
            <Link to="/christmas" className="text-sm underline">
              Christmas hub
            </Link>
          </section>
        )}

        <nav className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
          <Link to="/christmas" className="hover:underline">
            Christmas hub
          </Link>
          <Link to="/christmas/photo-generator" className="hover:underline">
            Christmas portrait
          </Link>
        </nav>
      </main>
    </>
  );
}
