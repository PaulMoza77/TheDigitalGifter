import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { parseChristmasLocalePath } from "@/features/christmas/seo/localeRouting";
import { normalizeWave1GenerationLocale } from "@/features/christmas/i18n/wave1Locale";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { AmbientSnow } from "../landing/AmbientSnow";
import { FONT_HREF } from "../landing/assets";
import "../landing/ChristmasLanding.css";
import { CHRISTMAS_PORTRAIT_VERTICALS } from "../portraitVerticals";
import { useChristmasPortraitFunnel } from "../useChristmasPortraitFunnel";
import { BeforeAfterSlider } from "../photoGenerator/BeforeAfterSlider";
import "../photoGenerator/PhotoGenerator.css";
import {
  cardsUrlFromPortrait,
  writeLastPortraitResult,
  writePortraitToCardHandoff,
} from "../cards/portraitHandoff";
import { trackChristmasEvent } from "../analytics";
import {
  FAMILY_ASSETS,
  FAMILY_GALLERY,
  FAMILY_SCENE_CARDS,
  FAMILY_STYLE_CHIPS,
  STYLE_PREVIEW_BY_KEY,
} from "./assets";
import { trackFamilyEvent } from "./analytics";
import {
  FAMILY_FAQS,
  familyDir,
  familyT,
  type FamilyLocale,
} from "./copy";
import {
  photoStyleDescription,
  photoStyleLabel,
  type PhotoGenLocale,
} from "../photoGenerator/copy";
import "./FamilyPortrait.css";
import { familyPortraitJsonLd, familyPortraitSeo, upsertJsonLd } from "./seo";

const VERTICAL = CHRISTMAS_PORTRAIT_VERTICALS.family;

