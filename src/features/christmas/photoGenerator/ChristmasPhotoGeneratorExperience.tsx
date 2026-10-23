import { CHRISTMAS_PACKS, type ChristmasPackKey } from "../../christmas-v2/config";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { parseChristmasLocalePath } from "@/features/christmas/seo/localeRouting";
import { normalizeWave1GenerationLocale } from "@/features/christmas/i18n/wave1Locale";
import { AmbientSnow } from "../landing/AmbientSnow";
import { FONT_HREF } from "../landing/assets";
import "../landing/ChristmasLanding.css";
import { CHRISTMAS_PORTRAIT_VERTICALS } from "../portraitVerticals";
import { useChristmasPortraitFunnel } from "../useChristmasPortraitFunnel";
import {
  GALLERY_EXAMPLES,
  PHOTO_GEN_ASSETS,
  STYLE_PREVIEW_BY_KEY,
  type ExampleCategory,
} from "./assets";
import { trackPhotoGeneratorEvent } from "./analytics";
import { HeroBeforeAfter } from "./HeroBeforeAfter";
import {
  PHOTO_GEN_FAQS,
  photoGenDir,
  photoGenT,
  photoStyleDescription,
  photoStyleLabel,
  type PhotoGenLocale,
} from "./copy";
import "./PhotoGenerator.css";
import { photoGeneratorJsonLd, photoGeneratorSeo, upsertJsonLd } from "./seo";
import {
  cardsUrlFromPortrait,
  writeLastPortraitResult,
  writePortraitToCardHandoff,
} from "../cards/portraitHandoff";
import { trackChristmasEvent } from "../analytics";

const VERTICAL = CHRISTMAS_PORTRAIT_VERTICALS.photo;

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
  locale: PhotoGenLocale;
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
  return <p className="pg-gen__msg">{photoGenT(keys[idx], locale)}</p>;
}

