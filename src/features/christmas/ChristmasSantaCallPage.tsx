import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { PageHead } from "@/components/PageHead";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { fetchChristmasCommercialOffers, startChristmasCheckout } from "@/features/christmas/photoApi";
import { catalogFromRows } from "@/features/christmas/commercialOffers";
import { NorthPoleScene } from "@/features/christmas/santa-call/NorthPoleScene";
import {
  trackSantaCallMetaInitiateCheckout,
  trackSantaCallMetaPurchase,
  trackSantaCallMetaViewContent,
} from "@/features/christmas/santa-call/santaCallMeta";
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
  const [successNote, setSuccessNote] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const viewed = useRef(false);
  const formRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    ensureFonts();
    captureFunnelAttribution(window.location.search);
    if (!viewed.current) {
      viewed.current = true;
      trackSantaCallMetaViewContent(prices.initialMinor, prices.currency);
    }
    if (params.get("checkout") === "success") {
      setSuccessNote(true);
      setShowForm(true);
    }
  }, [params, prices.currency, prices.initialMinor]);

  // Server-verified payment recovery (email works even if this fails / browser closed).
  useEffect(() => {
    if (params.get("checkout") !== "success") return;
    if (qaCheckout) return;
    const sessionId = String(params.get("session_id") || "").trim();
    if (!sessionId.startsWith("cs_")) return;
    let cancelled = false;
    void (async () => {
      const { ok, data } = await confirmSantaCallCommercialCheckout(sessionId);
      if (cancelled) return;
      if (!ok || data?.ok !== true) return;
      const orderId = String(data.orderId || "");
      const amountCents = Number(data.amountCents) || prices.initialMinor;
      const currency = String(data.currency || prices.currency);
      // Meta Purchase only after LIVE server confirmation — never for TEST.
      if (orderId && data.livemode === true && data.stripe_mode === "live") {
        trackSantaCallMetaPurchase({ orderId, amountCents, currency });
      }
      const callPath = String(data.callPath || "");
      if (callPath.startsWith("/santa/call/")) {
        window.location.assign(`${callPath}?lang=${lang}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, qaCheckout, prices.currency, prices.initialMinor, lang]);

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
    if (qaCheckout) {
      setPurchasable(Boolean(readSantaQaPageAccessToken(window.location.search)));
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
        setPurchasable(ok && isSantaCallLandingPublic() && checkoutUi);
      })
      .catch(() => {
        if (!cancelled) setPurchasable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [previewOk, qaCheckout]);

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
    setShowForm(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  function onLang(next: SantaCallLanguage) {
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
    setBusy(true);
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
        if (orderId) {
          trackSantaCallMetaInitiateCheckout({
            orderId,
            amountCents: Number(data.amountCents) || prices.initialMinor,
            currency: String(data.currency || prices.currency),
          });
        }
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
      setMarketLocked(true);
      const orderId = String((data as { orderId?: string }).orderId || "");
      if (orderId) {
        trackSantaCallMetaInitiateCheckout({
          orderId,
          amountCents: data.amountCents,
          currency: data.currency || prices.currency,
        });
      }
      setCheckout({
        clientSecret: data.clientSecret,
        publishableKey: data.publishableKey,
        checkoutUrl: null,
        amountCents: data.amountCents,
        currency: data.currency || prices.currency,
        orderId,
      });
    } catch (err) {
      const code = (err as { code?: string })?.code || "checkout_failed";
      setError(code);
    } finally {
      setBusy(false);
    }
  }

  const site = "https://www.thedigitalgifter.com";
  const interestsValue = [form.hobbies, form.christmasWish].filter(Boolean).join(form.hobbies && form.christmasWish ? " · " : "");

  if (!previewOk) {
    return (
      <>
        <ChristmasPageHead path={SANTA_CALL_ROUTE} noindex />
        <div className="sc-page sc-gated" lang={lang}>
          <header className="sc-header">
            <Link to="/christmas" className="sc-brand santa-call-display">
              {copy.brand}
            </Link>
          </header>
          <main className="sc-gated-main">
            <p className="sc-kicker">{copy.kicker}</p>
            <h1 className="santa-call-display sc-title">{copy.title}</h1>
            <p className="sc-body">{copy.comingSoon}</p>
            <Link to="/christmas" className="sc-cta">
              {copy.brand}
            </Link>
          </main>
          <style>{gatedCss}</style>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        title={copy.ogTitle}
        description={copy.ogDescription}
        url={`${site}${SANTA_CALL_ROUTE}`}
        image={`${site}/assets/christmas/north-pole-santa/posters/north_pole_santa_reel_hq.jpg`}
        exactTitle
        noindex
      />
      <div className="sc-page" lang={lang}>
        <div className="sc-hero-stage" aria-hidden>
          <NorthPoleScene variant="immersive" listening={!prefersReducedMotion()} />
        </div>

        <header className="sc-header">
          <Link to="/christmas" className="sc-brand santa-call-display">
            {copy.brand}
          </Link>
          <div className="sc-controls">
            <div className="sc-seg" role="group" aria-label={copy.langLabel}>
              <button type="button" className={lang === "ro" ? "is-on" : ""} onClick={() => onLang("ro")}>
                RO
              </button>
              <button type="button" className={lang === "en" ? "is-on" : ""} onClick={() => onLang("en")}>
                EN
              </button>
            </div>
            <div className="sc-seg" role="group" aria-label={copy.marketLabel}>
              <button
                type="button"
                className={market === "ro" ? "is-on" : ""}
                disabled={marketLocked || Boolean(checkout)}
                onClick={() => onMarket("ro")}
              >
                RON
              </button>
              <button
                type="button"
                className={market === "us" ? "is-on" : ""}
                disabled={marketLocked || Boolean(checkout)}
                onClick={() => onMarket("us")}
              >
                USD
              </button>
            </div>
          </div>
        </header>

        <main className="sc-main">
          <section className="sc-hero">
            <h1 className="santa-call-display sc-title">{copy.title}</h1>
            <p className="sc-sub">{copy.subtitle}</p>
            <p className="sc-price">{priceHero}</p>
            <p className="sc-trust">{copy.trust}</p>
            {!purchasable && !qaCheckout ? <p className="sc-soon">{copy.comingSoon}</p> : null}
            {qaCheckout ? <p className="sc-soon sc-soon-qa">QA TEST · Stripe TEST only</p> : null}
            {successNote ? <p className="sc-success">{copy.successNote}</p> : null}
            {!showForm ? (
              <button type="button" className="sc-cta" onClick={openForm}>
                {copy.cta}
              </button>
            ) : null}
            <p className="sc-ai">{copy.legalSummary}</p>
          </section>

          {showForm ? (
            <section
              className="sc-section"
              id="personalize"
              ref={(el) => {
                formRef.current = el;
              }}
            >
              <div className="sc-form">
                <p className="sc-form-lead">{copy.previewBody}</p>
                <label>
                  <span>{copy.name} *</span>
                  <input
                    autoComplete="given-name"
                    enterKeyHint="next"
                    value={form.childFirstName}
                    maxLength={40}
                    onChange={(e) => setForm((f) => ({ ...f, childFirstName: e.target.value }))}
                  />
                </label>
                <div className="sc-form-row">
                  <label>
                    <span>{copy.age}</span>
                    <input
                      inputMode="numeric"
                      enterKeyHint="next"
                      value={form.age}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, age: e.target.value.replace(/[^\d]/g, "").slice(0, 2) }))
                      }
                    />
                  </label>
                  <label>
                    <span>{copy.emailRequired} *</span>
                    <input
                      type="email"
                      autoComplete="email"
                      enterKeyHint="next"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </label>
                </div>
                <label>
                  <span>{copy.interests}</span>
                  <textarea
                    maxLength={120}
                    rows={2}
                    enterKeyHint="done"
                    value={interestsValue}
                    onChange={(e) => {
                      const v = e.target.value.slice(0, 120);
                      setForm((f) => ({ ...f, hobbies: v, christmasWish: "" }));
                    }}
                  />
                </label>
                <label className="sc-check">
                  <input
                    type="checkbox"
                    checked={form.guardianConsent}
                    onChange={(e) => setForm((f) => ({ ...f, guardianConsent: e.target.checked }))}
                  />
                  <span>{copy.consent}</span>
                </label>

                {error ? (
                  <p className="sc-error" role="alert">
                    {error === "consent"
                      ? copy.errorConsent
                      : error === "checkout_disabled"
                        ? copy.errorCheckoutDisabled
                        : error === "email" || error === "child_name"
                          ? copy.errorGeneric
                          : copy.errorGeneric}
                  </p>
                ) : null}

                {!checkout ? (
                  <button
                    type="button"
                    className="sc-cta"
                    disabled={busy || !purchasable}
                    onClick={() => void onCheckout()}
                  >
                    {busy ? "…" : `${copy.continueCheckout} · ${priceHero}`}
                  </button>
                ) : (
                  <div className="sc-stripe">
                    <p className="sc-charge">
                      {formatSantaCallMoney(checkout.amountCents, checkout.currency)}
                    </p>
                    {checkout.clientSecret && checkout.publishableKey ? (
                      <CustomStripeCheckout
                        clientSecret={checkout.clientSecret}
                        publishableKey={checkout.publishableKey}
                        dueDisplay={formatSantaCallMoney(checkout.amountCents, checkout.currency)}
                        email={form.email}
                      />
                    ) : checkout.checkoutUrl ? (
                      <a className="sc-cta" href={checkout.checkoutUrl}>
                        {copy.continueCheckout}
                      </a>
                    ) : null}
                  </div>
                )}
              </div>
            </section>
          ) : null}

          <section className="sc-legal">
            <details>
              <summary>{copy.faqTitle}</summary>
              <div className="sc-faq">
                {copy.faqs.slice(0, 3).map((item) => (
                  <div key={item.q}>
                    <strong>{item.q}</strong>
                    <p>{item.a}</p>
                  </div>
                ))}
                <p className="sc-ext-note">{copy.extensionHint.replace(/^Prelungire opțională:\s*/i, "").replace(/^Optional extension:\s*/i, "")}</p>
              </div>
            </details>
            <p className="sc-fine">
              {copy.ai} {copy.parents}
            </p>
            <p className="sc-links">
              <Link to="/privacy">{copy.privacyLink}</Link>
              <Link to="/support">{copy.supportLink}</Link>
            </p>
          </section>
        </main>

        {!showForm ? (
          <div className="sc-sticky">
            <button type="button" className="sc-cta sc-cta-sticky" onClick={openForm}>
              {copy.ctaSticky} · {priceHero}
            </button>
          </div>
        ) : null}

        <style>{pageCss}</style>
      </div>
    </>
  );
}

const gatedCss = `
  .sc-gated { min-height: 100dvh; background: linear-gradient(160deg,#1a0b0d,#3b0610 55%,#0f3d2e); color:#F7F0E4; padding: 24px; }
  .sc-gated-main { max-width: 36rem; margin: 12vh auto; }
  .sc-brand { color: #e8c547; text-decoration: none; font-size: 1.25rem; }
  .sc-kicker { letter-spacing: .14em; text-transform: uppercase; font-size: .75rem; opacity: .8; }
  .sc-title { font-size: clamp(1.8rem, 5vw, 2.6rem); line-height: 1.15; margin: .5rem 0 1rem; }
  .sc-body { opacity: .9; line-height: 1.55; }
  .sc-cta { display: inline-block; margin-top: 1.5rem; color: #0f3d2e; background: #e8c547; padding: .75rem 1.25rem; border-radius: 999px; text-decoration: none; font-weight: 600; border: 0; cursor: pointer; }
  .santa-call-display { font-family: "Cormorant Garamond", Georgia, serif; }
`;

const pageCss = `
  .santa-call-display { font-family: "Cormorant Garamond", Georgia, serif; }
  .sc-page {
    font-family: "Source Sans 3", system-ui, sans-serif;
    color: #F7F0E4;
    background: #12080a;
    min-height: 100dvh;
    min-height: 100svh;
    position: relative;
    overflow-x: hidden;
    width: 100%;
    max-width: 100vw;
  }
  .sc-hero-stage {
    position: absolute; inset: 0 0 auto 0; height: min(100dvh, 980px);
    z-index: 0; pointer-events: none; overflow: hidden;
  }
  .sc-header {
    position: relative; z-index: 5;
    display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
    padding: max(0.65rem, env(safe-area-inset-top)) 0.85rem 0.35rem;
    max-width: 42rem; margin: 0 auto;
    width: 100%; box-sizing: border-box;
  }
  .sc-brand { color: #F7E7B0; text-decoration: none; font-size: 1.05rem; font-weight: 700; text-shadow: 0 2px 12px rgba(0,0,0,.5); min-width: 0; }
  .sc-controls { display: flex; gap: 0.35rem; flex-wrap: wrap; justify-content: flex-end; flex-shrink: 0; }
  .sc-seg {
    display: inline-flex; border-radius: 999px; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.18); background: rgba(0,0,0,0.35);
    backdrop-filter: blur(8px);
  }
  .sc-seg button {
    border: 0; background: transparent; color: #F7F0E4; padding: 0.28rem 0.65rem;
    font-size: 0.75rem; font-weight: 600; cursor: pointer;
  }
  .sc-seg button.is-on { background: #7a1520; }
  .sc-seg button:disabled { opacity: 0.45; cursor: not-allowed; }
  .sc-main {
    position: relative; z-index: 2;
    max-width: 26rem; margin: 0 auto;
    padding: 0.35rem 0.85rem calc(5.75rem + env(safe-area-inset-bottom) + var(--tdg-cookie-offset, 0px));
    width: 100%; box-sizing: border-box;
  }
  .sc-hero {
    min-height: min(56dvh, 26rem);
    display: flex; flex-direction: column; justify-content: flex-end;
    padding-top: max(3.75rem, 10dvh);
    text-shadow: 0 2px 18px rgba(0,0,0,.55);
  }
  .sc-title { margin: 0; font-size: clamp(1.7rem, 7vw, 2.7rem); line-height: 1.08; font-weight: 700; }
  .sc-sub { margin: 0.55rem 0 0; font-size: 0.98rem; line-height: 1.4; max-width: 22rem; opacity: 0.95; }
  .sc-price { margin: 0.8rem 0 0; font-size: 1.35rem; font-weight: 700; color: #E8C547; }
  .sc-trust { margin: 0.45rem 0 0; font-size: 0.8rem; letter-spacing: 0.01em; opacity: 0.85; }
  .sc-soon, .sc-success {
    margin-top: 0.65rem; padding: 0.55rem 0.75rem; border-radius: 0.85rem; font-size: 0.78rem; line-height: 1.35;
    border: 1px solid rgba(232,197,71,0.35); background: rgba(10,6,8,0.55);
  }
  .sc-soon-qa { border-color: rgba(120,180,255,0.35); }
  .sc-cta {
    margin-top: 0.9rem; border: 0; border-radius: 999px; padding: 0.95rem 1.1rem;
    font-size: 1.05rem; font-weight: 700; color: #F7F0E4; cursor: pointer;
    background: linear-gradient(180deg, #1a5a42 0%, #0f3d2e 100%);
    box-shadow: 0 12px 28px rgba(0,0,0,0.35);
    text-decoration: none; display: inline-block; text-align: center;
    width: 100%; max-width: 22rem; box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
  }
  .sc-cta:disabled { opacity: 0.5; cursor: not-allowed; }
  .sc-ai { margin: 0.55rem 0 0; font-size: 0.72rem; line-height: 1.35; opacity: 0.78; max-width: 22rem; }
  .sc-section { margin-top: 0.85rem; scroll-margin-top: calc(1rem + env(safe-area-inset-top)); }
  .sc-form {
    display: grid; gap: 0.65rem;
    padding: 0.85rem; border-radius: 1.15rem;
    background: rgba(26, 8, 12, 0.78); border: 1px solid rgba(232,197,71,0.22);
    backdrop-filter: blur(10px);
    width: 100%; box-sizing: border-box;
  }
  .sc-form-lead { margin: 0; font-size: 0.82rem; line-height: 1.4; opacity: 0.9; }
  .sc-form-row { display: grid; grid-template-columns: 5.5rem 1fr; gap: 0.55rem; }
  .sc-form label { display: grid; gap: 0.28rem; font-size: 0.84rem; }
  .sc-form input, .sc-form textarea {
    border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.16);
    background: rgba(0,0,0,0.28); color: inherit; padding: 0.7rem 0.75rem; outline: none;
    font: inherit; font-size: 16px; width: 100%; box-sizing: border-box;
  }
  .sc-form textarea { min-height: 2.8rem; resize: vertical; }
  .sc-check { display: flex !important; align-items: flex-start; gap: 0.6rem; }
  .sc-check input { margin-top: 0.2rem; width: auto; }
  .sc-error { margin: 0; color: #ffb4b4; font-size: 0.86rem; }
  .sc-charge { margin: 0 0 0.55rem; font-weight: 600; color: #E8C547; }
  .sc-legal { margin-top: 1.5rem; opacity: 0.9; padding-bottom: 0.5rem; }
  .sc-legal summary { cursor: pointer; font-weight: 600; color: #E8C547; }
  .sc-faq { margin-top: 0.65rem; display: grid; gap: 0.65rem; font-size: 0.86rem; line-height: 1.45; }
  .sc-faq p { margin: 0.25rem 0 0; opacity: 0.88; }
  .sc-ext-note { margin: 0.35rem 0 0 !important; font-size: 0.8rem; opacity: 0.8; }
  .sc-fine { margin-top: 0.75rem; font-size: 0.72rem; line-height: 1.45; opacity: 0.72; }
  .sc-links { display: flex; gap: 1rem; margin-top: 0.55rem; }
  .sc-links a { color: #E8C547; }
  .sc-sticky {
    position: fixed; left: 0; right: 0; z-index: 70;
    bottom: var(--tdg-cookie-offset, 0px);
    padding: 0.55rem 0.85rem max(0.65rem, env(safe-area-inset-bottom));
    background: linear-gradient(180deg, transparent, rgba(8,3,5,0.92) 35%);
    display: flex; justify-content: center;
    width: 100%; box-sizing: border-box;
  }
  .sc-cta-sticky { width: min(100%, 22rem); margin-top: 0; }
  @media (max-width: 390px) {
    .sc-hero { min-height: min(50dvh, 22rem); padding-top: max(3.25rem, 8dvh); }
    .sc-title { font-size: clamp(1.55rem, 7vw, 2.05rem); }
    .sc-seg button { padding: 0.26rem 0.55rem; font-size: 0.7rem; }
    .sc-form-row { grid-template-columns: 1fr; }
  }
  @media (min-width: 900px) {
    .sc-sticky { display: none; }
    .sc-main { max-width: 28rem; }
    .sc-hero { min-height: min(72vh, 36rem); }
    .sc-cta { width: auto; max-width: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sc-cta { box-shadow: none; }
  }
`;
