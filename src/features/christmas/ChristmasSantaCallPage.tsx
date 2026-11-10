import { resolveSantaCheckout } from "./santa-call/santaCheckoutDestination";
import { Logo } from "@/components/ui/logo";
import { SantaLandingVideo } from "./santa-call/SantaLandingVideo";
import { SantaSupportChat, openSantaSupport } from "./santa-call/SantaSupportChat";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { PageHead } from "@/components/PageHead";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { fetchChristmasCommercialOffers, startChristmasCheckout } from "@/features/christmas/photoApi";
import { catalogFromRows } from "@/features/christmas/commercialOffers";
import { NORTH_POLE_POSTER } from "@/features/christmas/santa-call/NorthPoleScene";
import { COOKIE_CONSENT_CHANGED_EVENT, openCookieSettings } from "@/lib/cookieConsent";
import { SANTA_LANDING_COPY } from "@/features/christmas/santa-call/santaLandingCopy";
import "./santa-call/santaLanding.css";
import {
  trackSantaCallMetaInitiateCheckout,
  trackSantaCallMetaPurchase,
  trackSantaCallMetaViewContent,
} from "@/features/christmas/santa-call/santaCallMeta";
import { trackSantaCallAnalytics } from "@/features/christmas/santa-call/santaCallAnalytics";
import {
  confirmSantaCallCommercialCheckout,
  createSantaCallParentTestCheckout,
} from "@/features/christmas/santa-call/santaCallApi";
import {
  formatSantaCallMoney,
  pricesForSantaCallMarket,
  readStoredSantaCallMarket,
  storeSantaCallMarket,
  suggestSantaCallMarket,
  type SantaCallMarket,
} from "@/features/christmas/santa-call/santaCallPricing";
import {
  isSantaCallLandingPreviewAllowed,
  isSantaCallLandingPublic,
  isSantaCallQaCheckoutEnabled,
  readSantaQaPageAccessToken,
} from "@/features/christmas/santa-call/santaCallPublic";
import {
  SANTA_CALL_COMMERCIAL_KEY,
  SANTA_CALL_CONSENT_VERSION,
  SANTA_CALL_COPY,
  SANTA_CALL_PRODUCT_KEY,
  SANTA_CALL_ROUTE,
  emptySantaCallPersonalization,
  validateSantaCallPersonalization,
  type SantaCallLanguage,
  type SantaCallPersonalization,
} from "@/features/christmas/santa-call/santaCallTypes";