export default function ChristmasPhotoGeneratorExperience() {
  const location = useLocation();
  const locale = normalizeWave1GenerationLocale(
    parseChristmasLocalePath(location.pathname).locale,
  ) as PhotoGenLocale;
  const t = useCallback((key: string) => photoGenT(key, locale), [locale]);
  const seo = useMemo(() => photoGeneratorSeo(locale), [locale]);
  const [packKey, setPackKey] = useState<ChristmasPackKey>(() => { const saved = sessionStorage.getItem("tdg.generations.pack"); return saved === "starter" || saved === "ultimate" ? saved : "magic"; });
  const [category, setCategory] = useState<ExampleCategory>("family");
  const [resultMode, setResultMode] = useState<"christmas" | "original">("christmas");

  const funnel = useChristmasPortraitFunnel({
    vertical: VERTICAL,
    mode: "hub",
    onPageView: () => {
      void trackPhotoGeneratorEvent("christmas_photo_generator_page_view", {
        productKey: "christmas_photo",
      });
    },
    onUploadStarted: () => {
      void trackPhotoGeneratorEvent("christmas_photo_upload_started");
    },
    onUploadCompleted: () => {
      void trackPhotoGeneratorEvent("christmas_photo_upload_completed");
    },
    onSubjectSelected: (subject) => {
      void trackPhotoGeneratorEvent("christmas_photo_subject_selected", { subject });
    },
    onStyleSelected: (styleKey) => {
      void trackPhotoGeneratorEvent("christmas_photo_style_selected", { styleKey });
    },
    onGenerationStarted: () => {
      void trackPhotoGeneratorEvent("christmas_photo_generation_started");
    },
    onGenerationCompleted: (orderId) => {
      void trackPhotoGeneratorEvent("christmas_photo_generation_completed", { orderId });
    },
    onDownload: () => {
      void trackPhotoGeneratorEvent("christmas_photo_downloaded");
    },
    onShare: () => {
      void trackPhotoGeneratorEvent("christmas_photo_shared");
    },
    onStyleRetry: () => {
      void trackPhotoGeneratorEvent("christmas_photo_style_retry");
    },
  });

  useEffect(() => {
    ensureFonts();
    upsertJsonLd("christmas-photo-generator-jsonld", photoGeneratorJsonLd(locale));
    return () => {
      document.getElementById("christmas-photo-generator-jsonld")?.remove();
    };
  }, [locale]);

  const showLanding =
    funnel.draft.step === "intro" ||
    funnel.draft.step === "upload";

  useEffect(() => {
    if (showLanding) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [funnel.draft.step, showLanding]);

  useEffect(() => {
    if (funnel.draft.step !== "result" || !funnel.resultUrl) return;
    writeLastPortraitResult({
      imageUrl: funnel.resultUrl,
      verticalId: "photo",
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

  return (
    <>
      <ChristmasPageHead path="/christmas/photo-generator" image={seo.image} />
      <article className="xmas-landing pg-page" dir={photoGenDir(locale)} lang={locale}>
        <a className="xmas-skip" href="#christmas-photo-create">
          {t("hero.cta")}
        </a>
        <AmbientSnow />

        {showLanding ? (
          <>
            <header className="pg-hero">
              <div className="pg-hero__copy">
                <h1>{t("seo.h1")}</h1>
                <p className="xmas-lede">{t("hero.lede")}</p>
                <div className="xmas-actions">
                  <button
                    type="button"
                    id="christmas-photo-create"
                    className="xmas-btn xmas-btn--gold"
                    disabled={funnel.busy}
                    onClick={() => {
                      funnel.openFilePicker();
                    }}
                  >
                    {t("hero.cta")}
                  </button>
                </div>
                {funnel.draft.lastError ? <p className="pg-alert" role="alert">{friendlyError(funnel.draft.lastError)}</p> : null}
                {funnel.busy ? <p role="status">{t("busy.uploading")}</p> : null}
              </div>
              <div className="pg-hero__visual">
                <HeroBeforeAfter
                  beforeLabel={t("hero.beforeLabel")}
                  afterLabel={t("hero.afterLabel")}
                  ariaLabel={t("hero.sliderAria")}
                  hint={t("hero.sliderHint")}
                />
              </div>
            </header>

            <section
              className="pg-section"
              id="christmas-photo-examples"
              aria-labelledby="examples-heading"
            >
              <p className="xmas-kicker">{t("hero.kicker")}</p>
              <h2 id="examples-heading">{t("examples.h2")}</h2>
              <p className="xmas-lede" style={{ fontSize: "0.85rem" }}>
                {t("examples.demoNote")}
              </p>
              <div className="xmas-tags" role="tablist" aria-label={t("category.aria")}>
                {(["family", "couples", "pets"] as ExampleCategory[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    className="xmas-tag"
                    aria-selected={category === key}
                    aria-pressed={category === key}
                    onClick={() => setCategory(key)}
                  >
                    {t(`category.${key}`)}
                  </button>
                ))}
              </div>
              <div className="pg-examples" style={{ marginTop: "1.5rem" }}>
                {GALLERY_EXAMPLES.filter((ex) =>
                  category === "family"
                    ? ex.category === "family" || ex.category === "family_pet"
                    : category === "couples"
                      ? ex.category === "couples"
                      : ex.category === "pets",
                ).map((ex) => (
                  <figure key={ex.id} className="pg-example">
                    <div className="pg-example__title">{t(ex.labelKey)}</div>
                    <div className="pg-example__pair">
                      <img src={ex.before} alt={`${t(ex.labelKey)} — ${t("examples.before")}`} loading="lazy" />
                      <img src={ex.after} alt={`${t(ex.labelKey)} — ${t("examples.after")}`} loading="lazy" />
                    </div>
                    <figcaption className="pg-example__cap">
                      <span>{t("examples.before")}</span>
                      <span>{t("examples.after")}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>

            <section className="pg-section" aria-labelledby="styles-heading">
              <h2 id="styles-heading">{t("style.h2")}</h2>
              <p className="xmas-lede">{t("style.lede")}</p>
              <div className="pg-style-grid">
                {funnel.styles.map((style) => (
                  <button
                    key={style.styleKey}
                    type="button"
                    className="pg-style"
                    onClick={() => {
                      funnel.openFilePicker();
                    }}
                  >
                    <img
                      className="pg-style__img"
                      src={STYLE_PREVIEW_BY_KEY[style.styleKey] || PHOTO_GEN_ASSETS.styleClassic}
                      alt={`${photoStyleLabel(style.styleKey, locale, style.displayName)} Christmas portrait style preview`}
                      loading="lazy"
                    />
                    <div className="pg-style__body">
                      <div className="pg-style__name">
                        {photoStyleLabel(style.styleKey, locale, style.displayName)}
                      </div>
                      <p className="pg-style__desc">
                        {photoStyleDescription(style.styleKey, locale, style.description)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="pg-section pg-faq" aria-labelledby="faq-heading">
              <h2 id="faq-heading">{t("faq.h2")}</h2>
              {PHOTO_GEN_FAQS.map((item) => (
                <details key={item.qKey}>
                  <summary>{t(item.qKey)}</summary>
                  <p>{t(item.aKey)}</p>
                </details>
              ))}
            </section>
          </>
        ) : null}

        {/* Creation studio — always mounted for file input; visible after upload */}
        <div className={showLanding ? "sr-only" : `pg-studio ${funnel.draft.step === "offer" ? "pg-studio--offer" : ""}`} aria-hidden={showLanding}>
          <div className="pg-studio__card">
            {!["intro", "generating", "result"].includes(funnel.draft.step) && (
              <nav aria-label="Creation navigation" style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                <button type="button" className="xmas-btn xmas-btn--ghost" disabled={funnel.busy} onClick={funnel.goBack}>← Back</button>
                <button type="button" className="xmas-btn xmas-btn--ghost" disabled={funnel.busy} onClick={funnel.resetAnother}>Start over</button>
              </nav>
            )}
            {funnel.draft.lastError && !showLanding ? (
              <p className="pg-alert" role="alert">
                {friendlyError(funnel.draft.lastError)}
              </p>
            ) : null}
            {funnel.draft.softWarning ? <p className="pg-warn">{t(funnel.draft.softWarning)}</p> : null}

            {funnel.draft.step === "photo" && (
              <section aria-label="Your uploaded photo">
                {funnel.draft.localPreviewUrl ? <img className="pg-preview-thumb" src={funnel.draft.localPreviewUrl} alt="Your uploaded photo" /> : null}
                <button type="button" className="xmas-btn xmas-btn--gold" disabled={funnel.busy || !funnel.draft.sourcePath} onClick={() => funnel.setStep("style")}>Next &gt;</button>
                {funnel.busy ? <p role="status">{t("busy.uploading")}</p> : null}
              </section>
            )}

            {funnel.draft.step === "style" && (
              <section>
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
                        src={STYLE_PREVIEW_BY_KEY[style.styleKey] || PHOTO_GEN_ASSETS.styleClassic}
                        alt=""
                        loading="lazy"
                      />
                      <div className="pg-style__body">
                        <div className="pg-style__name">
                          {photoStyleLabel(style.styleKey, locale, style.displayName)}
                        </div>
                        <p className="pg-style__desc">
                          {photoStyleDescription(style.styleKey, locale, style.description)}
                        </p>
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
                <h2>Choose your Christmas pack</h2><p className="xmas-lede">Photos and short clips made from your photo. One-time payment. No subscription.</p>
                <div role="group" aria-label="Photos and short clips" className="pg-pack-grid">
                  {Object.values(CHRISTMAS_PACKS).map(pack => <button type="button" key={pack.key} className="pg-pack" aria-pressed={packKey === pack.key} onClick={() => { setPackKey(pack.key); sessionStorage.setItem("tdg.generations.pack", pack.key); }} style={{ borderColor: packKey === pack.key ? "#e8c675" : undefined }}>
                    {pack.key === "magic" ? <span className="pg-pack__badge">Recommended</span> : null}<strong>{pack.name}</strong><span className="pg-pack__price">{pack.priceDisplay}</span><span>{pack.imageCount} photos{pack.videoCount ? ` + ${pack.videoCount} short clip${pack.videoCount === 1 ? "" : "s"}` : ""}</span>
                  </button>)}
                </div>
                <label className="pg-email">
                  Email for your photos, clips and receipt
                  <input
                    type="email"
                    value={funnel.draft.email}
                    onChange={(e) =>
                      funnel.setDraft((d) => ({ ...d, email: e.target.value }))
                    }
                    autoComplete="email"
                  />
                </label>
                <button type="button" className="xmas-btn xmas-btn--gold" style={{marginTop:"1rem",width:"100%"}} disabled={funnel.busy} onClick={() => void funnel.startPackCheckout(packKey)}>{funnel.busy ? t("offer.busy") : `Continue to payment — ${CHRISTMAS_PACKS[packKey].priceDisplay}`}</button>
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
                        verticalId: "photo",
                        productKey: funnel.activeProductKey,
                        orderId: funnel.draft.orderId,
                      });
                      writeLastPortraitResult({
                        imageUrl: funnel.resultUrl,
                        verticalId: "photo",
                        productKey: funnel.activeProductKey,
                        orderId: funnel.draft.orderId,
                      });
                      void trackPhotoGeneratorEvent("christmas_photo_card_cross_sell", {
                        orderId: funnel.draft.orderId,
                      });
                      void trackChristmasEvent("card_portrait_cross_sell_clicked", {
                        productKey: funnel.activeProductKey,
                        pathname: VERTICAL.routePath,
                        metadata: { placement: "photo_generator_result" },
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

        <nav className="pg-section pg-nav" aria-label="Christmas portrait links">
          <Link to="/christmas">{t("nav.hub")}</Link>
          <Link to="/christmas/family">{t("nav.family")}</Link>
          <Link to="/christmas/couples">{t("nav.couples")}</Link>
          <Link to="/christmas/pets">{t("nav.pets")}</Link>
          <Link to="/christmas/dogs">{t("nav.dogs")}</Link>
          <Link to="/christmas/cats">{t("nav.cats")}</Link>
          <Link to="/christmas/cards">{t("nav.cards")}</Link>
          <Link to="/christmas/tree">{t("nav.tree")}</Link>
        </nav>
      </article>
      <style>{`
        .visually-hidden, .sr-only {
          position: absolute !important;
          width: 1px; height: 1px;
          padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0);
          white-space: nowrap; border: 0;
        }
        /* display:none blocks some browsers from opening the picker via .click() */
        .pg-file-input {
          position: absolute !important;
          width: 1px; height: 1px;
          padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0);
          white-space: nowrap; border: 0;
          opacity: 0;
        }
      `}</style>
    </>
  );
}
