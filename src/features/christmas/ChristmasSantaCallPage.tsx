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

export default function ChristmasSantaCallPage() {
  const [params, setSearchParams] = useSearchParams();
  const previewOk = isSantaCallLandingPreviewAllowed(window.location.search);
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
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    currency: string;
    orderId?: string;
  } | null>(null);
  const [successNote, setSuccessNote] = useState(false);
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
      const orderId = params.get("order_id") || params.get("orderId") || "";
      if (orderId) {
        trackSantaCallMetaPurchase({
          orderId,
          amountCents: prices.initialMinor,
          currency: prices.currency,
        });
      }
    }
  }, [params, prices.currency, prices.initialMinor]);

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
    void fetchChristmasCommercialOffers()
      .then((rows) => {
        if (cancelled) return;
        const offer = catalogFromRows(rows as any).find((item) => item.key === SANTA_CALL_COMMERCIAL_KEY);
        // Sales stay off until public launch flag + commercial offer — preview never enables checkout.
        const ok = Boolean(offer?.active && offer.webCheckoutEnabled && offer.webPriceMinor > 0);
        setPurchasable(ok && isSantaCallLandingPublic());
      })
      .catch(() => {
        if (!cancelled) setPurchasable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [previewOk]);

  const priceLabel = useMemo(
    () => formatSantaCallMoney(prices.initialMinor, prices.currency),
    [prices.currency, prices.initialMinor],
  );
  const extensionLabel = useMemo(
    () => formatSantaCallMoney(prices.extensionMinor, prices.currency),
    [prices.currency, prices.extensionMinor],
  );

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (!purchasable) {
      setError("checkout_disabled");
      return;
    }
    setBusy(true);
    try {
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
          <style>{`
            .sc-gated { min-height: 100dvh; background: linear-gradient(160deg,#1a0b0d,#3b0610 55%,#0f3d2e); color:#F7F0E4; padding: 24px; }
            .sc-gated-main { max-width: 36rem; margin: 12vh auto; }
            .sc-brand { color: #e8c547; text-decoration: none; font-size: 1.25rem; }
            .sc-kicker { letter-spacing: .14em; text-transform: uppercase; font-size: .75rem; opacity: .8; }
            .sc-title { font-size: clamp(1.8rem, 5vw, 2.6rem); line-height: 1.15; margin: .5rem 0 1rem; }
            .sc-body { opacity: .9; line-height: 1.55; }
            .sc-cta { display: inline-block; margin-top: 1.5rem; color: #0f3d2e; background: #e8c547; padding: .75rem 1.25rem; border-radius: 999px; text-decoration: none; font-weight: 600; }
            .santa-call-display { font-family: "Cormorant Garamond", Georgia, serif; }
          `}</style>
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
          <NorthPoleScene variant="immersive" listening />
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
            <p className="sc-kicker">{copy.kicker}</p>
            <h1 className="santa-call-display sc-title">{copy.title}</h1>
            <p className="sc-sub">{copy.subtitle}</p>
            <p className="sc-price">
              {priceLabel}
              <span className="sc-price-ext"> · {copy.pricingExtension.split("—")[0].trim()} {extensionLabel}</span>
            </p>
            {!purchasable ? <p className="sc-soon">{copy.comingSoon}</p> : null}
            {successNote ? <p className="sc-success">{copy.successNote}</p> : null}
            <button type="button" className="sc-cta" onClick={scrollToForm}>
              {copy.cta}
            </button>
            <p className="sc-ai">{copy.ai}</p>
          </section>

          <section className="sc-section">
            <h2 className="santa-call-display sc-h2">{copy.processTitle}</h2>
            <ol className="sc-steps">
              {copy.process.map((step, i) => (
                <li key={step}>
                  <span>{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          <section className="sc-section">
            <h2 className="santa-call-display sc-h2">{copy.specialTitle}</h2>
            <ul className="sc-bullets">
              {copy.special.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="sc-section">
            <h2 className="santa-call-display sc-h2">{copy.previewTitle}</h2>
            <p className="sc-body">{copy.previewBody}</p>
            <p className="sc-example">{copy.example}</p>
          </section>

          <section className="sc-section">
            <h2 className="santa-call-display sc-h2">{copy.visualTitle}</h2>
            <p className="sc-body">{copy.visualBody}</p>
            <div className="sc-visual-card">
              <NorthPoleScene variant="card" listening />
            </div>
          </section>

          <section className="sc-section sc-pricing">
            <h2 className="santa-call-display sc-h2">{copy.pricingTitle}</h2>
            <div className="sc-price-rows">
              <div>
                <strong>{copy.pricingInitial}</strong>
                <span>{priceLabel}</span>
              </div>
              <div>
                <strong>{copy.pricingExtension}</strong>
                <span>{extensionLabel}</span>
              </div>
            </div>
            <p className="sc-body">{copy.duration}</p>
          </section>

          <section
            className="sc-section"
            id="personalize"
            ref={(el) => {
              formRef.current = el;
            }}
          >
            <h2 className="santa-call-display sc-h2">{copy.formTitle}</h2>
            <div className="sc-form">
              <label>
                <span>{copy.name} *</span>
                <input
                  value={form.childFirstName}
                  maxLength={40}
                  onChange={(e) => setForm((f) => ({ ...f, childFirstName: e.target.value }))}
                />
              </label>
              <label>
                <span>{copy.language} *</span>
                <select
                  value={lang}
                  onChange={(e) => onLang(e.target.value as SantaCallLanguage)}
                >
                  <option value="ro">Română</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="sc-check">
                <input
                  type="checkbox"
                  checked={form.languageMode === "auto"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, languageMode: e.target.checked ? "auto" : "fixed" }))
                  }
                />
                <span>{copy.languageAuto}</span>
              </label>
              <label>
                <span>{copy.marketLabel}</span>
                <select
                  value={market}
                  disabled={marketLocked || Boolean(checkout)}
                  onChange={(e) => onMarket(e.target.value as SantaCallMarket)}
                >
                  <option value="ro">{pricesForSantaCallMarket("ro")[lang === "ro" ? "labelRo" : "labelEn"]}</option>
                  <option value="us">{pricesForSantaCallMarket("us")[lang === "ro" ? "labelRo" : "labelEn"]}</option>
                </select>
              </label>
              <label>
                <span>{copy.email}</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>
              <label>
                <span>{copy.age}</span>
                <input
                  inputMode="numeric"
                  value={form.age}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, age: e.target.value.replace(/[^\d]/g, "").slice(0, 2) }))
                  }
                />
              </label>
              <label>
                <span>{copy.wish}</span>
                <textarea
                  maxLength={160}
                  value={form.christmasWish}
                  onChange={(e) => setForm((f) => ({ ...f, christmasWish: e.target.value }))}
                />
              </label>
              <label>
                <span>{copy.hobbies}</span>
                <input
                  maxLength={120}
                  value={form.hobbies}
                  onChange={(e) => setForm((f) => ({ ...f, hobbies: e.target.value }))}
                />
              </label>
              <label>
                <span>{copy.pet}</span>
                <input
                  maxLength={40}
                  value={form.petName}
                  onChange={(e) => setForm((f) => ({ ...f, petName: e.target.value }))}
                />
              </label>
              <label>
                <span>{copy.detail}</span>
                <textarea
                  maxLength={160}
                  value={form.positiveDetail}
                  onChange={(e) => setForm((f) => ({ ...f, positiveDetail: e.target.value }))}
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
                <p className="sc-error">
                  {error === "consent"
                    ? copy.errorConsent
                    : error === "checkout_disabled"
                      ? copy.errorCheckoutDisabled
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
                  {busy ? "…" : `${copy.cta} · ${priceLabel}`}
                </button>
              ) : (
                <div className="sc-stripe">
                  <p className="sc-charge">
                    {formatSantaCallMoney(checkout.amountCents, checkout.currency)} · {checkout.currency.toUpperCase()}
                  </p>
                  <CustomStripeCheckout
                    clientSecret={checkout.clientSecret}
                    publishableKey={checkout.publishableKey}
                    dueDisplay={formatSantaCallMoney(checkout.amountCents, checkout.currency)}
                    email={form.email}
                  />
                </div>
              )}
            </div>
          </section>

          <section className="sc-section">
            <h2 className="santa-call-display sc-h2">{copy.faqTitle}</h2>
            <div className="sc-faq">
              {copy.faqs.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="sc-section sc-final">
            <h2 className="santa-call-display sc-h2">{copy.finalCtaTitle}</h2>
            <p className="sc-body">{copy.finalCtaBody}</p>
            <button type="button" className="sc-cta" onClick={scrollToForm}>
              {copy.cta}
            </button>
            <p className="sc-fine">
              {copy.parents} {copy.policy} {copy.tech}
            </p>
            <p className="sc-links">
              <Link to="/privacy">{copy.privacyLink}</Link>
              <Link to="/support">{copy.supportLink}</Link>
            </p>
          </section>
        </main>

        <div className="sc-sticky">
          <button type="button" className="sc-cta sc-cta-sticky" onClick={scrollToForm}>
            {copy.ctaSticky} · {priceLabel}
          </button>
        </div>

        <style>{`
          .santa-call-display { font-family: "Cormorant Garamond", Georgia, serif; }
          .sc-page {
            font-family: "Source Sans 3", system-ui, sans-serif;
            color: #F7F0E4;
            background: #12080a;
            min-height: 100vh;
            position: relative;
          }
          .sc-hero-stage {
            position: absolute; inset: 0 0 auto 0; height: min(92vh, 920px);
            z-index: 0; pointer-events: none; overflow: hidden;
          }
          .sc-header {
            position: relative; z-index: 5;
            display: flex; align-items: center; justify-content: space-between; gap: 1rem;
            padding: max(0.85rem, env(safe-area-inset-top)) 1.1rem 0.5rem;
            max-width: 56rem; margin: 0 auto;
          }
          .sc-brand { color: #F7E7B0; text-decoration: none; font-size: 1.35rem; font-weight: 700; text-shadow: 0 2px 12px rgba(0,0,0,.5); }
          .sc-controls { display: flex; gap: 0.45rem; flex-wrap: wrap; justify-content: flex-end; }
          .sc-seg {
            display: inline-flex; border-radius: 999px; overflow: hidden;
            border: 1px solid rgba(255,255,255,0.18); background: rgba(0,0,0,0.35);
            backdrop-filter: blur(8px);
          }
          .sc-seg button {
            border: 0; background: transparent; color: #F7F0E4; padding: 0.28rem 0.7rem;
            font-size: 0.78rem; font-weight: 600; cursor: pointer;
          }
          .sc-seg button.is-on { background: #7a1520; }
          .sc-seg button:disabled { opacity: 0.45; cursor: not-allowed; }
          .sc-main {
            position: relative; z-index: 2;
            max-width: 40rem; margin: 0 auto;
            padding: 1.25rem 1.1rem calc(5.5rem + env(safe-area-inset-bottom));
          }
          .sc-hero { padding-top: min(18vh, 8rem); text-shadow: 0 2px 18px rgba(0,0,0,.55); }
          .sc-kicker { margin: 0; font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase; color: #E8C547; }
          .sc-title { margin: 0.45rem 0 0; font-size: clamp(1.85rem, 7vw, 2.75rem); line-height: 1.12; font-weight: 700; }
          .sc-sub { margin: 0.85rem 0 0; font-size: 1.05rem; line-height: 1.55; max-width: 36rem; }
          .sc-price { margin: 0.9rem 0 0; font-size: 1.2rem; font-weight: 700; color: #E8C547; }
          .sc-price-ext { display: block; margin-top: 0.2rem; font-size: 0.86rem; font-weight: 500; opacity: 0.9; color: #F7F0E4; }
          .sc-soon, .sc-success {
            margin-top: 0.85rem; padding: 0.7rem 0.85rem; border-radius: 0.9rem; font-size: 0.86rem; line-height: 1.45;
            border: 1px solid rgba(232,197,71,0.35); background: rgba(10,6,8,0.55);
          }
          .sc-cta {
            margin-top: 1.1rem; border: 0; border-radius: 999px; padding: 0.9rem 1.25rem;
            font-size: 1.02rem; font-weight: 700; color: #F7F0E4; cursor: pointer;
            background: linear-gradient(180deg, #1a5a42 0%, #0f3d2e 100%);
            box-shadow: 0 12px 28px rgba(0,0,0,0.35);
          }
          .sc-cta:disabled { opacity: 0.5; cursor: not-allowed; }
          .sc-ai { margin: 0.85rem 0 0; font-size: 0.8rem; line-height: 1.45; opacity: 0.82; max-width: 34rem; }
          .sc-section { margin-top: 2.75rem; }
          .sc-h2 { margin: 0; font-size: 1.55rem; font-weight: 700; }
          .sc-body { margin: 0.65rem 0 0; line-height: 1.55; opacity: 0.92; }
          .sc-steps { list-style: none; margin: 1rem 0 0; padding: 0; display: grid; gap: 0.7rem; }
          .sc-steps li { display: grid; grid-template-columns: 1.6rem 1fr; gap: 0.55rem; line-height: 1.5; }
          .sc-steps span { color: #E8C547; font-weight: 700; }
          .sc-bullets { margin: 0.85rem 0 0; padding-left: 1.1rem; display: grid; gap: 0.45rem; line-height: 1.5; }
          .sc-example { margin: 0.85rem 0 0; font-style: italic; color: #F7E7B0; line-height: 1.55; }
          .sc-visual-card { margin-top: 1rem; }
          .sc-price-rows { margin-top: 0.9rem; display: grid; gap: 0.55rem; }
          .sc-price-rows > div {
            display: flex; justify-content: space-between; gap: 1rem; align-items: baseline;
            padding: 0.75rem 0.9rem; border-radius: 0.9rem;
            background: rgba(0,0,0,0.28); border: 1px solid rgba(255,255,255,0.1);
          }
          .sc-form {
            margin-top: 1rem; display: grid; gap: 0.85rem;
            padding: 1.1rem; border-radius: 1.25rem;
            background: rgba(26, 8, 12, 0.72); border: 1px solid rgba(232,197,71,0.22);
            backdrop-filter: blur(10px);
          }
          .sc-form label { display: grid; gap: 0.3rem; font-size: 0.86rem; }
          .sc-form input, .sc-form select, .sc-form textarea {
            border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.16);
            background: rgba(0,0,0,0.28); color: inherit; padding: 0.55rem 0.7rem; outline: none;
          }
          .sc-form textarea { min-height: 4.2rem; }
          .sc-check { display: flex !important; grid-template-columns: none; align-items: flex-start; gap: 0.65rem; }
          .sc-check input { margin-top: 0.2rem; }
          .sc-error { margin: 0; color: #ffb4b4; font-size: 0.86rem; }
          .sc-charge { margin: 0 0 0.6rem; font-weight: 600; color: #E8C547; }
          .sc-faq { margin-top: 0.85rem; display: grid; gap: 0.55rem; }
          .sc-faq details {
            border-radius: 0.9rem; padding: 0.75rem 0.9rem;
            background: rgba(0,0,0,0.28); border: 1px solid rgba(255,255,255,0.1);
          }
          .sc-faq summary { cursor: pointer; font-weight: 600; }
          .sc-faq p { margin: 0.55rem 0 0; line-height: 1.5; opacity: 0.9; }
          .sc-fine { margin-top: 1rem; font-size: 0.78rem; line-height: 1.5; opacity: 0.75; }
          .sc-links { display: flex; gap: 1rem; margin-top: 0.75rem; }
          .sc-links a { color: #E8C547; }
          .sc-sticky {
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
            padding: 0.65rem 1rem max(0.65rem, env(safe-area-inset-bottom));
            background: linear-gradient(180deg, transparent, rgba(8,3,5,0.92) 35%);
            display: flex; justify-content: center;
          }
          .sc-cta-sticky { width: min(100%, 24rem); margin-top: 0; }
          @media (min-width: 900px) {
            .sc-sticky { display: none; }
            .sc-main { max-width: 44rem; padding-top: 1.5rem; }
          }
        `}</style>
      </div>
    </>
  );
}
