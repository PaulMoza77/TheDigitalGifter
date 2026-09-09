import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { captureFunnelAttribution, attributionParamsForInternal } from "@/features/pet/funnelAttribution";
import { ChristmasSnowfall } from "@/features/christmas-v2/ChristmasSnowfall";
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
  type SantaLanguage,
  type SantaPersonalization,
} from "./santa/santaTypes";
import { SANTA_COPY, progressLabel } from "./santa/santaCopy";
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
import { santaGreetingCaption, santaReactionForDraft } from "./santa/santaReactions";
import { SantaWorkshopHero } from "./santa/SantaWorkshopHero";
import { SantaLandingSections } from "./santa/SantaLandingSections";
import "./santa/SantaVideo.css";

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
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Source+Sans+3:wght@400;500;600;700&display=swap";
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

const QUESTION_STEPS: SantaUiStep[] = ["name", "age", "achievement", "interest", "wish", "sender"];

export default function ChristmasSantaVideoPage() {
  const [params] = useSearchParams();
  const [draft, setDraft] = useState<SantaDraft>(() => readSantaDraft());
  const [busy, setBusy] = useState(false);
  const [jobStatus, setJobStatus] = useState<SantaJobStatus | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [progressTick, setProgressTick] = useState(0);
  const [showCustomAchievement, setShowCustomAchievement] = useState(false);
  const [showCustomInterest, setShowCustomInterest] = useState(false);
  const [showCustomSender, setShowCustomSender] = useState(false);
  const [checkout, setCheckout] = useState<{
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
  } | null>(null);
  const pageViewed = useRef(false);
  const handoffApplied = useRef(false);
  const startedTracked = useRef(false);
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
    document.body.classList.add("sv-immersive");
    return () => document.body.classList.remove("sv-immersive");
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

  // Homepage / query name handoff — skip asking for the name again; jump to age
  useEffect(() => {
    if (handoffApplied.current) return;
    if (params.get("token")) return;
    const incoming = resolveIncomingSantaName(params);
    if (!incoming) {
      handoffApplied.current = true;
      // Direct visitors without a name start on the name question inside the immersive shell
      const current = readSantaDraft();
      if (
        !current.childFirstName &&
        (current.step === "landing" || current.step === "recipient")
      ) {
        patch({ step: "name" });
      }
      return;
    }
    handoffApplied.current = true;
    const current = readSantaDraft();
    if (current.orderId || current.step === "progress" || current.step === "result" || current.step === "checkout") {
      return;
    }
    if (
      current.childFirstName &&
      current.step !== "landing" &&
      current.step !== "name" &&
      current.step !== "recipient"
    ) {
      return;
    }
    patch({
      childFirstName: incoming.firstName,
      nameFromHandoff: true,
      recipientType: "child",
      step: "age",
    });
    if (!startedTracked.current) {
      startedTracked.current = true;
      trackSanta("christmas_santa_started");
      trackSanta("santa_form_started");
    }
  }, [params, patch]);

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
          trackSanta(
            "generation_success",
            santaAnalyticsDimensions({
              language: draft.language,
              templateKey: draft.templateKey,
            }),
            { orderId: draft.orderId },
          );
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
    trackSanta(
      "christmas_santa_preview_viewed",
      santaAnalyticsDimensions({
        language: draft.language,
        templateKey: draft.templateKey,
        hasAge: Boolean(draft.age),
        hasWish: Boolean(draft.christmasWish),
        hasHobby: Boolean(draft.hobbyOrInterest) || Boolean(draft.customFact),
      }),
    );
  }, [
    draft.step,
    draft.language,
    draft.templateKey,
    draft.age,
    draft.christmasWish,
    draft.hobbyOrInterest,
    draft.customFact,
  ]);

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
        senderName: draft.senderName || null,
      }),
    [draft],
  );

  const nameKnown = Boolean(draft.childFirstName) || draft.nameFromHandoff;
  const progress = santaFunnelProgress(draft.step, nameKnown && draft.step !== "name");
  const displayName = draft.childFirstName || "them";

  const caption = useMemo(() => {
    if (!draft.childFirstName) return santaGreetingCaption(null);
    return santaReactionForDraft({
      step: draft.step,
      childFirstName: draft.childFirstName,
      age: draft.age,
      somethingGood: draft.somethingGood,
      hobbyOrInterest: draft.hobbyOrInterest,
      christmasWish: draft.christmasWish,
      senderName: draft.senderName,
    });
  }, [draft]);

  function markStarted() {
    if (startedTracked.current) return;
    startedTracked.current = true;
    trackSanta("christmas_santa_started");
    trackSanta("santa_form_started");
  }

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

  function go(step: SantaUiStep) {
    patch({ step, lastError: null });
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
    markStarted();
    patch({ childFirstName: name, step: "age", lastError: null });
    trackSanta("christmas_santa_name_completed");
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
    go("interest");
  }

  function completeInterest() {
    go("wish");
  }

  function completeWish() {
    trackSanta("christmas_santa_wish_completed", { has_wish: Boolean(draft.christmasWish.trim()) });
    go("sender");
  }

  function goPreview() {
    const v = validated(false);
    if (!v) return;
    trackSanta(
      "santa_form_completed",
      santaAnalyticsDimensions({
        language: v.language,
        templateKey: v.templateKey,
        hasAge: v.age != null,
        hasWish: Boolean(v.christmasWish),
        hasHobby: Boolean(v.hobbyOrInterest) || Boolean(v.customFact),
      }),
    );
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
    startedTracked.current = false;
    setShowCustomAchievement(false);
    setShowCustomInterest(false);
    setShowCustomSender(false);
  }

  const inCreator = QUESTION_STEPS.includes(draft.step) || draft.step === "preview" || draft.step === "confirm" || draft.step === "offer";
  const showMarketingBelow = true;

  const progressStageCopy = (() => {
    const stages = SANTA_COPY.steps.progress.stages;
    const idx = progressTick % stages.length;
    const stage = stages[idx];
    return typeof stage === "function" ? stage(displayName) : stage;
  })();

  const headline = draft.childFirstName
    ? SANTA_COPY.hero.handoffHeadline(draft.childFirstName)
    : SANTA_COPY.hero.h1Alt;
  const support = draft.childFirstName
    ? SANTA_COPY.hero.handoffSupport(draft.childFirstName)
    : SANTA_COPY.hero.support;

  return (
    <>
      <PageHead
        title={SANTA_COPY.seo.title}
        description={SANTA_COPY.seo.description}
        exactTitle
        url={SANTA_COPY.seo.canonical}
        image="https://www.thedigitalgifter.com/images/occasions/christmas.png"
      />

      <div className="santa-video-page sv-page">
        <div className="sv-page__bg" aria-hidden="true" />
        <div className="sv-page__snow" aria-hidden="true">
          <ChristmasSnowfall />
        </div>

        <div className="sv-shell">
          <header className="sv-header">
            <Link to="/christmas" className="sv-brand">
              <img src="/TheDigitalGifter.png" alt="" width={36} height={36} />
              <span className="sv-brand__name">{SANTA_COPY.brand}</span>
            </Link>
            <nav className="sv-nav" aria-label="Christmas">
              <Link to="/christmas">Christmas</Link>
              <Link to="/christmas/gift-finder">Gift Finder</Link>
              <Link to="/christmas/cards">Cards</Link>
            </nav>
            <div className="sv-header__right">
              <label className="sv-lang">
                <span>{SANTA_COPY.language.label}</span>
                <select
                  aria-label="Santa speaks"
                  value={draft.language}
                  onChange={(e) => patch({ language: e.target.value as SantaLanguage })}
                >
                  <option value="en">{SANTA_COPY.language.en}</option>
                  <option value="ro">{SANTA_COPY.language.ro}</option>
                </select>
              </label>
            </div>
          </header>

          <main>
            {draft.lastError ? (
              <p role="alert" className="sv-alert">
                {draft.lastError}
              </p>
            ) : null}

            {/* Static SEO H1 — personalized headline is visual when name is known */}
            <h1 className="sr-only">{SANTA_COPY.hero.h1}</h1>

            {inCreator && (
              <section className="sv-creator" aria-label="Create a Santa video">
                <div className="sv-creator__grid">
                  <SantaWorkshopHero
                    childName={draft.childFirstName || undefined}
                    caption={caption}
                  />

                  <div className="sv-panel">
                    <p className="sv-kicker">{SANTA_COPY.hero.kicker}</p>
                    <p className="sv-headline" aria-live="polite">
                      {draft.childFirstName ? (
                        <>
                          Santa already knows <em>{draft.childFirstName}</em>.
                        </>
                      ) : (
                        headline
                      )}
                    </p>
                    <p className="sv-support">{support}</p>

                    <div className="sv-parchment">
                      {progress ? (
                        <div className="sv-progress">
                          <span className="sv-progress__label">
                            {progressLabel(progress.current, progress.total)}
                          </span>
                          <div className="sv-dots" aria-hidden="true">
                            {Array.from({ length: progress.total }).map((_, i) => (
                              <span
                                key={i}
                                className={`sv-dot${i < progress.current ? " sv-dot--on" : ""}`}
                              />
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {draft.step === "name" && (
                        <StepBody
                          title={SANTA_COPY.steps.name.title}
                          helper={SANTA_COPY.steps.name.helper}
                        >
                          <label className="sv-field">
                            <span className="sr-only">First name</span>
                            <input
                              className="sv-input"
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
                          <div className="sv-actions">
                            <PrimaryButton onClick={completeName}>
                              {SANTA_COPY.steps.name.cta}
                            </PrimaryButton>
                          </div>
                        </StepBody>
                      )}

                      {draft.step === "age" && (
                        <StepBody
                          title={SANTA_COPY.steps.age.title(displayName)}
                          helper={SANTA_COPY.steps.age.helper}
                        >
                          <div className="sv-field sv-age-row">
                            <input
                              className="sv-input"
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={17}
                              value={draft.age}
                              onChange={(e) => patch({ age: e.target.value })}
                              aria-label="Age"
                            />
                            <span className="sv-age-unit">{SANTA_COPY.steps.age.unit}</span>
                          </div>
                          <div className="sv-actions">
                            <PrimaryButton onClick={completeAge}>
                              {SANTA_COPY.steps.age.cta} →
                            </PrimaryButton>
                            <GhostButton
                              onClick={() => {
                                patch({ age: "" });
                                trackSanta("christmas_santa_age_completed", { has_age: false });
                                go("achievement");
                              }}
                            >
                              {SANTA_COPY.steps.age.skip}
                            </GhostButton>
                            {!draft.nameFromHandoff ? (
                              <BackButton onClick={() => go("name")} />
                            ) : null}
                          </div>
                        </StepBody>
                      )}

                      {draft.step === "achievement" && (
                        <StepBody title={SANTA_COPY.steps.achievement.title(displayName)}>
                          <div className="sv-chips">
                            {SANTA_COPY.steps.achievement.chips.map((chip) => (
                              <button
                                key={chip.value}
                                type="button"
                                className={`sv-chip${draft.somethingGood === chip.value ? " sv-chip--on" : ""}`}
                                onClick={() => {
                                  setShowCustomAchievement(false);
                                  patch({ somethingGood: chip.value });
                                }}
                              >
                                {chip.label}
                              </button>
                            ))}
                            <button
                              type="button"
                              className={`sv-chip${showCustomAchievement ? " sv-chip--on" : ""}`}
                              onClick={() => setShowCustomAchievement(true)}
                            >
                              {SANTA_COPY.steps.achievement.somethingElse}
                            </button>
                          </div>
                          {showCustomAchievement ||
                          (draft.somethingGood &&
                            !SANTA_COPY.steps.achievement.chips.some((c) => c.value === draft.somethingGood)) ? (
                            <label className="sv-field">
                              <span className="sr-only">Something they did well</span>
                              <textarea
                                className="sv-textarea"
                                value={draft.somethingGood}
                                onChange={(e) => patch({ somethingGood: e.target.value })}
                                placeholder={SANTA_COPY.steps.achievement.placeholder}
                                maxLength={120}
                                rows={3}
                              />
                            </label>
                          ) : null}
                          <div className="sv-actions">
                            <PrimaryButton onClick={completeAchievement}>
                              {SANTA_COPY.steps.achievement.cta} →
                            </PrimaryButton>
                            <BackButton onClick={() => go("age")} />
                          </div>
                        </StepBody>
                      )}

                      {draft.step === "interest" && (
                        <StepBody title={SANTA_COPY.steps.interest.title(displayName)}>
                          <div className="sv-chips">
                            {SANTA_COPY.steps.interest.chips.map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                className={`sv-chip${draft.hobbyOrInterest === chip ? " sv-chip--on" : ""}`}
                                onClick={() => {
                                  setShowCustomInterest(false);
                                  patch({ hobbyOrInterest: chip });
                                }}
                              >
                                {chip}
                              </button>
                            ))}
                            <button
                              type="button"
                              className={`sv-chip${showCustomInterest ? " sv-chip--on" : ""}`}
                              onClick={() => setShowCustomInterest(true)}
                            >
                              {SANTA_COPY.steps.interest.somethingElse}
                            </button>
                          </div>
                          {showCustomInterest ||
                          (draft.hobbyOrInterest &&
                            !(SANTA_COPY.steps.interest.chips as readonly string[]).includes(
                              draft.hobbyOrInterest,
                            )) ? (
                            <label className="sv-field">
                              <span className="sr-only">Hobby or interest</span>
                              <input
                                className="sv-input"
                                value={draft.hobbyOrInterest}
                                onChange={(e) => patch({ hobbyOrInterest: e.target.value })}
                                placeholder={SANTA_COPY.steps.interest.placeholder}
                                maxLength={80}
                              />
                            </label>
                          ) : null}
                          <div className="sv-actions">
                            <PrimaryButton onClick={completeInterest}>
                              {SANTA_COPY.steps.interest.cta} →
                            </PrimaryButton>
                            <GhostButton
                              onClick={() => {
                                patch({ hobbyOrInterest: "" });
                                go("wish");
                              }}
                            >
                              {SANTA_COPY.steps.interest.skip}
                            </GhostButton>
                            <BackButton onClick={() => go("achievement")} />
                          </div>
                        </StepBody>
                      )}

                      {draft.step === "wish" && (
                        <StepBody
                          title={SANTA_COPY.steps.wish.title(displayName)}
                          helper={SANTA_COPY.steps.wish.helper}
                        >
                          <label className="sv-field">
                            <span className="sr-only">Christmas wish</span>
                            <input
                              className="sv-input"
                              value={draft.christmasWish}
                              onChange={(e) => patch({ christmasWish: e.target.value })}
                              placeholder={SANTA_COPY.steps.wish.placeholder}
                              maxLength={120}
                            />
                          </label>
                          <div className="sv-actions">
                            <PrimaryButton onClick={completeWish}>
                              {SANTA_COPY.steps.wish.cta} →
                            </PrimaryButton>
                            <GhostButton
                              onClick={() => {
                                patch({ christmasWish: "" });
                                trackSanta("christmas_santa_wish_completed", { has_wish: false });
                                go("sender");
                              }}
                            >
                              {SANTA_COPY.steps.wish.skip}
                            </GhostButton>
                            <BackButton onClick={() => go("interest")} />
                          </div>
                        </StepBody>
                      )}

                      {draft.step === "sender" && (
                        <StepBody title={SANTA_COPY.steps.sender.title}>
                          <div className="sv-chips">
                            {SANTA_COPY.steps.sender.chips.map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                className={`sv-chip${draft.senderName === chip ? " sv-chip--on" : ""}`}
                                onClick={() => {
                                  setShowCustomSender(false);
                                  patch({ senderName: chip });
                                }}
                              >
                                {chip}
                              </button>
                            ))}
                            <button
                              type="button"
                              className={`sv-chip${showCustomSender ? " sv-chip--on" : ""}`}
                              onClick={() => setShowCustomSender(true)}
                            >
                              {SANTA_COPY.steps.sender.somethingElse}
                            </button>
                          </div>
                          {showCustomSender ||
                          (draft.senderName &&
                            !(SANTA_COPY.steps.sender.chips as readonly string[]).includes(
                              draft.senderName,
                            )) ? (
                            <label className="sv-field">
                              <span className="sr-only">From whom</span>
                              <input
                                className="sv-input"
                                value={draft.senderName}
                                onChange={(e) => patch({ senderName: e.target.value })}
                                placeholder={SANTA_COPY.steps.sender.placeholder}
                                maxLength={60}
                              />
                            </label>
                          ) : null}
                          <p className="sv-helper" style={{ marginTop: "0.75rem" }}>
                            Santa style: Classic Santa
                          </p>
                          <div className="sv-actions">
                            <PrimaryButton onClick={goPreview}>
                              {SANTA_COPY.steps.sender.cta} →
                            </PrimaryButton>
                            <GhostButton
                              onClick={() => {
                                patch({ senderName: "" });
                                goPreview();
                              }}
                            >
                              {SANTA_COPY.steps.sender.skip}
                            </GhostButton>
                            <BackButton onClick={() => go("wish")} />
                          </div>
                        </StepBody>
                      )}

                      {draft.step === "preview" && (
                        <StepBody
                          eyebrow={SANTA_COPY.steps.preview.eyebrow}
                          title={SANTA_COPY.steps.preview.title(displayName)}
                        >
                          <blockquote className="sv-preview">{previewScript}</blockquote>
                          <p className="sv-helper">{SANTA_COPY.steps.preview.note}</p>
                          <div className="sv-actions">
                            <PrimaryButton onClick={() => go("confirm")}>
                              {SANTA_COPY.steps.preview.perfect} →
                            </PrimaryButton>
                            <GhostButton onClick={() => go("achievement")}>
                              {SANTA_COPY.steps.preview.change}
                            </GhostButton>
                            <BackButton onClick={() => go("sender")} />
                          </div>
                        </StepBody>
                      )}

                      {draft.step === "confirm" && (
                        <StepBody title={SANTA_COPY.steps.preview.title(displayName)}>
                          <p className="sv-helper" style={{ fontWeight: 700, color: "rgba(42,24,16,0.75)" }}>
                            {SANTA_COPY.steps.preview.mentionsTitle}
                          </p>
                          <ul className="sv-mentions">
                            {mentions.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                          <p className="sv-helper" style={{ marginTop: "0.75rem" }}>
                            Language: {draft.language === "ro" ? "Romanian" : "English"} · Classic Santa
                          </p>
                          <label className="sv-consent">
                            <input
                              type="checkbox"
                              checked={draft.guardianConsent}
                              onChange={(e) => patch({ guardianConsent: e.target.checked })}
                            />
                            <span>{SANTA_CONSENT_LABEL}</span>
                          </label>
                          <div className="sv-actions">
                            <PrimaryButton onClick={goOffer}>
                              {SANTA_COPY.steps.preview.cta(displayName)}
                            </PrimaryButton>
                            <BackButton onClick={() => go("preview")} />
                          </div>
                        </StepBody>
                      )}

                      {draft.step === "offer" && (
                        <StepBody title={SANTA_COPY.steps.offer.title}>
                          <ul className="sv-mentions">
                            {SANTA_COPY.steps.offer.included.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                          <label className="sv-field">
                            {SANTA_COPY.steps.offer.emailLabel}
                            <input
                              className="sv-input"
                              style={{ marginTop: "0.35rem" }}
                              type="email"
                              value={draft.email}
                              onChange={(e) => patch({ email: e.target.value })}
                              autoComplete="email"
                            />
                          </label>
                          <p className="sv-helper">{SANTA_COPY.steps.offer.consentNote}</p>
                          {purchasable && pkg ? (
                            <div className="sv-actions">
                              <PrimaryButton disabled={busy} onClick={() => void startCheckout()}>
                                {busy ? "Preparing checkout…" : SANTA_COPY.steps.offer.ctaPay}
                              </PrimaryButton>
                            </div>
                          ) : (
                            <p className="sv-soon">
                              {SANTA_COPY.steps.offer.checkoutSoon}
                              {product ? ` · Status: ${ctaStateForProduct(product)}` : null}
                            </p>
                          )}
                          <div className="sv-actions">
                            <BackButton onClick={() => go("confirm")} />
                          </div>
                        </StepBody>
                      )}

                      <p className="sv-privacy">
                        <LockIcon />
                        {SANTA_COPY.hero.privacy}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {draft.step === "checkout" && checkout && (
              <section className="sv-state">
                <h2 className="santa-display">Secure payment</h2>
                <div className="sv-checkout-wrap">
                  <CustomStripeCheckout
                    clientSecret={checkout.clientSecret}
                    publishableKey={checkout.publishableKey}
                    dueDisplay={`$${(checkout.amountCents / 100).toFixed(2)}`}
                    email={draft.email}
                    onReady={() => undefined}
                  />
                </div>
              </section>
            )}

            {draft.step === "progress" && (
              <section className="sv-state">
                <SantaWorkshopHero compact childName={displayName} caption={progressStageCopy} />
                <h2 className="santa-display">{SANTA_COPY.steps.progress.title(displayName)}</h2>
                <p className="sv-state__copy" aria-live="polite">
                  {progressStageCopy}
                </p>
                <p className="sv-state__meta">{santaProgressCopy(jobStatus || "queued")}</p>
                <p className="sv-state__meta">
                  This can take several minutes. You can close this page and reopen your order link later.
                </p>
              </section>
            )}

            {draft.step === "result" && resultUrl && (
              <section className="sv-state" style={{ textAlign: "left" }}>
                <h2 className="santa-display" style={{ textAlign: "center" }}>
                  {SANTA_COPY.steps.result.title(displayName)}
                </h2>
                <video
                  src={resultUrl}
                  controls
                  playsInline
                  className="sv-result-video"
                />
                <div className="sv-actions" style={{ marginTop: "1.1rem" }}>
                  <PrimaryButton onClick={() => void onDownload()}>
                    {SANTA_COPY.steps.result.download}
                  </PrimaryButton>
                  <GhostButton onClick={() => void onShare()}>
                    {SANTA_COPY.steps.result.share}
                  </GhostButton>
                  <GhostButton onClick={resetAll}>{SANTA_COPY.steps.result.another}</GhostButton>
                </div>
                <div className="sv-cross">
                  <p className="sv-state__meta">More Christmas magic</p>
                  <Link to="/christmas/tree">{SANTA_COPY.steps.result.crossSellTree}</Link>
                  <Link to="/christmas/cards">{SANTA_COPY.steps.result.crossSellCard}</Link>
                  <Link to="/christmas/photo-generator">
                    {SANTA_COPY.steps.result.crossSellPortrait}
                  </Link>
                </div>
              </section>
            )}

            {draft.step === "error" && (
              <section className="sv-state">
                <h2 className="santa-display">Something went wrong</h2>
                <p className="sv-state__copy">
                  If you already paid, keep your order link — support can retry without charging again.
                </p>
                <Link className="sv-state__meta" to="/christmas" style={{ color: "var(--sv-gold)" }}>
                  Christmas hub
                </Link>
              </section>
            )}

            {(inCreator || draft.step === "landing") && (
              <div className="sv-trust" aria-label="Why families love Santa Video">
                {SANTA_COPY.trust.map((item, i) => (
                  <div key={item.title} className="sv-trust__item">
                    <TrustIcon index={i} />
                    <div>
                      <p className="sv-trust__title">{item.title}</p>
                      <p className="sv-trust__body">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showMarketingBelow ? (
              <div className="sv-below">
                <SantaLandingSections />
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </>
  );
}

function StepBody({
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
        <p className="sv-progress__label" style={{ marginBottom: "0.35rem" }}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className="sv-q">{title}</h2>
      {helper ? <p className="sv-helper">{helper}</p> : null}
      {children}
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
    <button type="button" disabled={disabled} onClick={onClick} className="sv-btn sv-btn--primary">
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="sv-btn sv-btn--ghost">
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="sv-btn sv-btn--back">
      ← Back
    </button>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function TrustIcon({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg className="sv-trust__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 11V8a5 5 0 0 1 10 0v3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg className="sv-trust__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg className="sv-trust__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M12 9V21" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 9a4 4 0 0 1 8 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
