import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { AmbientSnow } from "../landing/AmbientSnow";
import { FONT_HREF } from "../landing/assets";
import "../landing/ChristmasLanding.css";
import { CHRISTMAS_PORTRAIT_VERTICALS } from "../portraitVerticals";
import { useChristmasPortraitFunnel } from "../useChristmasPortraitFunnel";
import type { ChristmasPortraitSubjectChoice } from "../portraitTypes";
import {
  GALLERY_EXAMPLES,
  HERO_EXAMPLES,
  PHOTO_GEN_ASSETS,
  STYLE_PREVIEW_BY_KEY,
  type ExampleCategory,
} from "./assets";
import { trackPhotoGeneratorEvent } from "./analytics";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import {
  PHOTO_GEN_DEFAULT_LOCALE,
  PHOTO_GEN_FAQS,
  photoGenDir,
  photoGenT,
} from "./copy";
import "./PhotoGenerator.css";
import { photoGeneratorJsonLd, photoGeneratorSeo, upsertJsonLd } from "./seo";
import {
  cardsUrlFromPortrait,
  writeLastPortraitResult,
  writePortraitToCardHandoff,
} from "../cards/portraitHandoff";
import { trackChristmasEvent } from "../analytics";

const LOCALE = PHOTO_GEN_DEFAULT_LOCALE;
const VERTICAL = CHRISTMAS_PORTRAIT_VERTICALS.photo;

const SUBJECTS: ChristmasPortraitSubjectChoice[] = [
  "family",
  "couple",
  "person",
  "pet",
  "person_pet",
];