function ensureFonts() {
  if (document.querySelector(`link[data-xmas-fonts="1"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  link.setAttribute("data-xmas-fonts", "1");
  document.head.appendChild(link);
}

function GenerationMessages({
  active,
  locale,
}: {
  active: boolean;
  locale: FamilyLocale;
}) {
  const keys = ["gen.step1", "gen.step2", "gen.step3", "gen.step4"] as const;
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) return;
    setIdx(0);
    const id = window.setInterval(() => {
      setIdx((i) => Math.min(i + 1, keys.length - 1));
    }, 4200);
    return () => window.clearInterval(id);
  }, [active, keys.length]);
  return <p className="pg-gen__msg">{familyT(keys[idx], locale)}</p>;
}

export default function ChristmasFamilyExperience() {
  const location = useLocation();
  const locale = normalizeWave1GenerationLocale(
    parseChristmasLocalePath(location.pathname).locale,
  ) as FamilyLocale;
  const photoLocale = locale as PhotoGenLocale;
  const t = useCallback((key: string) => familyT(key, locale), [locale]);
  const seo = useMemo(() => familyPortraitSeo(locale), [locale]);
  const [activeChip, setActiveChip] = useState(FAMILY_STYLE_CHIPS[0]!.styleKey);
  const [dragOver, setDragOver] = useState(false);
  const [resultMode, setResultMode] = useState<"christmas" | "original">("christmas");

  const chip = FAMILY_STYLE_CHIPS.find((c) => c.styleKey === activeChip) ?? FAMILY_STYLE_CHIPS[0]!;
  const afterPreview = STYLE_PREVIEW_BY_KEY[chip.styleKey] || FAMILY_ASSETS.familyAfter;

  const funnel = useChristmasPortraitFunnel({
    vertical: VERTICAL,
    mode: "vertical",
    onPageView: () => {
      void trackFamilyEvent("christmas_family_page_view", {
        productKey: "christmas_family",
      });
    },
    onUploadStarted: () => {
      void trackFamilyEvent("christmas_family_upload_started");
    },
    onUploadCompleted: () => {
      void trackFamilyEvent("christmas_family_upload_completed");
    },
    onStyleSelected: (styleKey) => {
      void trackFamilyEvent("christmas_family_style_selected", { styleKey });
    },
    onGenerationStarted: () => {
      void trackFamilyEvent("christmas_family_generation_started");
    },
    onGenerationCompleted: (orderId) => {
      void trackFamilyEvent("christmas_family_generation_completed", { orderId });
    },
    onDownload: () => {
      void trackFamilyEvent("christmas_family_downloaded");
    },
    onShare: () => {
      void trackFamilyEvent("christmas_family_shared");
    },
    onStyleRetry: () => {
      void trackFamilyEvent("christmas_family_style_retry");
    },
  });

  useEffect(() => {
    ensureFonts();
    upsertJsonLd("christmas-family-jsonld", familyPortraitJsonLd(locale));
    return () => {
      document.getElementById("christmas-family-jsonld")?.remove();
    };
  }, []);

  const showLanding =
    funnel.draft.step === "intro" ||
    (funnel.draft.step === "upload" && !funnel.draft.localPreviewUrl);

  useEffect(() => {
    if (showLanding) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [funnel.draft.step, showLanding]);

  useEffect(() => {
    if (funnel.draft.step !== "result" || !funnel.resultUrl) return;
    writeLastPortraitResult({
      imageUrl: funnel.resultUrl,
      verticalId: "family",
      productKey: funnel.activeProductKey,
      orderId: funnel.draft.orderId,
    });
  }, [
    funnel.draft.step,
    funnel.resultUrl,
    funnel.draft.orderId,
    funnel.activeProductKey,
  ]);

  const friendlyError = (raw: string | null) => {
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (lower.includes("network") || lower.includes("fetch")) return t("error.network");
    if (lower.includes("photo") || lower.includes("image") || lower.includes("heic")) {
      return raw.length < 160 ? raw : t("error.unsupported");
    }
    if (lower.includes("generat") || lower.includes("magic")) return t("error.generation");
    if (raw.length > 180) return t("error.generic");
    return raw;
  };

  const scrollToCreate = () => {
    document.getElementById("christmas-family-create")?.scrollIntoView({ behavior: "smooth" });
  };

  const openUpload = () => {
    scrollToCreate();
    funnel.openFilePicker();
  };

  return (
    <>
      <ChristmasPageHead path="/christmas/family" image={seo.image} />
      <article className="xmas-landing ff-page" dir={familyDir(locale)} lang={locale}>
        <a className="xmas-skip" href="#christmas-family-create">
          {t("hero.cta")}
        </a>
        <AmbientSnow />

        {showLanding ? (
          <>
            <header className="ff-hero" aria-labelledby="family-hero-title">
              <div className="ff-hero__stage" aria-hidden="true">
                <img
                  className="ff-hero__room"
                  src={FAMILY_ASSETS.room}
                  alt=""
                  width={1280}
                  height={720}
                  fetchPriority="high"
                  decoding="async"
                />
                <div className="ff-hero__veil" />
                <div className="ff-hero__fire" />
                <div className="ff-hero__twinkle" />
                <div className="ff-hero__snow-window" />
              </div>

              <div className="ff-hero__layout">
                <div className="ff-hero__visual">
                  <div className="ff-table">
                    <div className="ff-table__wood" />
                    <figure className="ff-frame">
                      <img
                        src={FAMILY_ASSETS.familyBefore}
                        alt={t("examples.before")}
                        width={360}
                        height={480}
                        fetchPriority="high"
                        decoding="async"
                      />
                    </figure>
                    <figure className="ff-card" key={chip.styleKey}>
                      <img
                        src={afterPreview}
                        alt={t("examples.after")}
                        width={400}
                        height={520}
                        decoding="async"
                      />
                      <figcaption className="ff-card__caption">{t(chip.labelKey)}</figcaption>
                    </figure>
                    <span className="ff-prop ff-prop--candle" aria-hidden="true" />
                    <span className="ff-prop ff-prop--gift" aria-hidden="true" />
                  </div>

                  <div className="ff-ba-wrap ff-ba-wrap--desktop">
                    <BeforeAfterSlider
                      key={chip.styleKey}
                      beforeSrc={FAMILY_ASSETS.familyBefore}
                      afterSrc={afterPreview}
                      beforeAlt="Everyday family photo"
                      afterAlt="Christmas family portrait"
                      beforeLabel={t("hero.beforeLabel")}
                      afterLabel={t("hero.afterLabel")}
                      ariaLabel={t("hero.sliderAria")}
                      eager
                    />
                  </div>
                </div>

                <div className="ff-hero__copy">
                  <nav aria-label="Breadcrumb">
                    <ol className="ff-breadcrumbs">
                      <li>
                        <Link to="/christmas">{t("nav.hub")}</Link>
                      </li>
                      <li aria-hidden="true">/</li>
                      <li>Family</li>
                    </ol>
                  </nav>
                  <p className="xmas-kicker">{t("hero.kicker")}</p>
                  <h1 id="family-hero-title">{t("hero.h1")}</h1>
                  <p className="xmas-lede">{t("hero.lede")}</p>
                  <div className="xmas-actions">
                    <button
                      type="button"
                      className="xmas-btn xmas-btn--gold"
                      onClick={openUpload}
                    >
                      {t("hero.cta")}
                    </button>
                  </div>
                  <p className="ff-hero__cta-note">
                    {t("hero.privacy")}
                    <span>{t("hero.hint")}</span>
                  </p>

                  <div className="ff-chips" role="tablist" aria-label={t("hero.stylesAria")}>
                    {FAMILY_STYLE_CHIPS.map((item) => (
                      <button
                        key={item.styleKey}
                        type="button"
                        role="tab"
                        className="ff-chip"
                        aria-selected={activeChip === item.styleKey}
                        aria-pressed={activeChip === item.styleKey}
                        onClick={() => setActiveChip(item.styleKey)}
                      >
                        <img src={item.preview} alt="" loading="lazy" />
                        {t(item.labelKey)}
                      </button>
                    ))}
                  </div>

                  <div className="ff-ba-wrap ff-ba-wrap--mobile">
                    <BeforeAfterSlider
                      key={`m-${chip.styleKey}`}
                      beforeSrc={FAMILY_ASSETS.familyBefore}
                      afterSrc={afterPreview}
                      beforeAlt="Everyday family photo"
                      afterAlt="Christmas family portrait"
                      beforeLabel={t("hero.beforeLabel")}
                      afterLabel={t("hero.afterLabel")}
                      ariaLabel={t("hero.sliderAria")}
                    />
                  </div>

                  <div className="ff-trust-inline" aria-label="Trust">
                    <p>
                      <strong>{t("trust.privateTitle")}</strong>
                      {t("trust.privateBody")}
                    </p>
                    <p>
                      <strong>{t("trust.memoriesTitle")}</strong>
                      {t("trust.memoriesBody")}
                    </p>
                    <p>
                      <strong>{t("trust.stylesTitle")}</strong>
                      {t("trust.stylesBody")}
                    </p>
                  </div>
                </div>
              </div>
            </header>

            <section
              className="ff-section"
              id="christmas-family-create"
              aria-labelledby="family-upload-heading"
            >
              <div
                className={`ff-upload ${dragOver ? "is-drag" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0] || null;
                  void funnel.onFileChosen(file);
                }}
              >
                <p className="xmas-kicker">{t("upload.kicker")}</p>
                <h2 id="family-upload-heading">{t("upload.h2")}</h2>
                <p className="xmas-lede">{t("upload.lede")}</p>
                {funnel.draft.lastError ? (
                  <p className="ff-alert" role="alert">
                    {friendlyError(funnel.draft.lastError)}
                  </p>
                ) : null}
                <div className="xmas-actions" style={{ marginTop: "1.25rem" }}>
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--gold"
                    disabled={funnel.busy}
                    onClick={() => funnel.openFilePicker()}
                  >
                    {funnel.busy ? t("busy.uploading") : t("upload.choose")}
                  </button>
                  <span className="xmas-lede" style={{ margin: 0, fontSize: "0.92rem" }}>
                    {t("upload.drop")}
                  </span>
                </div>
                <p className="ff-hero__cta-note">
                  {t("upload.privacy")}
                  <span>{t("upload.hint")}</span>
                </p>
              </div>
            </section>

            <section className="ff-section" aria-labelledby="family-moment-heading">
              <div className="ff-moment">
                <div className="ff-moment__visual">
                  <img
                    src={FAMILY_ASSETS.finale}
                    alt=""
                    loading="lazy"
                    width={900}
                    height={600}
                  />
                  <div className="ff-moment__glow" aria-hidden="true" />
                </div>
                <div>
                  <p className="xmas-kicker">{t("moment.kicker")}</p>
                  <h2 id="family-moment-heading">{t("moment.h2")}</h2>
                  <p
                    className="xmas-display"
                    style={{
                      margin: "0.75rem 0 0",
                      fontSize: "clamp(1.55rem, 3.4vw, 2.35rem)",
                      lineHeight: 1.15,
                      color: "#fffaf1",
                    }}
                  >
                    {t("moment.title")}
                  </p>
                  <p className="xmas-lede">{t("moment.lede")}</p>
                  <div className="xmas-actions">
                    <button type="button" className="xmas-btn xmas-btn--gold" onClick={openUpload}>
                      {t("moment.cta")}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section
              className="ff-section ff-section--atmosphere"
              aria-labelledby="family-examples-heading"
            >
              <div className="ff-section__inner">
                <p className="xmas-kicker">{t("moment.kicker")}</p>
                <h2 id="family-examples-heading">{t("examples.h2")}</h2>
                <p className="xmas-lede">{t("examples.lede")}</p>
                <p className="xmas-lede" style={{ fontSize: "0.85rem" }}>
                  {t("examples.demoNote")}
                </p>
                <div className="ff-gallery">
                  {FAMILY_GALLERY.map((item) => (
                    <figure key={item.id} className="ff-gallery__item">
                      <img
                        src={item.after}
                        alt={`${t(item.labelKey)} — ${t("examples.after")}`}
                        loading="lazy"
                      />
                      <div className="ff-gallery__meta">
                        <strong>{t(item.labelKey)}</strong>
                        <span>{t("examples.after")}</span>
                      </div>
                    </figure>
                  ))}
                </div>
              </div>
            </section>

            <section
              className="ff-section ff-section--atmosphere"
              aria-labelledby="family-styles-heading"
            >
              <div className="ff-section__inner">
                <h2 id="family-styles-heading">{t("styles.h2")}</h2>
                <p className="xmas-lede">{t("styles.lede")}</p>
                <div className="ff-scenes">
                  {FAMILY_SCENE_CARDS.map((scene) => (
                    <button
                      key={scene.id}
                      type="button"
                      className="ff-scene"
                      onClick={() => {
                        setActiveChip(scene.styleKey);
                        openUpload();
                      }}
                    >
                      <img
                        src={scene.image}
                        alt={`${t(scene.titleKey)} family Christmas portrait style`}
                        loading="lazy"
                      />
                      <span className="ff-scene__body">
                        <strong>{t(scene.titleKey)}</strong>
                        <span>{t(scene.descKey)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="ff-section" aria-labelledby="family-best-heading">
              <div className="ff-section__inner">
                <h2 id="family-best-heading">{t("best.h2")}</h2>
                <p className="xmas-lede">{t("best.body")}</p>
                <div className="xmas-actions" style={{ marginTop: "1rem" }}>
                  <Link className="xmas-btn xmas-btn--ghost" to="/christmas/cards">
                    Turn your family portrait into a Christmas card
                  </Link>
                </div>
              </div>
            </section>

            <section className="ff-section" aria-labelledby="family-how-heading">
              <h2 id="family-how-heading">{t("how.h2")}</h2>
              <div className="ff-how">
                <div className="ff-how__item">
                  <div className="ff-how__ornament" aria-hidden="true">
                    1
                  </div>
                  <h3>{t("how.1.title")}</h3>
                  <p>{t("how.1.body")}</p>
                </div>
                <div className="ff-how__item">
                  <div className="ff-how__ornament" aria-hidden="true">
                    2
                  </div>
                  <h3>{t("how.2.title")}</h3>
                  <p>{t("how.2.body")}</p>
                </div>
                <div className="ff-how__item">
                  <div className="ff-how__ornament" aria-hidden="true">
                    3
                  </div>
                  <h3>{t("how.3.title")}</h3>
                  <p>{t("how.3.body")}</p>
                </div>
              </div>
            </section>

            <section className="ff-section ff-geo" aria-labelledby="family-geo-heading">
              <h2 id="family-geo-heading">{t("geo.h2")}</h2>
              <p>{t("geo.body")}</p>
              <dl>
                <dt>{t("geo.best")}</dt>
                <dd>{t("geo.bestBody")}</dd>
                <dt>{t("geo.support")}</dt>
                <dd>{t("geo.supportBody")}</dd>
                <dt>{t("geo.privacy")}</dt>
                <dd>{t("geo.privacyBody")}</dd>
              </dl>
            </section>

            <section className="ff-section ff-faq" aria-labelledby="family-faq-heading">
              <h2 id="family-faq-heading">{t("faq.h2")}</h2>
              {FAMILY_FAQS.map((item) => (
                <details key={item.qKey}>
                  <summary>{t(item.qKey)}</summary>
                  <p>{t(item.aKey)}</p>
                </details>
              ))}
            </section>
          </>
        ) : null}

        <div className={showLanding ? "sr-only" : "ff-studio"} aria-hidden={showLanding}>
          <div className="ff-studio__panel">
            {funnel.draft.lastError && !showLanding ? (
              <p className="ff-alert" role="alert">
                {friendlyError(funnel.draft.lastError)}
              </p>
            ) : null}

            {funnel.draft.step === "style" && (
              <section>
                {funnel.draft.localPreviewUrl ? (
                  <img
                    className="pg-preview-thumb"
                    src={funnel.draft.localPreviewUrl}
                    alt=""
                  />
                ) : null}
                <h2>{t("style.h2")}</h2>
                <p className="xmas-lede">{t("style.lede")}</p>
                <div className="pg-style-grid">
                  {funnel.styles.map((style) => (
                    <button
                      key={style.styleKey}
                      type="button"
                      className="pg-style"
                      disabled={funnel.busy}
                      onClick={() => void funnel.onStylePick(style.styleKey)}
                    >
                      <img
                        className="pg-style__img"
                        src={STYLE_PREVIEW_BY_KEY[style.styleKey] || FAMILY_ASSETS.familyAfter}
                        alt=""
                        loading="lazy"
                      />
                      <div className="pg-style__body">
                        <div className="pg-style__name">{photoStyleLabel(style.styleKey, photoLocale, style.displayName)}</div>
                        <p className="pg-style__desc">{photoStyleDescription(style.styleKey, photoLocale, style.description)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {funnel.draft.step === "preview" && funnel.draft.blurredPreviewUrl && (
              <section>
                <img
                  className="pg-preview-thumb"
                  src={funnel.draft.blurredPreviewUrl}
                  alt=""
                />
                <h2>{t("preview.h2")}</h2>
                <p className="xmas-lede">{t("preview.lede")}</p>
                <p className="xmas-lede" style={{ fontSize: "0.9rem" }}>
                  {funnel.styleName}
                </p>
                <button type="button" className="xmas-btn xmas-btn--gold" onClick={funnel.goOffer}>
                  {t("preview.continue")}
                </button>
              </section>
            )}

            {funnel.draft.step === "offer" && (
              <section>
                <h2>{t("offer.h2")}</h2>
                <ul className="pg-guide">
                  <li>{funnel.styleName || funnel.draft.styleKey}</li>
                  <li>{t("offer.deliverable")}</li>
                  <li>{t("offer.ready")}</li>
                  <li>{t("offer.private")}</li>
                </ul>
                <label className="pg-email">
                  {t("offer.email")}
                  <input
                    type="email"
                    value={funnel.draft.email}
                    onChange={(e) =>
                      funnel.setDraft((d) => ({ ...d, email: e.target.value }))
                    }
                    autoComplete="email"
                  />
                </label>
                {funnel.purchasable && funnel.catalogAmount != null ? (
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--gold"
                    style={{ marginTop: "1rem", width: "100%" }}
                    disabled={funnel.busy}
                    onClick={() => void funnel.startCheckout()}
                  >
                    {funnel.busy ? t("offer.busy") : t("offer.pay")}
                  </button>
                ) : (
                  <p className="ff-warn">{t("offer.disabled")}</p>
                )}
              </section>
            )}

            {funnel.draft.step === "checkout" && funnel.checkout && (
              <section>
                <h2>{t("checkout.h2")}</h2>
                <CustomStripeCheckout
                  clientSecret={funnel.checkout.clientSecret}
                  publishableKey={funnel.checkout.publishableKey}
                  dueDisplay={`$${(funnel.checkout.amountCents / 100).toFixed(2)}`}
                  email={funnel.draft.email}
                  onReady={() => undefined}
                />
              </section>
            )}

            {funnel.draft.step === "generating" && (
              <section className="pg-gen" aria-live="polite">
                <div className="pg-gen__pulse" aria-hidden="true" />
                <h2 className="visually-hidden">{t("gen.h2")}</h2>
                <GenerationMessages active locale={locale} />
                <p className="xmas-lede" style={{ marginTop: "1rem" }}>
                  {t("gen.note")}
                </p>
              </section>
            )}

            {funnel.draft.step === "result" && funnel.resultUrl && (
              <section className="pg-result">
                <h2>{t("result.h2")}</h2>
                <div className="pg-toggle" role="group" aria-label="Original or Christmas">
                  <button
                    type="button"
                    aria-pressed={resultMode === "original"}
                    onClick={() => setResultMode("original")}
                  >
                    {t("result.toggleOriginal")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={resultMode === "christmas"}
                    onClick={() => setResultMode("christmas")}
                  >
                    {t("result.toggleChristmas")}
                  </button>
                </div>
                <img
                  src={
                    resultMode === "original" && funnel.draft.localPreviewUrl
                      ? funnel.draft.localPreviewUrl
                      : funnel.resultUrl
                  }
                  alt={t("result.h2")}
                />
                <div className="pg-result__actions">
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--gold"
                    onClick={() => void funnel.downloadResult()}
                  >
                    {t("result.download")}
                  </button>
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--ghost"
                    onClick={() => void funnel.shareResult()}
                  >
                    {t("result.share")}
                  </button>
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--ghost"
                    onClick={() => funnel.retryStyle()}
                  >
                    {t("result.retryStyle")}
                  </button>
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--ghost"
                    onClick={() => funnel.resetAnother()}
                  >
                    {t("result.another")}
                  </button>
                </div>
                <div className="pg-result__secondary">
                  <Link
                    to={cardsUrlFromPortrait()}
                    onClick={() => {
                      if (!funnel.resultUrl) return;
                      writePortraitToCardHandoff({
                        imageUrl: funnel.resultUrl,
                        source: "portrait_result",
                        verticalId: "family",
                        productKey: funnel.activeProductKey,
                        orderId: funnel.draft.orderId,
                      });
                      writeLastPortraitResult({
                        imageUrl: funnel.resultUrl,
                        verticalId: "family",
                        productKey: funnel.activeProductKey,
                        orderId: funnel.draft.orderId,
                      });
                      void trackFamilyEvent("christmas_family_card_cross_sell", {
                        orderId: funnel.draft.orderId,
                      });
                      void trackChristmasEvent("card_portrait_cross_sell_clicked", {
                        productKey: funnel.activeProductKey,
                        pathname: VERTICAL.routePath,
                        metadata: { placement: "family_result" },
                      });
                    }}
                  >
                    {t("result.card")}
                  </Link>
                  <Link to="/christmas/tree">{t("result.tree")}</Link>
                </div>
              </section>
            )}

            {funnel.draft.step === "error" && (
              <section>
                <h2>{t("error.generation")}</h2>
                <p className="xmas-lede">{t("error.paidKeepLink")}</p>
                <Link className="xmas-btn xmas-btn--gold" to="/christmas">
                  {t("nav.hub")}
                </Link>
              </section>
            )}
          </div>
        </div>

        <input
          ref={funnel.fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="pg-file-input"
          onChange={(e) => void funnel.onFileChosen(e.target.files?.[0] || null)}
        />

        <nav className="ff-section ff-nav" aria-label="Christmas portrait links">
          <Link to="/christmas">{t("nav.hub")}</Link>
          <Link to="/christmas/photo-generator">{t("nav.photo")}</Link>
          <Link to="/christmas/couples">{t("nav.couples")}</Link>
          <Link to="/christmas/pets">{t("nav.pets")}</Link>
          <Link to="/christmas/cards">{t("nav.cards")}</Link>
          <Link to="/christmas/tree">{t("nav.tree")}</Link>
        </nav>
      </article>
      <style>{`
        .visually-hidden, .sr-only {
          position: absolute !important;
          width: 1px; height: 1px;
          padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0);
          white-space: nowrap; border: 0;
        }
        .pg-file-input {
          position: absolute !important;
          width: 1px; height: 1px;
          padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0);
          white-space: nowrap; border: 0;
          opacity: 0;
        }
      `}</style>
    </>
  );
}
