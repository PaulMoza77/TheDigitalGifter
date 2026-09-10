/**
 * Shared Christmas portrait funnel for specialized verticals:
 * /christmas/couples | pets | dogs | cats
 * Hub `/christmas/photo-generator` → ChristmasPhotoGeneratorExperience
 * Hub `/christmas/family` → ChristmasFamilyExperience
 */

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import {
  christmasPathForLocale,
  parseChristmasLocalePath,
  type ChristmasLocaleCode,
} from "@/features/christmas/seo/localeRouting";
import { normalizeWave1GenerationLocale } from "@/features/christmas/i18n/wave1Locale";
import { AmbientSnow } from "./landing/AmbientSnow";
import { FONT_HREF } from "./landing/assets";
import "./landing/ChristmasLanding.css";
import {
  verticalFromPathname,
  type ChristmasPortraitVertical,
  type ChristmasPortraitVerticalId,
} from "./portraitVerticals";
import { useChristmasPortraitFunnel } from "./useChristmasPortraitFunnel";
import { STYLE_PREVIEW_BY_KEY, PHOTO_GEN_ASSETS } from "./photoGenerator/assets";
import {
  photoGenDir,
  photoGenT,
  photoStyleDescription,
  photoStyleLabel,
  type PhotoGenLocale,
} from "./photoGenerator/copy";
import "./photoGenerator/PhotoGenerator.css";
import { trackChristmasEvent } from "./analytics";
import {
  cardsUrlFromPortrait,
  writeLastPortraitResult,
  writePortraitToCardHandoff,
} from "./cards/portraitHandoff";
import { PortraitVerticalSeoSections } from "./seo/PortraitVerticalSeoSections";

const CROSS_LABEL_KEY: Record<string, string> = {
  "Family Christmas": "cross.familyChristmas",
  "Couples Christmas": "cross.couplesChristmas",
  "Pet Christmas": "cross.petChristmas",
  "Christmas Cards": "cross.christmasCards",
  "Christmas Dogs": "cross.christmasDogs",
  "Christmas Cats": "cross.christmasCats",
  "Classic portrait": "cross.classicPortrait",
  "All pets": "cross.allPets",
  Family: "cross.family",
  Couples: "cross.couples",
};

function verticalUi(
  id: ChristmasPortraitVerticalId,
  field: "heroHeadline" | "heroSupport" | "privacy" | "uploadHint" | "deliverable",
  locale: PhotoGenLocale,
  fallback: string,
): string {
  const key = `vertical.${id}.${field}`;
  const text = photoGenT(key, locale);
  return text === key ? fallback : text;
}

function crossLinkLabel(label: string, locale: PhotoGenLocale): string {
  const key = CROSS_LABEL_KEY[label];
  if (!key) return label;
  const text = photoGenT(key, locale);
  return text === key ? label : text;
}

