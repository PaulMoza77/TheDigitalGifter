import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { captureFunnelAttribution, attributionParamsForInternal } from "@/features/pet/funnelAttribution";
import { ChristmasSnowfall } from "@/features/christmas-v2/ChristmasSnowfall";
import { trackChristmasEvent, getChristmasFunnelSessionId } from "./analytics";
import { CHRISTMAS_CATALOG_SEED, findProduct, ctaStateForProduct } from "./catalog";
import { startChristmasCheckout } from "./photoApi";
import {
  consumeSantaNameHandoff,
  isLikelyKidName,
  sanitizeKidName,
} from "./landing/handoff";
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
import { SANTA_COPY, progressLabel, type SantaRecipientType } from "./santa/santaCopy";
import {
  emptySantaDraft,
  readSantaDraft,
  santaFunnelProgress,
  writeSantaDraft,
  type SantaDraft,
  type SantaUiStep,
} from "./santa/santaDraft";
import { resolveIncomingSantaName } from "./santa/santaHandoff";
import { buildSantaMessagePreview, santaMentionChecklist } from "./santa/santaPreview";
import { SANTA_DEMO_EXAMPLES } from "./santa/santaExamples";
import { SantaWorkshopScene } from "./santa/SantaWorkshopScene";
import { SantaDemoPlayer } from "./santa/SantaDemoPlayer";
import { SantaLandingSections } from "./santa/SantaLandingSections";

