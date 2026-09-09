/**
 * Shared Christmas portrait funnel for specialized verticals:
 * /christmas/family | couples | pets | dogs | cats
 * Hub page `/christmas/photo-generator` uses ChristmasPhotoGeneratorExperience.
 */

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { AmbientSnow } from "./landing/AmbientSnow";
import { FONT_HREF } from "./landing/assets";
import "./landing/ChristmasLanding.css";
import {
  verticalFromPathname,
  type ChristmasPortraitVertical,
} from "./portraitVerticals";
import { useChristmasPortraitFunnel } from "./useChristmasPortraitFunnel";
import { STYLE_PREVIEW_BY_KEY, PHOTO_GEN_ASSETS } from "./photoGenerator/assets";
import "./photoGenerator/PhotoGenerator.css";

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
  const funnel = useChristmasPortraitFunnel({
    vertical,
    mode: "vertical",
  });

  useEffect(() => {
    ensureFonts();
  }, []);

  return (
    <>
      <PageHead
        title={vertical.pageTitle}
        description={vertical.metaDescription}
        exactTitle
        url={`https://www.thedigitalgifter.com${vertical.routePath}`}
        image="https://www.thedigitalgifter.com/assets/christmas/portrait_family.webp"
      />
      <main className="xmas-landing pg-page" lang="en">
        <AmbientSnow />
        <div className="pg-studio" style={{ paddingTop: "2.5rem", paddingBottom: "3rem" }}>
          <p className="xmas-kicker">The Digital Gifter · Christmas</p>
          <h1 style={{ marginTop: "0.5rem", fontSize: "clamp(2rem, 5vw, 3rem)", color: "#fffaf1" }}>
            {vertical.heroHeadline}
          </h1>
          <p className="xmas-lede">{vertical.heroSupport}</p>
          <p className="xmas-lede" style={{ fontSize: "0.88rem" }}>
            {vertical.privacyLine}
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
                    <Link className="xmas-btn xmas-btn--ghost" style={{ flex: 1 }} to="/christmas/dogs">
                      Dogs
                    </Link>
                    <Link className="xmas-btn xmas-btn--ghost" style={{ flex: 1 }} to="/christmas/cats">
                      Cats
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
                  {funnel.busy ? "Working…" : "Upload your photo"}
                </button>
                <input
                  ref={funnel.fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void funnel.onFileChosen(e.target.files?.[0] || null)}
                />
                <p className="xmas-lede" style={{ fontSize: "0.88rem" }}>
                  {vertical.uploadHint}
                </p>
                <p className="xmas-lede" style={{ fontSize: "0.8rem" }}>
                  JPEG, PNG, or WebP · under 15 MB
                </p>
              </section>
            )}

            {funnel.draft.step === "style" && (
              <section>
                {funnel.draft.localPreviewUrl ? (
                  <img
                    className="pg-preview-thumb"
                    src={funnel.draft.localPreviewUrl}
                    alt="Your upload"
                  />
                ) : null}
                <h2>Choose a Christmas style</h2>
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
                        <div className="pg-style__desc">{style.description}</div>
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
                  alt="Blurred preview of your photo"
                />
                <p className="xmas-lede">
                  Your Christmas transformation is ready to create. This preview is your original
                  photo, heavily blurred — the finished AI portrait unlocks after payment.
                </p>
                <button type="button" className="xmas-btn xmas-btn--gold" style={{ width: "100%" }} onClick={funnel.goOffer}>
                  Continue to offer
                </button>
              </section>
            )}

            {funnel.draft.step === "offer" && (
              <section className="space-y-4">
                <h2>Unlock your Christmas portrait</h2>
                <ul className="pg-guide">
                  <li>Style: {funnel.styleName || funnel.draft.styleKey}</li>
                  <li>{vertical.deliverableLine}</li>
                  <li>Usually ready a few minutes after payment</li>
                  <li>Private by default · download via your order link</li>
                </ul>
                <label className="pg-email">
                  Email for receipt / recovery (optional)
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
                      ? "Preparing checkout…"
                      : `Pay ${(funnel.catalogAmount / 100).toFixed(2)} ${funnel.product?.packages[0]?.currency?.toUpperCase() || "USD"}`}
                  </button>
                ) : (
                  <p className="pg-warn">
                    Production checkout is not enabled yet (price not configured / not purchasable).
                    The upload → blur preview flow works; payment stays disabled until launch
                    configuration.
                  </p>
                )}
              </section>
            )}

            {funnel.draft.step === "checkout" && funnel.checkout && (
              <section className="space-y-4">
                <h2>Secure payment</h2>
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
                <h2>Creating your portrait</h2>
                <p className="pg-gen__msg">Creating a little Christmas magic…</p>
                <p className="xmas-lede">You can close this page — reopen your order link anytime.</p>
              </section>
            )}

            {funnel.draft.step === "result" && funnel.resultUrl && (
              <section className="pg-result space-y-4">
                <img src={funnel.resultUrl} alt="Your Christmas portrait" />
                <p className="xmas-lede">Style: {funnel.styleName || funnel.draft.styleKey}</p>
                <div className="pg-result__actions">
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--gold"
                    onClick={() => void funnel.downloadResult()}
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--ghost"
                    onClick={() => void funnel.shareResult()}
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    className="xmas-btn xmas-btn--ghost"
                    onClick={() => funnel.resetAnother()}
                  >
                    Create another
                  </button>
                </div>
                <div className="pg-nav" style={{ border: 0, marginTop: "0.5rem", paddingTop: 0 }}>
                  <span>Try another:</span>
                  {vertical.crossLinks.map((link) => (
                    <Link key={link.to} to={link.to}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {funnel.draft.step === "error" && (
              <section className="space-y-3">
                <h2>Something went wrong</h2>
                <p className="xmas-lede">
                  If you already paid, keep your order link — support can retry fulfillment without
                  charging again.
                </p>
                <Link to="/christmas" className="xmas-btn xmas-btn--ghost">
                  Christmas hub
                </Link>
              </section>
            )}
          </div>

          <nav className="pg-nav">
            {vertical.crossLinks.map((link) => (
              <Link key={link.to} to={link.to}>
                {link.label}
              </Link>
            ))}
            <Link to="/christmas">Christmas hub</Link>
            <Link to="/christmas/photo-generator">AI Christmas Photo Generator</Link>
          </nav>
        </div>
        <style>{`.hidden { display: none !important; }`}</style>
      </main>
    </>
  );
}