function ensureFonts() {
  const id = "tdg-santa-call-fonts";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export default function ChristmasSantaCallPage() {
  const [params, setSearchParams] = useSearchParams();
  const previewOk = isSantaCallLandingPreviewAllowed(window.location.search);
  const qaCheckout = isSantaCallQaCheckoutEnabled();
  const [lang, setLang] = useState<SantaCallLanguage>(() =>
    (params.get("lang") || navigator.language || "ro").toLowerCase().startsWith("en") ? "en" : "ro",
  );
  const [market, setMarket] = useState<SantaCallMarket>(() => {
    const fromQuery = params.get("market");
    if (fromQuery === "ro" || fromQuery === "us") return fromQuery;
    return readStoredSantaCallMarket() || suggestSantaCallMarket({ uiLanguage: params.get("lang") || navigator.language });
  });
  const [marketLocked, setMarketLocked] = useState(false);
  const copy = SANTA_CALL_COPY[lang];
  const landing = SANTA_LANDING_COPY[lang];
  const prices = pricesForSantaCallMarket(market);
  const [form, setForm] = useState<SantaCallPersonalization>(() => ({
    ...emptySantaCallPersonalization(),
    language: (params.get("lang") || navigator.language || "ro").toLowerCase().startsWith("en") ? "en" : "ro",
  }));
  const [purchasable, setPurchasable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<{
    clientSecret: string | null;
    publishableKey: string | null;
    checkoutUrl: string | null;
    amountCents: number;
    currency: string;
    orderId?: string;
  } | null>(null);
  const [offerStatus, setOfferStatus] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [offerRetry, setOfferRetry] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "checking" | "confirmed" | "error">("idle");
  const [paymentRetry, setPaymentRetry] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const submitting = useRef(false);
  const formRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    ensureFonts();
    captureFunnelAttribution(window.location.search);
    const trackView = () => {
      if (qaCheckout || !previewOk || params.get("checkout") === "success") return;
      trackSantaCallMetaViewContent(prices.initialMinor, prices.currency);
      trackSantaCallAnalytics("santa_page_view", { market, language: lang }, "landing_view");
    };
    trackView();
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, trackView);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, trackView);
  }, [params, market, lang, prices.currency, prices.initialMinor, qaCheckout, previewOk]);

  // Server-verified payment recovery (email works even if this fails / browser closed).
  useEffect(() => {
    if (params.get("checkout") !== "success") return;
    if (qaCheckout) return;
    const sessionId = String(params.get("session_id") || "").trim();
    if (!sessionId.startsWith("cs_")) {
      setPaymentStatus("error");
      return;
    }
    setPaymentStatus("checking");
    let cancelled = false;
    void (async () => {
      const { ok, data } = await confirmSantaCallCommercialCheckout(sessionId).catch(() => ({ ok: false, data: null }));
      if (cancelled) return;
      if (!ok || data?.ok !== true) {
        setPaymentStatus("error");
        return;
      }
      setPaymentStatus("confirmed");
      const orderId = String(data.orderId || "");
      const amountCents = Number(data.amountCents) || prices.initialMinor;
      const currency = String(data.currency || prices.currency);
      // Meta Purchase only after LIVE server confirmation — never for TEST.
      if (orderId && data.livemode === true && data.stripe_mode === "live") {
        trackSantaCallMetaPurchase({ orderId, amountCents, currency });
        trackSantaCallAnalytics(
          "santa_purchase_confirmed",
          { transaction_id: orderId, value: amountCents / 100, currency: currency.toUpperCase(), payment_type: "initial" },
          `payment_confirmed.${orderId}`,
        );
      }
      const callPath = String(data.callPath || "");
      if (callPath.startsWith("/santa/call/")) {
        window.location.assign(`${callPath}?lang=${lang}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, qaCheckout, prices.currency, prices.initialMinor, lang, paymentRetry]);

  useEffect(() => {
    storeSantaCallMarket(market);
  }, [market]);

  useEffect(() => {
    const next = new URLSearchParams(params);
    let dirty = false;
    if (next.get("lang") !== lang) {
      next.set("lang", lang);
      dirty = true;
    }
    if (next.get("market") !== market) {
      next.set("market", market);
      dirty = true;
    }
    if (dirty) setSearchParams(next, { replace: true });
  }, [lang, market, params, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    setOfferStatus("loading");
    if (qaCheckout) {
      const enabled = Boolean(readSantaQaPageAccessToken(window.location.search));
      setOfferStatus(enabled ? "ready" : "unavailable");
      setPurchasable(enabled);
      return;
    }
    void fetchChristmasCommercialOffers()
      .then((rows) => {
        if (cancelled) return;
        const offer = catalogFromRows(rows as any).find((item) => item.key === SANTA_CALL_COMMERCIAL_KEY);
        const checkoutUi =
          String(import.meta.env.VITE_SANTA_CALL_ENABLE_CHECKOUT || "")
            .trim()
            .toLowerCase() === "true" ||
          String(import.meta.env.VITE_SANTA_CALL_ENABLE_CHECKOUT || "").trim() === "1";
        const ok = Boolean(offer?.active && offer.webCheckoutEnabled && offer.webPriceMinor > 0);
        const enabled = ok && isSantaCallLandingPublic() && checkoutUi;
        setPurchasable(enabled);
        setOfferStatus(enabled ? "ready" : "unavailable");
      })
      .catch(() => {
        if (!cancelled) {
          setPurchasable(false);
          setOfferStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [previewOk, qaCheckout, offerRetry]);

  const priceLabel = useMemo(
    () => formatSantaCallMoney(prices.initialMinor, prices.currency),
    [prices.currency, prices.initialMinor],
  );
  const priceHero = useMemo(() => {
    if (market === "ro") return `${Math.round(prices.initialMinor / 100)} lei / ${copy.priceDuration}`;
    return `${priceLabel} / ${copy.priceDuration}`;
  }, [copy.priceDuration, market, priceLabel, prices.initialMinor]);
  const extensionLabel = useMemo(
    () => formatSantaCallMoney(prices.extensionMinor, prices.currency),
    [prices.currency, prices.extensionMinor],
  );

  function openForm() {
    if (!purchasable) return;
    if (!qaCheckout) trackSantaCallAnalytics("santa_cta_click", { market, language: lang }, "cta");
    setShowForm(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  function onLang(next: SantaCallLanguage) {
    if (busy || checkout) return;
    setLang(next);
    setForm((f) => ({ ...f, language: next }));
    if (!marketLocked && !readStoredSantaCallMarket()) {
      setMarket(suggestSantaCallMarket({ uiLanguage: next }));
    }
  }

  function onMarket(next: SantaCallMarket) {
    if (marketLocked || checkout) return;
    setMarket(next);
  }

  async function onCheckout() {
    if (submitting.current || checkout) return;
    setError(null);
    const invalid = validateSantaCallPersonalization({ ...form, language: lang });
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!form.email.trim()) {
      setError("email");
      return;
    }
    if (!purchasable) {
      setError("checkout_disabled");
      return;
    }
    submitting.current = true;
    setBusy(true);
    if (!qaCheckout) trackSantaCallAnalytics("santa_form_complete", { market, language: lang });
    try {
      if (qaCheckout) {
        const access = readSantaQaPageAccessToken(window.location.search);
        const origin = window.location.origin;
        const qaBase = `${origin}/_qa/santa-qa`;
        const { ok, data } = await createSantaCallParentTestCheckout({
          pageAccess: access,
          childFirstName: form.childFirstName.trim(),
          language: lang,
          market,
          email: form.email.trim(),
          age: form.age || undefined,
          christmasWish: form.christmasWish.trim() || form.hobbies.trim() || undefined,
          hobbies: form.hobbies.trim() || undefined,
          // Server mints accessToken; return_url must land on the private call route.
          cancelUrl: `${qaBase}/christmas/santa-call?checkout=cancel&lang=${lang}&market=${market}&access=${encodeURIComponent(access)}`,
        });
        if (!ok || data?.ok !== true) {
          setError(String(data?.code || "checkout_failed"));
          return;
        }
        setMarketLocked(true);
        const orderId = String(data.orderId || "");
        const callToken = String(data.accessToken || "");
        // Prefer server callPath; keep page access on redirect for overlay cookie continuity.
        if (data.checkoutMode === "hosted" && data.checkoutUrl) {
          window.location.href = String(data.checkoutUrl);
          return;
        }
        if (callToken && data.clientSecret && data.publishableKey) {
          // Rebuild session is already created with return_url; show embedded checkout.
          setCheckout({
            clientSecret: String(data.clientSecret),
            publishableKey: String(data.publishableKey),
            checkoutUrl: data.checkoutUrl ? String(data.checkoutUrl) : null,
            amountCents: Number(data.amountCents) || prices.initialMinor,
            currency: String(data.currency || prices.currency),
            orderId,
          });
          return;
        }
        if (callToken) {
          window.location.href = `${qaBase}/santa/call/${encodeURIComponent(callToken)}?access=${encodeURIComponent(access)}&lang=${lang}`;
          return;
        }
        setError("checkout_failed");
        return;
      }

      const data = await startChristmasCheckout({
        product_key: SANTA_CALL_PRODUCT_KEY,
        package_key: "single",
        email: form.email.trim() || undefined,
        child_first_name: form.childFirstName.trim(),
        language: lang,
        age: form.age ? Number(form.age) : null,
        christmas_wish: form.christmasWish.trim() || null,
        hobbies: form.hobbies.trim() || null,
        pet_name: form.petName.trim() || null,
        positive_detail: form.positiveDetail.trim() || null,
        guardian_consent: true,
        consent_version: SANTA_CALL_CONSENT_VERSION,
        landing_path: SANTA_CALL_ROUTE,
        success_url: `${window.location.origin}${SANTA_CALL_ROUTE}?checkout=success&lang=${lang}&market=${market}`,
        locale: lang,
        market,
        currency: prices.currency,
        amount_cents: prices.initialMinor,
        preferred_currency: prices.currency,
      });
      const transport = resolveSantaCheckout(data);
      setMarketLocked(true);
      const orderId = String((data as { orderId?: string }).orderId || "");
      if (orderId) {
        trackSantaCallMetaInitiateCheckout({
          orderId,
          amountCents: data.amountCents,
          currency: data.currency || prices.currency,
        });
        trackSantaCallAnalytics(
          "santa_checkout_started",
          {
            transaction_id: orderId,
            value: data.amountCents / 100,
            currency: String(data.currency || prices.currency).toUpperCase(),
          },
          `begin_checkout.${orderId}`,
        );
      }
      if (transport.kind === "hosted") {
        window.location.assign(transport.url);
        return;
      }
      setCheckout({
        clientSecret: transport.clientSecret,
        publishableKey: transport.publishableKey,
        checkoutUrl: null,
        amountCents: data.amountCents,
        currency: data.currency || prices.currency,
        orderId,
      });
    } catch (err) {
      const code = (err as { code?: string })?.code || "checkout_failed";
      setError(code);
      if (!qaCheckout) trackSantaCallAnalytics("santa_checkout_error", { market });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const site = "https://www.thedigitalgifter.com";
  const returningFromPayment = params.get("checkout") === "success" && !qaCheckout;
  const extensionText = `${landing.extension} · ${extensionLabel}`;
  const errorMessage = error ? (landing.errors[error as keyof typeof landing.errors] || copy.errorGeneric) : null;
  const interestsValue = [form.hobbies, form.christmasWish].filter(Boolean).join(form.hobbies && form.christmasWish ? " · " : "");

  if (!previewOk) {
    return (
      <>
        <ChristmasPageHead path={SANTA_CALL_ROUTE} noindex />
        <div className="sc-page sc-gated" lang={lang}>
          <header className="sc-header">
            <Logo variant="light" />
          </header>
          <div className="sc-gated-main">
            <p className="sc-kicker">{copy.kicker}</p>
            <h1 className="santa-call-display sc-title">{copy.title}</h1>
            <p className="sc-body">{copy.comingSoon}</p>
            <Link to="/christmas" className="sc-cta">
              {copy.brand}
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead title={copy.ogTitle} description={copy.ogDescription}
        url={`${site}${SANTA_CALL_ROUTE}`} image={`${site}${NORTH_POLE_POSTER}`}
        exactTitle noindex />
      <div className="sc-page" lang={lang}>
        <SantaSupportChat language={lang} />
        <header className="sc-header">
          <Logo variant="light" />
          <div className="sc-controls">
            <div className="sc-seg" role="group" aria-label={copy.langLabel}>
              {(["ro", "en"] as const).map((value) => (
                <button key={value} type="button" aria-pressed={lang === value}
                  disabled={busy || Boolean(checkout)} onClick={() => onLang(value)}>{value.toUpperCase()}</button>
              ))}
            </div>
            <label className="sc-currency">
              <span className="sr-only">{copy.marketLabel}</span>
              <select value={market} disabled={marketLocked || busy || Boolean(checkout)}
                onChange={(event) => onMarket(event.target.value as SantaCallMarket)}>
                <option value="ro">RON</option><option value="us">USD</option>
              </select>
            </label>
          </div>
        </header>
        <div className="sc-main">
          {returningFromPayment ? (
            <section className="sc-payment-return" aria-live="polite">
              <h1>{paymentStatus === "confirmed" ? landing.paymentConfirmed : paymentStatus === "error" ? landing.paymentPending : copy.paymentConfirming}</h1>
              <p>{paymentStatus === "confirmed" ? copy.successNote : paymentStatus === "error" ? copy.paymentConfirmFailed : landing.paymentWait}</p>
              {paymentStatus === "error" && <button className="sc-cta" onClick={() => setPaymentRetry((value) => value + 1)}>{copy.paymentConfirmRetry}</button>}
              <button type="button" className="sc-text-button" onClick={openSantaSupport}>{lang === "ro" ? "Scrie-ne în chat" : "Chat with support"}</button>
            </section>
          ) : (
            <>
              <section className="sc-hero" aria-labelledby="santa-title">
                <div className="sc-hero-copy">
                  <p className="sc-kicker">{landing.kicker}</p>
                  <h1 id="santa-title" className="santa-call-display">{landing.title}</h1>
                  <p className="sc-sub">{landing.subtitle}</p>
                  <ul className="sc-benefits">{landing.benefits.map((text) => <li key={text}>✦ {text}</li>)}</ul>
                  <p className="sc-price">{priceHero}</p>
                  <p className="sc-trust">{copy.trust}</p>
                  {offerStatus === "ready" ? (
                    <button className="sc-cta" type="button" onClick={openForm}>{landing.cta} · {priceLabel} <span aria-hidden>↗</span></button>
                  ) : (
                    <div className="sc-availability" role="status">
                      <p>{offerStatus === "loading" ? landing.checking : offerStatus === "error" ? landing.offerError : landing.unavailable}</p>
                      {offerStatus !== "loading" && <button type="button" className="sc-text-button" onClick={() => setOfferRetry((value) => value + 1)}>{landing.retry}</button>}
                      {offerStatus === "unavailable" && <button type="button" className="sc-text-button" onClick={openSantaSupport}>{lang === "ro" ? "Scrie-ne în chat" : "Chat with support"}</button>}
                    </div>
                  )}
                  {qaCheckout && <p className="sc-availability">QA TEST · Stripe TEST</p>}
                  <a href="#conversation" className="sc-demo-link">{landing.seeExample} <span aria-hidden>↓</span></a>
                  <p className="sc-ai">{copy.legalSummary}</p>
                </div>
                <figure className="sc-portrait">
                  <div className="sc-portrait-media"><SantaLandingVideo alt={landing.imageAlt} /></div>
                  <figcaption><span className="sc-kicker">{landing.sceneLabel}</span><strong>{landing.sceneTitle}</strong><span>{landing.sceneNote}</span></figcaption>
                </figure>
              </section>

              {showForm && (
                <section className="sc-section sc-personalize" id="personalize" data-clarity-mask="true" ref={formRef} aria-labelledby="personalize-title">
                  <div>
                    <p className="sc-kicker">{checkout ? landing.stepTwo : landing.stepOne}</p>
                    <h2 id="personalize-title" className="santa-call-display">{checkout ? landing.paymentTitle : copy.formTitle}</h2>
                    <p>{checkout ? landing.paymentDescription : copy.previewBody}</p>
                    <p className="sc-order-summary">{priceHero}<br /><span>{copy.trust}</span></p>
                    <p className="sc-small">{extensionText}</p>
                  </div>
                  <div className="sc-form-card">
                    {!checkout ? (
                      <form onChangeCapture={() => { if (!qaCheckout) trackSantaCallAnalytics("santa_form_start", { market }, "form_start"); }} onSubmit={(event) => { event.preventDefault(); void onCheckout(); }}>
                        <fieldset disabled={busy}>
                          <label htmlFor="santa-name">{copy.name} *</label>
                          <input id="santa-name" name="childFirstName" autoComplete="off" required maxLength={40}
                            aria-invalid={error === "child_name"} aria-describedby={error === "child_name" ? "santa-error" : undefined}
                            value={form.childFirstName} onChange={(e) => setForm((f) => ({ ...f, childFirstName: e.target.value }))} />
                          <label htmlFor="santa-email">{copy.emailRequired} *</label>
                          <input id="santa-email" name="email" type="email" autoComplete="email" required maxLength={254}
                            aria-invalid={error === "email"} aria-describedby="santa-email-help"
                            value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                          <p id="santa-email-help" className="sc-small">{landing.emailHelp}</p>
                          <details className="sc-optional">
                            <summary>{landing.optional}</summary>
                            <label htmlFor="santa-age">{copy.age}</label>
                            <input id="santa-age" type="number" min={1} max={17} inputMode="numeric"
                              aria-invalid={error === "age"} aria-describedby={error === "age" ? "santa-error" : undefined}
                              value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} />
                            <label htmlFor="santa-interests">{landing.interests}</label>
                            <textarea id="santa-interests" maxLength={120} rows={3} value={interestsValue}
                              onChange={(e) => setForm((f) => ({ ...f, hobbies: e.target.value, christmasWish: "" }))} />
                          </details>
                          <label className="sc-check">
                            <input type="checkbox" required checked={form.guardianConsent}
                              onChange={(e) => setForm((f) => ({ ...f, guardianConsent: e.target.checked }))} />
                            <span>{copy.consent}</span>
                          </label>
                          <p className="sc-links"><Link to="/terms" target="_blank" rel="noopener noreferrer">{landing.terms}</Link><Link to="/privacy" target="_blank" rel="noopener noreferrer">{copy.privacyLink}</Link></p>
                          {errorMessage && <p id="santa-error" className="sc-error" role="alert">{errorMessage}</p>}
                          <button type="submit" className="sc-cta" disabled={busy || !purchasable}>{busy ? landing.preparing : `${copy.continueCheckout} · ${priceLabel}`}</button>
                        </fieldset>
                      </form>
                    ) : (
                      <div className="sc-stripe">
                        {checkout.clientSecret && checkout.publishableKey ? (
                          <CustomStripeCheckout clientSecret={checkout.clientSecret} publishableKey={checkout.publishableKey}
                            language={lang}
                            dueDisplay={formatSantaCallMoney(checkout.amountCents, checkout.currency)} email={form.email}
                            walletCapabilityOnly loadingLabel={landing.paymentLoading} busyLabel={landing.paying}
                            payButtonLabel={(amount) => `${landing.pay} ${amount}`}
                            onReady={() => { if (!qaCheckout) trackSantaCallAnalytics("santa_checkout_loaded", { market }, `loaded.${checkout.orderId}`); }}
                            onPaymentInteraction={() => { if (!qaCheckout) trackSantaCallAnalytics("santa_payment_interaction", { market }, `interaction.${checkout.orderId}`); }}
                            onInitError={() => { if (!qaCheckout) trackSantaCallAnalytics("santa_payment_load_error", { market }); }} />
                        ) : checkout.checkoutUrl ? <a className="sc-cta" href={checkout.checkoutUrl}>{copy.continueCheckout}</a> : null}
                        <p className="sc-small">{landing.securePayment}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              <section className="sc-section sc-joy" aria-labelledby="joy-title">
                <div className="sc-joy-heading">
                  <p className="sc-kicker">{landing.joyKicker}</p>
                  <h2 id="joy-title" className="santa-call-display">{landing.joyTitle}</h2>
                  <p>{landing.joyIntro}</p>
                </div>
                <ul className="sc-joy-cards">
                  {landing.joyCards.map((item) => (
                    <li key={item.title}>
                      <span className="sc-joy-star" aria-hidden="true">✦</span>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </li>
                  ))}
                </ul>
                <div className="sc-joy-action">
                  <p>{landing.joyParentNote}</p>
                  {purchasable && <button type="button" className="sc-cta" onClick={openForm}>{landing.joyCta} · {priceLabel} <span aria-hidden>↗</span></button>}
                </div>
              </section>

              <section className="sc-section" id="how-it-works" aria-labelledby="process-title">
                <p className="sc-kicker">{landing.processKicker}</p>
                <h2 id="process-title" className="santa-call-display">{landing.processTitle}</h2>
                <ol className="sc-steps">{landing.steps.map((step, index) => <li key={step.title}><span className="sc-step-number">0{index + 1}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>
              </section>

              <section className="sc-section sc-conversation" id="conversation" aria-labelledby="conversation-title">
                <div><p className="sc-kicker">{landing.exampleLabel}</p><h2 id="conversation-title" className="santa-call-display">{landing.exampleTitle}</h2><p>{landing.exampleBody}</p><p className="sc-small">{landing.exampleNote}</p></div>
                <div className="sc-dialogue">{landing.dialogue.map((line, index) => <div key={index} className={index === 1 ? "sc-bubble sc-bubble-child" : "sc-bubble"}><span>{index === 1 ? landing.child : copy.santaLabel}</span><p>{line}</p></div>)}</div>
              </section>

              <section className="sc-section sc-faq" aria-labelledby="faq-title">
                <p className="sc-kicker">{landing.forParents}</p><h2 id="faq-title" className="santa-call-display">{copy.faqTitle}</h2>
                {landing.faqs.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
                <details><summary>{landing.extensionQuestion}</summary><p>{extensionText}. {landing.extensionBody}</p></details>
              </section>

              <section className="sc-section sc-final">
                <p className="sc-kicker">{landing.finalKicker}</p><h2 className="santa-call-display">{landing.finalTitle}</h2><p>{priceHero} · {landing.singlePayment}</p>
                {purchasable && <button type="button" className="sc-cta" onClick={openForm}>{landing.cta} · {priceLabel} <span aria-hidden>↗</span></button>}
                <p className="sc-small">{extensionText}</p>
              </section>
            </>
          )}
          <footer className="sc-footer">
            <strong>{copy.brand}</strong><p>{landing.parentNote}</p>
            <nav aria-label={landing.footerLabel} className="sc-links"><Link to="/privacy">{copy.privacyLink}</Link><Link to="/terms">{landing.terms}</Link><Link to="/refunds">{landing.refunds}</Link><button type="button" className="sc-text-button" onClick={openSantaSupport}>{lang === "ro" ? "Scrie-ne în chat" : "Chat with support"}</button><button type="button" className="sc-text-button" onClick={openCookieSettings}>{landing.cookies}</button></nav>
          </footer>
        </div>
        {!showForm && !returningFromPayment && purchasable && <div className="sc-sticky"><span>{priceHero}</span><button type="button" className="sc-cta" onClick={openForm}>{landing.ctaShort}</button></div>}
      </div>
    </>
  );

}