const FUNNEL_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-santa-funnel`;

async function anonHeaders(): Promise<Record<string, string>> {
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
  return {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  };
}

function ensureFonts() {
  const id = "tdg-santa-fonts";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

function trackSanta(
  eventName:
    | "christmas_santa_page_view"
    | "christmas_santa_started"
    | "christmas_santa_recipient_selected"
    | "christmas_santa_name_completed"
    | "christmas_santa_age_completed"
    | "christmas_santa_achievement_completed"
    | "christmas_santa_wish_completed"
    | "christmas_santa_preview_viewed"
    | "christmas_santa_checkout_started"
    | "christmas_santa_generation_started"
    | "christmas_santa_generation_completed"
    | "christmas_santa_shared"
    | "santa_form_started"
    | "santa_form_completed"
    | "offer_seen"
    | "checkout_started"
    | "generation_success"
    | "generation_failed"
    | "download"
    | "share"
    | "christmas_page_view",
  metadata?: Record<string, unknown>,
  extra?: { orderId?: string | null; amountCents?: number | null; packageKey?: string | null },
) {
  void trackChristmasEvent(eventName, {
    productKey: SANTA_PRODUCT_KEY,
    pathname: SANTA_ROUTE,
    packageKey: extra?.packageKey,
    orderId: extra?.orderId,
    amountCents: extra?.amountCents,
    metadata,
  });
}

export default function ChristmasSantaVideoPage() {
  const [params] = useSearchParams();
  const [draft, setDraft] = useState<SantaDraft>(() => readSantaDraft());
  const [busy, setBusy] = useState(false);
  const [jobStatus, setJobStatus] = useState<SantaJobStatus | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [progressTick, setProgressTick] = useState(0);
  const [checkout, setCheckout] = useState<{
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
  } | null>(null);
  const pageViewed = useRef(false);
  const handoffApplied = useRef(false);
  const previewTracked = useRef(false);
  const product = findProduct(CHRISTMAS_CATALOG_SEED, SANTA_PRODUCT_KEY);
  const pkg = product?.packages.find((p) => p.packageKey === SANTA_DEFAULT_PACKAGE);
  const purchasable = Boolean(pkg?.purchasable && pkg.priceCents > 0);

  const patch = useCallback((next: Partial<SantaDraft>) => {
    setDraft((prev) => {
      const merged = { ...prev, ...next, lastError: next.lastError === undefined ? prev.lastError : next.lastError };
      if (next.lastError === null || next.step) {
        merged.lastError = next.lastError ?? null;
      }
      writeSantaDraft(merged);
      return merged;
    });
  }, []);

  useEffect(() => {
    ensureFonts();
    const id = "santa-video-faq-jsonld";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: SANTA_COPY.sections.faq.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  useEffect(() => {
    if (pageViewed.current) return;
    pageViewed.current = true;
    captureFunnelAttribution(window.location.search);
    trackSanta("christmas_page_view");
    trackSanta("christmas_santa_page_view");
  }, []);

  // Homepage / query name handoff — skip asking for the name again
  useEffect(() => {
    if (handoffApplied.current) return;
    if (params.get("token")) return;
    const incoming = resolveIncomingSantaName(params);
    if (!incoming) {
      handoffApplied.current = true;
      return;
    }
    handoffApplied.current = true;
    const current = readSantaDraft();
    if (current.orderId || current.step === "progress" || current.step === "result" || current.step === "checkout") {
      return;
    }
    if (current.childFirstName && current.step !== "landing" && current.step !== "name" && current.step !== "recipient") {
      return;
    }
    // Keep landing for the personalized hero; skip recipient + name questions.
    const nextStep: SantaUiStep =
      current.step === "name" || current.step === "recipient"
        ? "age"
        : current.step === "landing"
          ? "landing"
          : current.step;
    patch({
      childFirstName: incoming.firstName,
      nameFromHandoff: true,
      recipientType: "child",
      step: nextStep,
    });
  }, [params, patch]);

  useEffect(() => {
    if (nameHandoffApplied.current) return;
    if (params.get("token")) return;
    const fromQuery = params.get("name") || params.get("child") || params.get("kid");
    const name = sanitizeKidName(fromQuery || consumeSantaNameHandoff());
    if (!name || !isLikelyKidName(name)) return;
    nameHandoffApplied.current = true;
    setDraft((prev) => {
      if (prev.orderId || prev.step === "progress" || prev.step === "result" || prev.step === "checkout") {
        return prev;
      }
      const merged = {
        ...prev,
        childFirstName: name,
        step: "form" as Step,
        lastError: null,
      };
      writeDraft(merged);
      return merged;
    });
  }, [params]);

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
          trackSanta("generation_success", santaAnalyticsDimensions({
            language: draft.language,
            templateKey: draft.templateKey,
          }), { orderId: draft.orderId });
          trackSanta("christmas_santa_generation_completed", undefined, { orderId: draft.orderId });
          return;
        }
        if (data.order?.fulfillment_status === "failed" || status === "failed") {
          patch({
            step: "error",
            lastError: data.order?.job?.error_message_safe || data.order?.last_error || "Generation failed",
          });
          trackSanta("generation_failed", undefined, { orderId: draft.orderId });
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

  useEffect(() => {
    if (draft.step !== "progress") return;
    const id = window.setInterval(() => setProgressTick((t) => t + 1), 4000);
    return () => window.clearInterval(id);
  }, [draft.step]);

  useEffect(() => {
    if (draft.step !== "preview" || previewTracked.current) return;
    previewTracked.current = true;
    trackSanta("christmas_santa_preview_viewed", santaAnalyticsDimensions({
      language: draft.language,
      templateKey: draft.templateKey,
      hasAge: Boolean(draft.age),
      hasWish: Boolean(draft.christmasWish),
      hasHobby: Boolean(draft.hobbyOrInterest) || Boolean(draft.customFact),
    }));
  }, [draft.step, draft.language, draft.templateKey, draft.age, draft.christmasWish, draft.hobbyOrInterest, draft.customFact]);

  const previewScript = useMemo(
    () =>
      buildSantaMessagePreview({
        childFirstName: draft.childFirstName || "friend",
        language: draft.language,
        age: draft.age ? Number(draft.age) : null,
        somethingGood: draft.somethingGood || null,
        hobbyOrInterest: draft.hobbyOrInterest || null,
        christmasWish: draft.christmasWish || null,
        customFact: draft.customFact || null,
        senderName: draft.senderName || null,
      }),
    [draft],
  );

  const mentions = useMemo(
    () =>
      santaMentionChecklist({
        childFirstName: draft.childFirstName || "friend",
        language: draft.language,
        age: draft.age ? Number(draft.age) : null,
        somethingGood: draft.somethingGood || null,
        hobbyOrInterest: draft.hobbyOrInterest || null,
        christmasWish: draft.christmasWish || null,
        customFact: draft.customFact || null,
      }),
    [draft],
  );

  const progress = santaFunnelProgress(draft.step, draft.nameFromHandoff || Boolean(draft.childFirstName && draft.step !== "name" && draft.step !== "recipient"));
  const nameKnown = Boolean(draft.childFirstName);
  const displayName = draft.childFirstName || "them";

  function validated(requireConsent = true): SantaPersonalization | null {
    const result = validateSantaPersonalization({
      childFirstName: draft.childFirstName,
      language: draft.language,
      age: draft.age ? Number(draft.age) : null,
      somethingGood: draft.somethingGood,
      hobbyOrInterest: draft.hobbyOrInterest,
      christmasWish: draft.christmasWish,
      customFact: draft.customFact,
      senderName: draft.senderName,
      templateKey: draft.templateKey || SANTA_V1_ENABLED_TEMPLATES[0],
      guardianConsent: requireConsent ? draft.guardianConsent : true,
    });
    if (!result.ok) {
      patch({ lastError: result.message });
      return null;
    }
    return result.value;
  }

  function startJourney() {
    trackSanta("christmas_santa_started");
    trackSanta("santa_form_started");
    if (draft.nameFromHandoff && draft.childFirstName) {
      patch({ step: "age", lastError: null });
      return;
    }
    if (draft.childFirstName) {
      patch({ step: "age", lastError: null });
      return;
    }
    patch({ step: "recipient", lastError: null });
  }

  function selectRecipient(type: SantaRecipientType) {
    patch({ recipientType: type, step: "name", lastError: null });
    trackSanta("christmas_santa_recipient_selected", { recipient_type: type });
  }

  function completeName() {
    const name = draft.childFirstName.trim();
    const check = validateSantaPersonalization({
      childFirstName: name,
      language: draft.language,
      guardianConsent: true,
    });
    if (!check.ok && check.code !== "consent_required") {
      patch({ lastError: check.message });
      return;
    }
    if (!name) {
      patch({ lastError: "Please enter a first name." });
      return;
    }
    patch({ childFirstName: name, step: "age", lastError: null });
    trackSanta("christmas_santa_name_completed");
  }

  function go(step: SantaUiStep) {
    patch({ step, lastError: null });
  }

  function completeAge() {
    if (draft.age) {
      const n = Number(draft.age);
      if (!Number.isFinite(n) || n < 1 || n > 17) {
        patch({ lastError: "Age must be between 1 and 17 if provided." });
        return;
      }
    }
    trackSanta("christmas_santa_age_completed", { has_age: Boolean(draft.age) });
    go("achievement");
  }

  function completeAchievement() {
    trackSanta("christmas_santa_achievement_completed", {
      has_achievement: Boolean(draft.somethingGood.trim()),
    });
    go("wish");
  }

  function completeWish() {
    trackSanta("christmas_santa_wish_completed", { has_wish: Boolean(draft.christmasWish.trim()) });
    go("detail");
  }

  function goPreview() {
    const v = validated(false);
    if (!v) return;
    trackSanta("santa_form_completed", santaAnalyticsDimensions({
      language: v.language,
      templateKey: v.templateKey,
      hasAge: v.age != null,
      hasWish: Boolean(v.christmasWish),
      hasHobby: Boolean(v.hobbyOrInterest) || Boolean(v.customFact),
    }));
    previewTracked.current = false;
    go("preview");
  }

  function goOffer() {
    if (!draft.guardianConsent) {
      patch({ lastError: "Parent/guardian permission is required." });
      return;
    }
    if (!validated(true)) return;
    go("offer");
    trackSanta("offer_seen", undefined, {
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
    const v = validated(true);
    if (!v) return;
    setBusy(true);
    trackSanta("checkout_started", undefined, { packageKey: SANTA_DEFAULT_PACKAGE });
    trackSanta("christmas_santa_checkout_started", undefined, { packageKey: SANTA_DEFAULT_PACKAGE });
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
      trackSanta("christmas_santa_generation_started", undefined, { orderId: result.orderId });
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
    trackSanta("download", undefined, { orderId: draft.orderId });
    const res = await fetch(resultUrl);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `tdg-santa-video-${draft.orderId.slice(0, 8)}.mp4`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  }

  async function onShare() {
    trackSanta("share", undefined, { orderId: draft.orderId });
    trackSanta("christmas_santa_shared", undefined, { orderId: draft.orderId });
    const shareUrl = draft.publicToken
      ? `${window.location.origin}${SANTA_ROUTE}?token=${encodeURIComponent(draft.publicToken)}`
      : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "A Christmas message from Santa",
          text: "Someone sent you a special Christmas message from Santa.",
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      patch({ lastError: null });
      alert("Link copied — share it privately with family.");
    } catch {
      /* user cancelled share */
    }
  }

  function resetAll() {
    const next = emptySantaDraft();
    writeSantaDraft(next);
    setDraft(next);
    setResultUrl(null);
    setCheckout(null);
    setJobStatus(null);
    previewTracked.current = false;
  }

  const showMarketing = draft.step === "landing";
  const inGuided =
    draft.step !== "landing" &&
    draft.step !== "checkout" &&
    draft.step !== "progress" &&
    draft.step !== "result" &&
    draft.step !== "error";

  const progressStageCopy = (() => {
    const stages = SANTA_COPY.steps.progress.stages;
    const idx = progressTick % stages.length;
    const stage = stages[idx];
    return typeof stage === "function" ? stage(displayName) : stage;
  })();

  return (
    <>
      <ChristmasPageHead
        path="/christmas/santa-video"
        image="https://www.thedigitalgifter.com/images/occasions/christmas.png"
      />

      <div className="santa-video-page relative min-h-screen overflow-x-hidden text-[#F5EDE0]">
        <ChristmasSnowfall />
        <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.14),_transparent_55%),linear-gradient(165deg,#0c1f18_0%,#132a22_40%,#1a0a10_100%)]" />

        <div className="relative z-[3]">
          <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
            <Link to="/christmas" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]">
              <img
                src="/TheDigitalGifter.png"
                alt="The Digital Gifter"
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover ring-1 ring-[#d4af37]/40"
              />
              <span className="santa-display text-lg font-semibold tracking-tight">{SANTA_COPY.brand}</span>
            </Link>
            <nav aria-label="Breadcrumb" className="text-xs text-[#F5EDE0]/55">
              <ol className="flex items-center gap-2">
                <li>
                  <Link className="hover:text-[#F5EDE0]" to="/christmas">
                    Christmas
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-[#F5EDE0]/80">Santa Video</li>
              </ol>
            </nav>
          </header>

          <main>
            {draft.lastError ? (
              <p
                role="alert"
                className="mx-auto mb-4 max-w-5xl rounded-lg border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm text-red-100"
              >
                {draft.lastError}
              </p>
            ) : null}

            {draft.step === "landing" && (
              <section className="mx-auto grid max-w-5xl gap-8 px-4 pb-10 pt-2 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                    Christmas · Santa Video
                  </p>
                  <h1 className="santa-display mt-3 text-[2.35rem] font-semibold leading-[1.05] tracking-tight text-[#F5EDE0] sm:text-5xl">
                    {draft.nameFromHandoff && draft.childFirstName
                      ? SANTA_COPY.hero.handoffHeadline(draft.childFirstName)
                      : SANTA_COPY.hero.h1}
                  </h1>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-[#F5EDE0]/75 sm:text-lg">
                    {draft.nameFromHandoff && draft.childFirstName
                      ? SANTA_COPY.hero.handoffSupport(draft.childFirstName)
                      : SANTA_COPY.hero.support}
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#d4af37] px-6 text-sm font-semibold text-[#1a1208] transition hover:bg-[#e0c05a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5EDE0]"
                      onClick={startJourney}
                    >
                      {draft.nameFromHandoff && draft.childFirstName
                        ? SANTA_COPY.hero.ctaPrefill(draft.childFirstName)
                        : SANTA_COPY.hero.ctaDirect}
                    </button>
                    <a
                      href="#santa-examples-heading"
                      className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#F5EDE0]/25 px-5 text-sm font-medium text-[#F5EDE0]/85 hover:border-[#F5EDE0]/50"
                    >
                      See examples
                    </a>
                  </div>
                  <p className="mt-4 text-sm text-[#F5EDE0]/55">
                    About one minute to personalize · English & Romanian
                  </p>
                </div>
                <div className="overflow-hidden rounded-3xl border border-[#d4af37]/20 shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
                  <SantaWorkshopScene accentName={draft.childFirstName || undefined} />
                  <div className="border-t border-[#d4af37]/15 bg-[#0c1814]/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-[#d4af37]">Example</p>
                    <p className="mt-2 text-sm leading-relaxed text-[#F5EDE0]/85">
                      “Ho ho ho, Emma! I heard you’ve been doing an amazing job at school this year…”
                    </p>
                  </div>
                </div>
              </section>
            )}

            {inGuided && (
              <section className="mx-auto max-w-xl px-4 pb-12 pt-2 sm:px-6">
                {progress ? (
                  <p className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-[#d4af37]/90">
                    {progressLabel(progress.current, progress.total)}
                  </p>
                ) : null}

                <div className="mb-6 overflow-hidden rounded-2xl border border-[#d4af37]/15">
                  <SantaWorkshopScene compact accentName={nameKnown ? draft.childFirstName : undefined} />
                </div>

                {draft.step === "recipient" && (
                  <StepShell title={SANTA_COPY.steps.recipient.title}>
                    <div className="grid gap-3">
                      {SANTA_COPY.steps.recipient.options.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className="min-h-12 rounded-xl border border-[#F5EDE0]/20 bg-[#0c1814]/50 px-4 text-left text-sm font-medium hover:border-[#d4af37]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                          onClick={() => selectRecipient(opt.id)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </StepShell>
                )}

                {draft.step === "name" && (
                  <StepShell title={SANTA_COPY.steps.name.title} helper={SANTA_COPY.steps.name.helper}>
                    <label className="block text-sm">
                      <span className="sr-only">First name</span>
                      <input
                        className="santa-input mt-1 w-full"
                        value={draft.childFirstName}
                        onChange={(e) => patch({ childFirstName: e.target.value })}
                        placeholder={SANTA_COPY.steps.name.placeholder}
                        maxLength={40}
                        autoComplete="off"
                        autoCapitalize="words"
                        enterKeyHint="done"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") completeName();
                        }}
                      />
                    </label>
                    <PrimaryButton onClick={completeName}>{SANTA_COPY.steps.name.cta}</PrimaryButton>
                    <BackButton onClick={() => go("recipient")} />
                  </StepShell>
                )}

                {draft.step === "age" && (
                  <StepShell
                    title={SANTA_COPY.steps.age.title(displayName)}
                    helper={SANTA_COPY.steps.age.helper}
                  >
                    <label className="block text-sm">
                      <span className="sr-only">Age</span>
                      <input
                        className="santa-input mt-1 w-full"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={17}
                        value={draft.age}
                        onChange={(e) => patch({ age: e.target.value })}
                      />
                    </label>
                    <PrimaryButton onClick={completeAge}>{SANTA_COPY.steps.age.cta}</PrimaryButton>
                    <SecondaryButton
                      onClick={() => {
                        patch({ age: "" });
                        trackSanta("christmas_santa_age_completed", { has_age: false });
                        go("achievement");
                      }}
                    >
                      {SANTA_COPY.steps.age.skip}
                    </SecondaryButton>
                    <BackButton
                      onClick={() => go(draft.nameFromHandoff ? "landing" : "name")}
                    />
                  </StepShell>
                )}

                {draft.step === "achievement" && (
                  <StepShell title={SANTA_COPY.steps.achievement.title(displayName)}>
                    <div className="flex flex-wrap gap-2">
                      {SANTA_COPY.steps.achievement.chips.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          className="rounded-full border border-[#F5EDE0]/20 px-3 py-1.5 text-xs text-[#F5EDE0]/85 hover:border-[#d4af37]/50"
                          onClick={() => patch({ somethingGood: chip })}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                    <label className="mt-4 block text-sm">
                      <span className="sr-only">Something they did well</span>
                      <textarea
                        className="santa-input mt-1 min-h-[96px] w-full resize-y"
                        value={draft.somethingGood}
                        onChange={(e) => patch({ somethingGood: e.target.value })}
                        placeholder={SANTA_COPY.steps.achievement.placeholder}
                        maxLength={120}
                      />
                    </label>
                    <PrimaryButton onClick={completeAchievement}>
                      {SANTA_COPY.steps.achievement.cta}
                    </PrimaryButton>
                    <BackButton onClick={() => go("age")} />
                  </StepShell>
                )}

                {draft.step === "wish" && (
                  <StepShell
                    title={SANTA_COPY.steps.wish.title(displayName)}
                    helper={SANTA_COPY.steps.wish.helper}
                  >
                    <label className="block text-sm">
                      <span className="sr-only">Christmas wish</span>
                      <input
                        className="santa-input mt-1 w-full"
                        value={draft.christmasWish}
                        onChange={(e) => patch({ christmasWish: e.target.value })}
                        placeholder={SANTA_COPY.steps.wish.placeholder}
                        maxLength={120}
                      />
                    </label>
                    <PrimaryButton onClick={completeWish}>{SANTA_COPY.steps.wish.cta}</PrimaryButton>
                    <SecondaryButton
                      onClick={() => {
                        patch({ christmasWish: "" });
                        trackSanta("christmas_santa_wish_completed", { has_wish: false });
                        go("detail");
                      }}
                    >
                      {SANTA_COPY.steps.wish.skip}
                    </SecondaryButton>
                    <BackButton onClick={() => go("achievement")} />
                  </StepShell>
                )}

                {draft.step === "detail" && (
                  <StepShell title={SANTA_COPY.steps.detail.title} helper={SANTA_COPY.steps.detail.helper}>
                    <label className="block text-sm">
                      <span className="sr-only">Special detail</span>
                      <input
                        className="santa-input mt-1 w-full"
                        value={draft.customFact}
                        onChange={(e) => patch({ customFact: e.target.value })}
                        placeholder={SANTA_COPY.steps.detail.placeholder}
                        maxLength={120}
                      />
                    </label>
                    <PrimaryButton onClick={() => go("language")}>{SANTA_COPY.steps.detail.cta}</PrimaryButton>
                    <SecondaryButton
                      onClick={() => {
                        patch({ customFact: "" });
                        go("language");
                      }}
                    >
                      {SANTA_COPY.steps.detail.skip}
                    </SecondaryButton>
                    <BackButton onClick={() => go("wish")} />
                  </StepShell>
                )}

                {draft.step === "language" && (
                  <StepShell title={SANTA_COPY.steps.language.title} helper={SANTA_COPY.steps.language.helper}>
                    <fieldset className="space-y-3">
                      <legend className="sr-only">Language</legend>
                      {(
                        [
                          { id: "en", label: "English", available: true },
                          { id: "ro", label: "Romanian", available: true },
                          { id: "de", label: "German", available: false },
                          { id: "fr", label: "French", available: false },
                          { id: "es", label: "Spanish", available: false },
                        ] as const
                      ).map((lang) => (
                        <label
                          key={lang.id}
                          className={`flex min-h-12 items-center justify-between rounded-xl border px-4 ${
                            lang.available
                              ? "cursor-pointer border-[#F5EDE0]/20 hover:border-[#d4af37]/50"
                              : "cursor-not-allowed border-[#F5EDE0]/10 opacity-45"
                          }`}
                        >
                          <span className="flex items-center gap-3 text-sm">
                            <input
                              type="radio"
                              name="santa-language"
                              disabled={!lang.available}
                              checked={draft.language === lang.id}
                              onChange={() => {
                                if (lang.id === "en" || lang.id === "ro") {
                                  patch({ language: lang.id });
                                }
                              }}
                            />
                            {lang.label}
                          </span>
                          {!lang.available ? (
                            <span className="text-[11px] uppercase tracking-wide text-[#F5EDE0]/45">
                              Coming soon
                            </span>
                          ) : null}
                        </label>
                      ))}
                    </fieldset>
                    <p className="mt-4 text-xs text-[#F5EDE0]/55">
                      Santa style: Classic Santa · Voice: Warm
                    </p>
                    <PrimaryButton onClick={goPreview}>{SANTA_COPY.steps.language.cta}</PrimaryButton>
                    <BackButton onClick={() => go("detail")} />
                  </StepShell>
                )}

                {draft.step === "preview" && (
                  <StepShell
                    eyebrow={SANTA_COPY.steps.preview.eyebrow}
                    title={SANTA_COPY.steps.preview.title(displayName)}
                  >
                    <blockquote className="whitespace-pre-wrap rounded-2xl border border-[#d4af37]/25 bg-[#0c1814]/55 p-4 text-sm leading-relaxed text-[#F5EDE0]/9">
                      {previewScript}
                    </blockquote>
                    <p className="mt-2 text-xs text-[#F5EDE0]/45">
                      Preview only — the final spoken video may vary slightly.
                    </p>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <SecondaryButton onClick={() => go("achievement")}>
                        {SANTA_COPY.steps.preview.change}
                      </SecondaryButton>
                      <PrimaryButton onClick={() => go("confirm")}>
                        {SANTA_COPY.steps.preview.perfect}
                      </PrimaryButton>
                    </div>
                    <BackButton onClick={() => go("language")} />
                  </StepShell>
                )}

                {draft.step === "confirm" && (
                  <StepShell title={SANTA_COPY.steps.preview.title(displayName)}>
                    <p className="text-sm font-medium text-[#d4af37]">
                      {SANTA_COPY.steps.preview.mentionsTitle}
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-[#F5EDE0]/85">
                      {mentions.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span aria-hidden="true" className="text-[#d4af37]">
                            ✓
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-sm text-[#F5EDE0]/65">
                      Language: {draft.language === "ro" ? "Romanian" : "English"} · Classic Santa · Warm voice
                    </p>
                    <label className="mt-5 flex items-start gap-3 text-sm text-[#F5EDE0]/85">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={draft.guardianConsent}
                        onChange={(e) => patch({ guardianConsent: e.target.checked })}
                      />
                      <span>{SANTA_CONSENT_LABEL}</span>
                    </label>
                    <PrimaryButton onClick={goOffer}>
                      {SANTA_COPY.steps.preview.cta(displayName)}
                    </PrimaryButton>
                    <BackButton onClick={() => go("preview")} />
                  </StepShell>
                )}

                {draft.step === "offer" && (
                  <StepShell title={SANTA_COPY.steps.offer.title}>
                    <ul className="space-y-2 text-sm text-[#F5EDE0]/8">
                      {SANTA_COPY.steps.offer.included.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-[#d4af37]" aria-hidden="true">
                            ✓
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <label className="mt-5 block text-sm">
                      {SANTA_COPY.steps.offer.emailLabel}
                      <input
                        className="santa-input mt-1 w-full"
                        type="email"
                        value={draft.email}
                        onChange={(e) => patch({ email: e.target.value })}
                        autoComplete="email"
                      />
                    </label>
                    <p className="mt-3 text-xs leading-relaxed text-[#F5EDE0]/5">
                      {SANTA_COPY.steps.offer.consentNote}
                    </p>
                    {purchasable && pkg ? (
                      <PrimaryButton disabled={busy} onClick={() => void startCheckout()}>
                        {busy ? "Preparing checkout…" : SANTA_COPY.steps.offer.ctaPay}
                      </PrimaryButton>
                    ) : (
                      <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
                        {SANTA_COPY.steps.offer.checkoutSoon}
                        {product ? ` · Status: ${ctaStateForProduct(product)}` : null}
                      </p>
                    )}
                    <BackButton onClick={() => go("confirm")} />
                  </StepShell>
                )}
              </section>
            )}

            {draft.step === "checkout" && checkout && (
              <section className="mx-auto max-w-xl px-4 py-8 sm:px-6">
                <h2 className="santa-display text-3xl">Secure payment</h2>
                <div className="mt-6 rounded-2xl border border-[#F5EDE0]/15 bg-[#F5EDE0] p-4 text-slate-900">
                  <CustomStripeCheckout
                    clientSecret={checkout.clientSecret}
                    publishableKey={checkout.publishableKey}
                    dueDisplay={`$${(checkout.amountCents / 100).toFixed(2)}`}
                    returnUrl={`${window.location.origin}${SANTA_ROUTE}?checkout=success&token=${encodeURIComponent(draft.publicToken || "")}`}
                    email={draft.email}
                  />
                </div>
              </section>
            )}

            {draft.step === "progress" && (
              <section className="mx-auto max-w-xl px-4 py-10 text-center sm:px-6">
                <div className="overflow-hidden rounded-2xl border border-[#d4af37]/20">
                  <SantaWorkshopScene compact accentName={displayName} />
                </div>
                <h2 className="santa-display mt-6 text-3xl">
                  {SANTA_COPY.steps.progress.title(displayName)}
                </h2>
                <p className="mt-4 text-base text-[#F5EDE0]/8" aria-live="polite">
                  {progressStageCopy}
                </p>
                <p className="mt-2 text-sm text-[#F5EDE0]/55">{santaProgressCopy(jobStatus || "queued")}</p>
                <p className="mt-6 text-xs text-[#F5EDE0]/45">
                  This can take several minutes. You can close this page and reopen your order link later.
                </p>
              </section>
            )}

            {draft.step === "result" && resultUrl && (
              <section className="mx-auto max-w-xl px-4 py-8 sm:px-6">
                <h2 className="santa-display text-3xl">
                  {SANTA_COPY.steps.result.title(displayName)}
                </h2>
                <video
                  src={resultUrl}
                  controls
                  playsInline
                  className="mt-6 aspect-video w-full rounded-2xl bg-black"
                />
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <PrimaryButton onClick={() => void onDownload()}>
                    {SANTA_COPY.steps.result.download}
                  </PrimaryButton>
                  <SecondaryButton onClick={() => void onShare()}>
                    {SANTA_COPY.steps.result.share}
                  </SecondaryButton>
                </div>
                <SecondaryButton onClick={resetAll}>{SANTA_COPY.steps.result.another}</SecondaryButton>
                <div className="mt-8 space-y-2 border-t border-[#F5EDE0]/10 pt-6 text-sm">
                  <p className="text-[#F5EDE0]/55">More Christmas magic</p>
                  <Link className="block text-[#d4af37] hover:underline" to="/christmas/cards">
                    {SANTA_COPY.steps.result.crossSellCard}
                  </Link>
                  <Link className="block text-[#d4af37] hover:underline" to="/christmas/tree">
                    {SANTA_COPY.steps.result.crossSellTree}
                  </Link>
                  <Link className="block text-[#d4af37] hover:underline" to="/christmas/photo-generator">
                    {SANTA_COPY.steps.result.crossSellPortrait}
                  </Link>
                </div>
              </section>
            )}

            {draft.step === "error" && (
              <section className="mx-auto max-w-xl px-4 py-10 sm:px-6">
                <h2 className="santa-display text-3xl">Something went wrong</h2>
                <p className="mt-3 text-sm text-[#F5EDE0]/7">
                  If you already paid, keep your order link — support can retry without charging again.
                </p>
                <Link className="mt-6 inline-block text-[#d4af37] hover:underline" to="/christmas">
                  Christmas hub
                </Link>
              </section>
            )}

            {showMarketing ? (
              <>
                <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:hidden">
                  <SantaDemoPlayer example={SANTA_DEMO_EXAMPLES[0]} featured />
                </div>
                <SantaLandingSections />
              </>
            ) : (
              <div className="border-t border-[#F5EDE0]/10">
                <SantaLandingSections />
              </div>
            )}
          </main>
        </div>

        <style>{`
          .santa-video-page {
            --santa-display: "Cormorant Garamond", "Times New Roman", serif;
            --santa-body: "Source Sans 3", "Segoe UI", sans-serif;
            font-family: var(--santa-body);
          }
          .santa-display, .santa-video-page h1, .santa-video-page h2, .santa-video-page h3 {
            font-family: var(--santa-display);
          }
          .santa-input {
            border-radius: 0.75rem;
            border: 1px solid rgba(245, 237, 224, 0.22);
            background: rgba(12, 24, 20, 0.65);
            color: #F5EDE0;
            padding: 0.75rem 0.9rem;
          }
          .santa-input:focus {
            outline: none;
            border-color: #d4af37;
            box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.25);
          }
          .santa-input::placeholder {
            color: rgba(245, 237, 224, 0.4);
          }
        `}</style>
      </div>
    </>
  );
}

function StepShell({
  title,
  helper,
  eyebrow,
  children,
}: {
  title: string;
  helper?: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">{eyebrow}</p>
      ) : null}
      <h2 className="santa-display text-2xl text-[#F5EDE0] sm:text-3xl">{title}</h2>
      {helper ? <p className="mt-2 text-sm text-[#F5EDE0]/65">{helper}</p> : null}
      <div className="mt-5 space-y-3">{children}</div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#d4af37] px-5 text-sm font-semibold text-[#1a1208] transition hover:bg-[#e0c05a] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5EDE0]"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#F5EDE0]/25 px-5 text-sm font-medium text-[#F5EDE0]/9 hover:border-[#F5EDE0]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
    >
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-[#F5EDE0]/55 underline-offset-2 hover:text-[#F5EDE0] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
    >
      Back
    </button>
  );
}