function ensureFonts() {
  if (document.querySelector(`link[data-xmas-fonts="1"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  link.setAttribute("data-xmas-fonts", "1");
  document.head.appendChild(link);
}

function GenerationMessages({ active }: { active: boolean }) {
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
  return <p className="pg-gen__msg">{photoGenT(keys[idx], LOCALE)}</p>;
}

export default function ChristmasPhotoGeneratorExperience() {
  const t = useCallback((key: string) => photoGenT(key, LOCALE), []);
  const seo = useMemo(() => photoGeneratorSeo(LOCALE), []);
  const [category, setCategory] = useState<ExampleCategory>("family");
  const [dragOver, setDragOver] = useState(false);
  const [resultMode, setResultMode] = useState<"christmas" | "original">("christmas");
  const hero = HERO_EXAMPLES[category];

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
    upsertJsonLd("christmas-photo-generator-jsonld", photoGeneratorJsonLd(LOCALE));
    return () => {
      document.getElementById("christmas-photo-generator-jsonld")?.remove();
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

  const scrollToExamples = () => {
    document.getElementById("christmas-photo-examples")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToCreate = () => {
    document.getElementById("christmas-photo-create")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <ChristmasPageHead path="/christmas/photo-generator" image={seo.image} />
      <article className="xmas-landing pg-page" dir={photoGenDir(LOCALE)} lang={LOCALE}>
        <a className="xmas-skip" href="#christmas-photo-create">
          {t("hero.cta")}
        </a>
        <AmbientSnow />

        {showLanding ? (
          <>
            <header className="pg-hero">
              <div className="pg-hero__copy">
                <nav aria-label="Breadcrumb">
                  <ol className="pg-breadcrumbs">
                    <li>
                      <Link to="/christmas">{t("nav.hub")}</Link>
                    </li>
                    <li aria-hidden="true">/</li>
                    <li>{t("seo.h1")}</li>
                  </ol>
                </nav>
                <p className="xmas-kicker">{t("hero.kicker")}</p>
                <h1>{t("seo.h1")}</h1>
                <p
                  className="xmas-display"
                  style={{
                    margin: "0.65rem 0 0",
                    fontSize: "clamp(1.65rem, 3.8vw, 2.65rem)",
                    lineHeight: 1.15,
                    color: "#fffaf1",
                  }}
                >
                  {t("hero.h1")}
                </p>
                <p className="xmas-lede">{t("hero.lede")}</p>
                <div className="xmas-actions">
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--gold"
                    onClick={() => {
                      scrollToCreate();
                      funnel.openFilePicker();
                    }}
                  >
                    {t("hero.cta")}
                  </button>
                  <button type="button" className="xmas-btn xmas-btn--ghost" onClick={scrollToExamples}>
                    {t("hero.secondary")}
                  </button>
                </div>
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
                <div className="pg-trust" aria-label="Product facts">
                  <span>{t("trust.fact1")}</span>
                  <span>{t("trust.fact2")}</span>
                  <span>{t("trust.fact3")}</span>
                </div>
              </div>
              <div className="pg-hero__visual">
                <BeforeAfterSlider
                  key={category}
                  beforeSrc={hero.before}
                  afterSrc={hero.after}
                  beforeAlt={hero.beforeAlt}
                  afterAlt={hero.afterAlt}
                  beforeLabel={t("hero.beforeLabel")}
                  afterLabel={t("hero.afterLabel")}
                  ariaLabel={t("hero.sliderAria")}
                  eager
                />
              </div>
            </header>

            <section className="pg-section" id="christmas-photo-create" aria-labelledby="upload-heading">
              <div
                className={`pg-upload ${dragOver ? "is-drag" : ""}`}
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
                <h2 id="upload-heading">{t("upload.h2")}</h2>
                <p className="xmas-lede">{t("upload.lede")}</p>
                {funnel.draft.lastError ? (
                  <p className="pg-alert" role="alert">
                    {friendlyError(funnel.draft.lastError)}
                  </p>
                ) : null}
                <div className="pg-upload__actions">
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--gold"
                    disabled={funnel.busy}
                    onClick={() => funnel.openFilePicker()}
                  >
                    {funnel.busy ? t("busy.uploading") : t("upload.choose")}
                  </button>
                  <span className="pg-upload__drop">{t("upload.drop")}</span>
                </div>
                <p className="xmas-lede" style={{ marginTop: "0.75rem", fontSize: "0.88rem" }}>
                  {t("upload.hint")}
                </p>
                <p className="xmas-kicker" style={{ marginTop: "1.25rem" }}>
                  {t("upload.guidanceTitle")}
                </p>
                <ul className="pg-guide">
                  <li>{t("upload.g1")}</li>
                  <li>{t("upload.g2")}</li>
                  <li>{t("upload.g3")}</li>
                  <li>{t("upload.g4")}</li>
                </ul>
                <p className="xmas-lede" style={{ marginTop: "1rem", fontSize: "0.88rem" }}>
                  {t("upload.privacy")}
                </p>
              </div>
            </section>

            <section
              className="pg-section"
              id="christmas-photo-examples"
              aria-labelledby="examples-heading"
            >
              <p className="xmas-kicker">{t("hero.kicker")}</p>
              <h2 id="examples-heading">{t("examples.h2")}</h2>
              <p className="xmas-lede">{t("examples.lede")}</p>
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
                      scrollToCreate();
                      funnel.openFilePicker();
                    }}
                  >
                    <img
                      className="pg-style__img"
                      src={STYLE_PREVIEW_BY_KEY[style.styleKey] || PHOTO_GEN_ASSETS.styleClassic}
                      alt=""
                      loading="lazy"
                    />
                    <div className="pg-style__body">
                      <div className="pg-style__name">{style.displayName}</div>
                      <p className="pg-style__desc">{style.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="pg-section" aria-labelledby="ecosystem-heading">
              <h2 id="ecosystem-heading">{t("ecosystem.h2")}</h2>
              <p className="xmas-lede">{t("ecosystem.lede")}</p>
              <div className="pg-eco" style={{ marginTop: "2rem" }}>
                <div className="pg-eco__row">
                  <div className="pg-eco__copy">
                    <p className="xmas-kicker">{t("family.kicker")}</p>
                    <h2 style={{ fontSize: "clamp(1.7rem, 3.5vw, 2.5rem)" }}>{t("family.h2")}</h2>
                    <p className="xmas-lede">{t("family.lede")}</p>
                    <div className="xmas-actions">
                      <Link className="xmas-btn xmas-btn--gold" to="/christmas/family">
                        {t("family.cta")}
                      </Link>
                    </div>
                  </div>
                  <img
                    className="pg-eco__img"
                    src={PHOTO_GEN_ASSETS.familyAfter}
                    alt={t("family.h2")}
                    loading="lazy"
                  />
                </div>
                <div className="pg-eco__row pg-eco__row--rev">
                  <div className="pg-eco__copy">
                    <p className="xmas-kicker">{t("couples.kicker")}</p>
                    <h2 style={{ fontSize: "clamp(1.7rem, 3.5vw, 2.5rem)" }}>{t("couples.h2")}</h2>
                    <p className="xmas-lede">{t("couples.lede")}</p>
                    <div className="xmas-actions">
                      <Link className="xmas-btn xmas-btn--gold" to="/christmas/couples">
                        {t("couples.cta")}
                      </Link>
                    </div>
                  </div>
                  <img
                    className="pg-eco__img"
                    src={PHOTO_GEN_ASSETS.coupleAfter}
                    alt={t("couples.h2")}
                    loading="lazy"
                  />
                </div>
                <div className="pg-eco__row">
                  <div className="pg-eco__copy">
                    <p className="xmas-kicker">{t("pets.kicker")}</p>
                    <h2 style={{ fontSize: "clamp(1.7rem, 3.5vw, 2.5rem)" }}>{t("pets.h2")}</h2>
                    <p className="xmas-lede">{t("pets.lede")}</p>
                    <div className="xmas-actions">
                      <Link className="xmas-btn xmas-btn--gold" to="/christmas/pets">
                        {t("pets.cta")}
                      </Link>
                    </div>
                  </div>
                  <img
                    className="pg-eco__img"
                    src={PHOTO_GEN_ASSETS.dogAfter}
                    alt={t("pets.h2")}
                    loading="lazy"
                  />
                </div>
              </div>
            </section>

            <section className="pg-section" aria-labelledby="how-heading">
              <h2 id="how-heading">{t("how.h2")}</h2>
              <div className="pg-how">
                <div className="pg-how__item">
                  <div className="pg-how__n">01</div>
                  <h3>{t("how.1.title")}</h3>
                  <p>{t("how.1.body")}</p>
                </div>
                <div className="pg-how__item">
                  <div className="pg-how__n">02</div>
                  <h3>{t("how.2.title")}</h3>
                  <p>{t("how.2.body")}</p>
                </div>
                <div className="pg-how__item">
                  <div className="pg-how__n">03</div>
                  <h3>{t("how.3.title")}</h3>
                  <p>{t("how.3.body")}</p>
                </div>
              </div>
            </section>

            <section className="pg-section pg-geo" aria-labelledby="geo-heading">
              <h2 id="geo-heading">{t("geo.h2")}</h2>
              <p>{t("geo.body")}</p>
              <dl>
                <dt>{t("geo.best")}</dt>
                <dd>{t("geo.bestBody")}</dd>
                <dt>{t("geo.support")}</dt>
                <dd>{t("geo.supportBody")}</dd>
                <dt>{t("geo.time")}</dt>
                <dd>{t("geo.timeBody")}</dd>
                <dt>{t("geo.privacy")}</dt>
                <dd>{t("geo.privacyBody")}</dd>
              </dl>
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
        <div className={showLanding ? "sr-only" : "pg-studio"} aria-hidden={showLanding}>
          <div className="pg-studio__card">
            {funnel.draft.lastError && !showLanding ? (
              <p className="pg-alert" role="alert">
                {friendlyError(funnel.draft.lastError)}
              </p>
            ) : null}
            {funnel.draft.softWarning ? <p className="pg-warn">{funnel.draft.softWarning}</p> : null}

            {funnel.draft.step === "subject" && (
              <section>
                {funnel.draft.localPreviewUrl ? (
                  <img
                    className="pg-preview-thumb"
                    src={funnel.draft.localPreviewUrl}
                    alt=""
                  />
                ) : null}
                <h2>{t("subject.h2")}</h2>
                <p className="xmas-lede">{t("subject.lede")}</p>
                <div className="pg-subject-grid">
                  {SUBJECTS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="pg-subject"
                      onClick={() => funnel.selectSubject(key)}
                    >
                      {t(`subject.${key}`)}
                    </button>
                  ))}
                </div>
              </section>
            )}

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
                        src={STYLE_PREVIEW_BY_KEY[style.styleKey] || PHOTO_GEN_ASSETS.styleClassic}
                        alt=""
                        loading="lazy"
                      />
                      <div className="pg-style__body">
                        <div className="pg-style__name">{style.displayName}</div>
                        <p className="pg-style__desc">{style.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {funnel.draft.subjectChoice ? (
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--ghost"
                    style={{ marginTop: "1rem" }}
                    onClick={() => funnel.setStep("subject")}
                  >
                    {t("style.back")}
                  </button>
                ) : null}
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
                  <li>{VERTICAL.deliverableLine}</li>
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
                  <p className="pg-warn">{t("offer.disabled")}</p>
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
                <GenerationMessages active />
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