function ensureFonts() {
  if (document.querySelector(`link[data-xmas-fonts="1"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  link.setAttribute("data-xmas-fonts", "1");
  document.head.appendChild(link);
}

function useVertical(): ChristmasPortraitVertical {
  const { pathname } = useLocation();
  const vertical = verticalFromPathname(pathname);
  if (!vertical) {
    return verticalFromPathname("/christmas/photo-generator")!;
  }
  return vertical;
}

export default function ChristmasPortraitFunnelPage() {
  const vertical = useVertical();
  const { pathname } = useLocation();
  const locale = normalizeWave1GenerationLocale(
    parseChristmasLocalePath(pathname).locale,
  ) as PhotoGenLocale;
  const t = (key: string) => photoGenT(key, locale);
  const pathFor = (to: string) =>
    christmasPathForLocale(to, locale as ChristmasLocaleCode);
  const funnel = useChristmasPortraitFunnel({
    vertical,
    mode: "vertical",
  });
  const heroHeadline = verticalUi(
    vertical.id,
    "heroHeadline",
    locale,
    vertical.heroHeadline,
  );
  const heroSupport = verticalUi(
    vertical.id,
    "heroSupport",
    locale,
    vertical.heroSupport,
  );
  const privacyLine = verticalUi(vertical.id, "privacy", locale, vertical.privacyLine);
  const uploadHint = verticalUi(vertical.id, "uploadHint", locale, vertical.uploadHint);
  const deliverableLine = verticalUi(
    vertical.id,
    "deliverable",
    locale,
    vertical.deliverableLine,
  );

  useEffect(() => {
    ensureFonts();
  }, []);

  useEffect(() => {
    if (funnel.draft.step !== "result" || !funnel.resultUrl) return;
    writeLastPortraitResult({
      imageUrl: funnel.resultUrl,
      verticalId: vertical.id,
      productKey: vertical.productKey,
      orderId: funnel.draft.orderId,
    });
  }, [
    funnel.draft.step,
    funnel.resultUrl,
    funnel.draft.orderId,
    vertical.id,
    vertical.productKey,
  ]);

  return (
    <>
      <ChristmasPageHead path={vertical.routePath} />
      <main className="xmas-landing pg-page" lang={locale} dir={photoGenDir(locale)}>
        <AmbientSnow />
        <div className="pg-studio" style={{ paddingTop: "2.5rem", paddingBottom: "3rem" }}>
          <p className="xmas-kicker">The Digital Gifter · Christmas</p>
          <h1 style={{ marginTop: "0.5rem", fontSize: "clamp(2rem, 5vw, 3rem)", color: "#fffaf1" }}>
            {heroHeadline}
          </h1>
          <p className="xmas-lede">{heroSupport}</p>
          <p className="xmas-lede" style={{ fontSize: "0.88rem" }}>
            {privacyLine}
          </p>

          {funnel.draft.lastError ? (
            <p className="pg-alert" role="alert">
              {funnel.draft.lastError}
            </p>
          ) : null}

          {funnel.speciesHint ? (
            <p className="pg-warn">
              {funnel.speciesHint.message}{" "}
              <Link className="underline" to={funnel.speciesHint.switchTo}>
                Switch to {funnel.speciesHint.label}
              </Link>
            </p>
          ) : null}

          <div className="pg-studio__card" style={{ marginTop: "1.25rem" }}>
            {(funnel.draft.step === "intro" || funnel.draft.step === "upload") && (
              <section className="space-y-4">
                {vertical.id === "pets" ? (
                  <div style={{ display: "flex", gap: "0.65rem" }}>
                    <Link className="xmas-btn xmas-btn--ghost" style={{ flex: 1 }} to={pathFor("/christmas/dogs")}>
                      {t("funnel.dogs")}
                    </Link>
                    <Link className="xmas-btn xmas-btn--ghost" style={{ flex: 1 }} to={pathFor("/christmas/cats")}>
                      {t("funnel.cats")}
                    </Link>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="xmas-btn xmas-btn--gold"
                  style={{ width: "100%" }}
                  onClick={() => funnel.openFilePicker()}
                  disabled={funnel.busy}
                >
                  {funnel.busy ? t("funnel.working") : t("funnel.upload")}
                </button>
                <input
                  ref={funnel.fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="pg-file-input"
                  onChange={(e) => void funnel.onFileChosen(e.target.files?.[0] || null)}
                />
                <p className="xmas-lede" style={{ fontSize: "0.88rem" }}>
                  {uploadHint}
                </p>
                <p className="xmas-lede" style={{ fontSize: "0.8rem" }}>
                  {t("funnel.fileHint")}
                </p>
              </section>
            )}

            {funnel.draft.step === "style" && (
              <section>
                {funnel.draft.localPreviewUrl ? (
                  <img
                    className="pg-preview-thumb"
                    src={funnel.draft.localPreviewUrl}
                    alt={t("funnel.yourUpload")}
                  />
                ) : null}
                <h2>{t("funnel.style")}</h2>
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
                        <div className="pg-style__name">{photoStyleLabel(style.styleKey, locale, style.displayName)}</div>
                        <div className="pg-style__desc">{photoStyleDescription(style.styleKey, locale, style.description)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {funnel.draft.step === "preview" && funnel.draft.blurredPreviewUrl && (
              <section className="space-y-4">
                <img
                  className="pg-preview-thumb"
                  src={funnel.draft.blurredPreviewUrl}
                  alt={t("funnel.blurredPreview")}
                />
                <p className="xmas-lede">{t("funnel.previewLede")}</p>
                <button
                  type="button"
                  className="xmas-btn xmas-btn--gold"
                  style={{ width: "100%" }}
                  onClick={funnel.goOffer}
                >
                  {t("funnel.continueOffer")}
                </button>
              </section>
            )}

            {funnel.draft.step === "offer" && (
              <section className="space-y-4">
                <h2>{t("funnel.unlock")}</h2>
                <ul className="pg-guide">
                  <li>{t("funnel.styleLabel")}: {photoStyleLabel(funnel.draft.styleKey || "", locale, funnel.styleName || undefined)}</li>
                  <li>{deliverableLine}</li>
                  <li>{t("funnel.readyMinutes")}</li>
                  <li>{t("funnel.privateDownload")}</li>
                </ul>
                <label className="pg-email">
                  {t("funnel.email")}
                  <input
                    type="email"
                    value={funnel.draft.email}
                    onChange={(e) => funnel.setDraft((d) => ({ ...d, email: e.target.value }))}
                  />
                </label>
                {funnel.purchasable && funnel.catalogAmount != null ? (
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--gold"
                    style={{ width: "100%" }}
                    disabled={funnel.busy}
                    onClick={() => void funnel.startCheckout()}
                  >
                    {funnel.busy
                      ? t("funnel.preparing")
                      : `Pay ${(funnel.catalogAmount / 100).toFixed(2)} ${funnel.product?.packages[0]?.currency?.toUpperCase() || "USD"}`}
                  </button>
                ) : (
                  <p className="pg-warn">{t("funnel.checkoutDisabled")}</p>
                )}
              </section>
            )}

            {funnel.draft.step === "checkout" && funnel.checkout && (
              <section className="space-y-4">
                <h2>{t("funnel.securePayment")}</h2>
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
                <h2>{t("funnel.creating")}</h2>
                <p className="pg-gen__msg">{t("funnel.magic")}</p>
                <p className="xmas-lede">{t("funnel.leaveNote")}</p>
              </section>
            )}

            {funnel.draft.step === "result" && funnel.resultUrl && (
              <section className="pg-result space-y-4">
                <img src={funnel.resultUrl} alt={t("funnel.portraitAlt")} />
                <p className="xmas-lede">{t("funnel.styleLabel")}: {photoStyleLabel(funnel.draft.styleKey || "", locale, funnel.styleName || undefined)}</p>
                <div className="pg-result__actions">
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--gold"
                    onClick={() => void funnel.downloadResult()}
                  >
                    {t("funnel.download")}
                  </button>
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--ghost"
                    onClick={() => void funnel.shareResult()}
                  >
                    {t("funnel.share")}
                  </button>
                  <Link
                    to={cardsUrlFromPortrait()}
                    className="xmas-btn xmas-btn--ghost"
                    style={{ textAlign: "center" }}
                    onClick={() => {
                      if (!funnel.resultUrl) return;
                      writePortraitToCardHandoff({
                        imageUrl: funnel.resultUrl,
                        source: "portrait_result",
                        verticalId: vertical.id,
                        productKey: vertical.productKey,
                        orderId: funnel.draft.orderId,
                      });
                      writeLastPortraitResult({
                        imageUrl: funnel.resultUrl,
                        verticalId: vertical.id,
                        productKey: vertical.productKey,
                        orderId: funnel.draft.orderId,
                      });
                      void trackChristmasEvent("card_portrait_cross_sell_clicked", {
                        productKey: vertical.productKey,
                        pathname: vertical.routePath,
                        metadata: { placement: "portrait_result" },
                      });
                    }}
                  >
                    {t("funnel.card")}
                  </Link>
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--ghost"
                    onClick={() => funnel.resetAnother()}
                  >
                    {t("funnel.another")}
                  </button>
                </div>
                <div className="pg-nav" style={{ border: 0, marginTop: "0.5rem", paddingTop: 0 }}>
<span>{t("funnel.tryAnother")}</span>
                  {vertical.crossLinks.map((link) => (
                    <Link key={link.to} to={pathFor(link.to)}>
                      {crossLinkLabel(link.label, locale)}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {funnel.draft.step === "error" && (
              <section className="space-y-3">
                <h2>{t("funnel.errorTitle")}</h2>
                <p className="xmas-lede">{t("funnel.errorPaid")}</p>
                <Link to={pathFor("/christmas")} className="xmas-btn xmas-btn--ghost">
                  {t("funnel.hub")}
                </Link>
              </section>
            )}
          </div>

          <nav className="pg-nav">
            {vertical.crossLinks.map((link) => (
              <Link key={link.to} to={pathFor(link.to)}>
                {crossLinkLabel(link.label, locale)}
              </Link>
            ))}
            <Link to={pathFor("/christmas")}>{t("funnel.hub")}</Link>
            <Link to={pathFor("/christmas/photo-generator")}>{t("funnel.photoGen")}</Link>
          </nav>

          <PortraitVerticalSeoSections verticalId={vertical.id} />
        </div>
        <style>{`
          .pg-file-input {
            position: absolute !important;
            width: 1px; height: 1px;
            padding: 0; margin: -1px;
            overflow: hidden; clip: rect(0,0,0,0);
            white-space: nowrap; border: 0;
            opacity: 0;
          }
        `}</style>
      </main>
    </>
  );
}
