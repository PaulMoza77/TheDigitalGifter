import { useEffect, useId, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "./analytics";
import { FONT_HREF } from "./landing/assets";
import { CARD_THEME_TO_STYLE, parseCardTheme } from "./landing/handoff";
import { upsertJsonLd } from "./landing/seo";
import { CardLivePreview } from "./cards/CardLivePreview";
import {
  CARD_MAKER_FAQ_KEYS,
  cardsMakerJsonLd,
  cardsMakerSeo,
  cardsT,
} from "./cards/cardMakerCopy";
import {
  CARD_DESIGN_BLURBS,
  CARD_DESIGN_ORDER,
  CARD_MESSAGE_RECIPIENTS,
  CARD_MESSAGE_TONES,
  CARD_TYPES,
  DEMO_MESSAGES,
  EXAMPLES_GALLERY,
  HERO_EXAMPLES,
  getCardType,
  type CardMakerStep,
  type CardTypeKey,
  type HeroExampleKey,
} from "./cards/cardMakerTypes";
import {
  downloadBlob,
  loadImageFromFile,
  renderChristmasCard,
  shareCardFile,
  validatePhotoFile,
} from "./cards/cardRenderer";
import {
  CARD_STYLES,
  MAX_CARD_MESSAGE_CHARS,
  MESSAGE_RECIPIENTS,
  MESSAGE_TONES,
  labelFor,
  type CardLayoutKey,
  type LocaleCode,
} from "./cards/taxonomy";
import {
  cardsMessagesFunnel,
  clearMessageToCardHandoff,
  getOrCreateMessageGuestToken,
  readCardDraft,
  readCardOwner,
  readMessageToCardHandoff,
  writeCardDraft,
  writeCardOwner,
  type GeneratedMessage,
} from "./cards/cardsApi";
import {
  cardsUrlFromPortrait,
  clearPortraitToCardHandoff,
  loadImageFromUrl,
  readLastPortraitResult,
  readPortraitToCardHandoff,
  writePortraitToCardHandoff,
} from "./cards/portraitHandoff";
import "./cards/CardsMaker.css";

const PRODUCT = "christmas_card";
const PATH = "/christmas/cards";
const EDITOR_STEPS: CardMakerStep[] = ["type", "photo", "design", "message", "preview"];

async function authBearer() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

function stepIndex(step: CardMakerStep) {
  const i = EDITOR_STEPS.indexOf(step);
  return i < 0 ? EDITOR_STEPS.length : i;
}

export default function ChristmasCardsPage() {
  const [params] = useSearchParams();
  const makerId = useId();
  const examplesId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const viewed = useRef(false);
  const messageHandoffApplied = useRef(false);
  const portraitHandoffApplied = useRef(false);
  const messageStartedTracked = useRef(false);

  const [locale, setLocale] = useState<LocaleCode>("en");
  const [fontsReady, setFontsReady] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [step, setStep] = useState<CardMakerStep>("type");
  const [mobilePane, setMobilePane] = useState<"edit" | "preview">("edit");
  const [heroKey, setHeroKey] = useState<HeroExampleKey>("family");
  const [heroOpen, setHeroOpen] = useState(false);

  const [cardType, setCardType] = useState<CardTypeKey>("family");
  const [styleKey, setStyleKey] = useState("cozy_christmas");
  const [layoutKey] = useState<CardLayoutKey>("square");
  const [message, setMessage] = useState("");
  const [messageSource, setMessageSource] = useState<"manual" | "message_generator">("manual");
  const [messageResultId, setMessageResultId] = useState<string | null>(null);
  const [messageMode, setMessageMode] = useState<"write" | "help">("write");
  const [helpRecipient, setHelpRecipient] = useState("grandma");
  const [helpTone, setHelpTone] = useState("heartfelt");
  const [suggestions, setSuggestions] = useState<GeneratedMessage[]>([]);
  const [messageSessionId, setMessageSessionId] = useState<string | null>(null);
  const [msgBusy, setMsgBusy] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);

  const [recipientName, setRecipientName] = useState("");
  const [fromName, setFromName] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [photoEl, setPhotoEl] = useState<HTMLImageElement | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<"upload" | "portrait" | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  const [result, setResult] = useState<{
    dataUrl: string;
    blob: Blob;
    width: number;
    height: number;
    filename: string;
  } | null>(null);

  const t = (key: string) => cardsT(key, locale);
  const hero = HERO_EXAMPLES.find((e) => e.key === heroKey) || HERO_EXAMPLES[0]!;
  const seo = cardsMakerSeo(locale);

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    setFontsReady(true);
  }, []);

  useEffect(() => {
    upsertJsonLd("tdg-christmas-cards-jsonld", cardsMakerJsonLd(locale));
    return () => {
      document.getElementById("tdg-christmas-cards-jsonld")?.remove();
    };
  }, [locale]);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    captureFunnelAttribution(window.location.search);
    void trackChristmasEvent("christmas_card_page_view", {
      productKey: PRODUCT,
      pathname: PATH,
    });

    const draft = readCardDraft();
    if (draft) {
      if (draft.message) setMessage(draft.message);
      if (draft.styleKey) setStyleKey(draft.styleKey);
      if (draft.recipientName) setRecipientName(draft.recipientName);
      if (draft.fromName) setFromName(draft.fromName);
      if (draft.messageSource) setMessageSource(draft.messageSource);
      if (draft.messageResultId) setMessageResultId(draft.messageResultId);
      if (draft.cardType && CARD_TYPES.some((c) => c.key === draft.cardType)) {
        setCardType(draft.cardType as CardTypeKey);
      }
      if (draft.year) setYear(draft.year);
      if (draft.locale === "ro" || draft.locale === "en") setLocale(draft.locale);
    }

    const theme = parseCardTheme(params.get("theme") || params.get("style"));
    if (theme) setStyleKey(CARD_THEME_TO_STYLE[theme]);

    const owner = readCardOwner();
    if (owner) {
      setProjectId(owner.projectId);
      setOwnerToken(owner.ownerToken);
    }

    const startStep = params.get("step");
    const fromPortrait = params.get("from_portrait") === "1";
    const startCreator = params.get("create") === "1" || fromPortrait || params.get("from_message") === "1";
    if (startCreator) {
      setCreatorOpen(true);
      void trackChristmasEvent("card_creation_started", { productKey: PRODUCT, pathname: PATH });
    }
    if (startStep === "design" || (fromPortrait && startStep !== "type")) {
      setStep("design");
    } else if (startStep && EDITOR_STEPS.includes(startStep as CardMakerStep)) {
      setStep(startStep as CardMakerStep);
    }
  }, [params]);

  useEffect(() => {
    if (messageHandoffApplied.current) return;
    const fromMessage = params.get("from_message") === "1";
    const handoff = readMessageToCardHandoff();
    if (!handoff) return;
    if (!fromMessage && !handoff.text) return;
    messageHandoffApplied.current = true;
    setCreatorOpen(true);
    setStep("preview");

    if (handoff.text) {
      setMessage(handoff.text);
      setMessageSource("message_generator");
      setMessageResultId(handoff.resultId || null);
      void trackChristmasEvent("card_message_added", {
        productKey: PRODUCT,
        metadata: { message_source: "message_generator", language: handoff.language },
      });
      return;
    }

    if (handoff.resultId && handoff.sessionId) {
      void cardsMessagesFunnel<{
        ok: boolean;
        message: { id: string; text: string; language: string };
      }>({
        action: "getMessageResult",
        result_id: handoff.resultId,
        session_id: handoff.sessionId,
        guest_token: handoff.guestToken || getOrCreateMessageGuestToken(),
      })
        .then((data) => {
          setMessage(data.message.text);
          setMessageSource("message_generator");
          setMessageResultId(data.message.id);
          void trackChristmasEvent("card_message_added", {
            productKey: PRODUCT,
            metadata: { message_source: "message_generator", language: data.message.language },
          });
        })
        .catch(() => undefined);
    }
  }, [params]);

  useEffect(() => {
    if (portraitHandoffApplied.current) return;
    const fromPortrait = params.get("from_portrait") === "1";
    const handoff = readPortraitToCardHandoff();
    const last = readLastPortraitResult();
    const source = handoff || (fromPortrait ? last : null);
    if (!source?.imageUrl) return;
    if (!fromPortrait && !handoff) return;
    portraitHandoffApplied.current = true;
    setCreatorOpen(true);
    setStep("design");
    setMobilePane("preview");

    void loadImageFromUrl(source.imageUrl)
      .then((img) => {
        setPhotoEl(img);
        setPhotoPreviewUrl(source.imageUrl);
        setPhotoSource("portrait");
        void trackChristmasEvent("card_existing_portrait_used", {
          productKey: PRODUCT,
          pathname: PATH,
          metadata: {
            source: handoff ? handoff.source : "last_portrait",
            vertical: source.verticalId || null,
          },
        });
      })
      .catch(() => {
        setError(t("photo.uploadFailed"));
      });
  }, [params, locale]);

  useEffect(() => {
    writeCardDraft({
      styleKey,
      layoutKey,
      message,
      recipientName,
      fromName,
      messageSource,
      messageResultId,
      locale,
      cardType,
      year,
    });
  }, [
    styleKey,
    layoutKey,
    message,
    recipientName,
    fromName,
    messageSource,
    messageResultId,
    locale,
    cardType,
    year,
  ]);

  function startCreator(nextStep: CardMakerStep = "type") {
    setCreatorOpen(true);
    setStep(nextStep);
    setResult(null);
    setError(null);
    setMobilePane("edit");
    void trackChristmasEvent("card_creation_started", { productKey: PRODUCT, pathname: PATH });
    requestAnimationFrame(() => {
      document.getElementById(makerId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function scrollToExamples() {
    document.getElementById(examplesId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function onPhotoFile(file: File | null) {
    setError(null);
    if (!file) {
      setPhotoEl(null);
      setPhotoPreviewUrl(null);
      setPhotoSource(null);
      return;
    }
    const check = validatePhotoFile(file);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    try {
      const img = await loadImageFromFile(file);
      const url = URL.createObjectURL(file);
      setPhotoEl(img);
      setPhotoPreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return url;
      });
      setPhotoSource("upload");
      void trackChristmasEvent("card_photo_added", {
        productKey: PRODUCT,
        metadata: { source: "upload" },
      });
    } catch {
      setError(t("photo.uploadFailed"));
    }
  }

  async function useExistingPortrait() {
    setError(null);
    const last = readLastPortraitResult();
    const handoff = readPortraitToCardHandoff();
    const source = handoff || last;
    if (!source?.imageUrl) {
      setError(t("photo.noneAvailable"));
      return;
    }
    try {
      const img = await loadImageFromUrl(source.imageUrl);
      setPhotoEl(img);
      setPhotoPreviewUrl(source.imageUrl);
      setPhotoSource("portrait");
      void trackChristmasEvent("card_existing_portrait_used", {
        productKey: PRODUCT,
        pathname: PATH,
        metadata: { source: handoff ? "handoff" : "last_portrait" },
      });
      setStep("design");
    } catch {
      setError(t("photo.uploadFailed"));
    }
  }

  function selectType(key: CardTypeKey) {
    const def = getCardType(key);
    setCardType(key);
    setStyleKey(def.defaultStyle);
    setHelpRecipient(def.defaultRecipient);
    setHelpTone(def.defaultTone);
    void trackChristmasEvent("card_type_selected", {
      productKey: PRODUCT,
      metadata: { card_type: key },
    });
  }

  function selectStyle(key: string) {
    setStyleKey(key);
    void trackChristmasEvent("card_style_selected", {
      productKey: PRODUCT,
      metadata: { style_key: key },
    });
  }

  function onMessageChange(value: string) {
    setMessage(value);
    setMessageSource("manual");
    if (!messageStartedTracked.current && value.trim()) {
      messageStartedTracked.current = true;
      void trackChristmasEvent("card_message_started", {
        productKey: PRODUCT,
        pathname: PATH,
      });
    }
  }

  async function generateMessages(forceNew = false) {
    setMsgBusy(true);
    setMsgError(null);
    void trackChristmasEvent("message_generator_started", {
      productKey: PRODUCT,
      pathname: PATH,
      locale,
    });
    try {
      const data = await cardsMessagesFunnel<{
        ok: boolean;
        session_id: string;
        messages: GeneratedMessage[];
      }>(
        {
          action: "runMessageGenerator",
          guest_token: getOrCreateMessageGuestToken(),
          locale,
          recipient_key: helpRecipient,
          tone_key: helpTone,
          length_key: helpTone === "short_and_sweet" ? "short" : "medium",
          session_id: forceNew ? undefined : messageSessionId || undefined,
          force_new: forceNew,
        },
        await authBearer(),
      );
      setMessageSessionId(data.session_id);
      setSuggestions((data.messages || []).slice(0, 3));
      void trackChristmasEvent("message_generator_completed", {
        productKey: PRODUCT,
        pathname: PATH,
        locale,
      });
      void trackChristmasEvent("card_message_generated", {
        productKey: PRODUCT,
        pathname: PATH,
        locale,
        metadata: { count: Math.min(3, (data.messages || []).length) },
      });
    } catch {
      setMsgError(t("message.failed"));
      void trackChristmasEvent("message_generator_failed", {
        productKey: PRODUCT,
        pathname: PATH,
        locale,
      });
    } finally {
      setMsgBusy(false);
    }
  }

  function applySuggestion(m: GeneratedMessage) {
    setMessage(m.text);
    setMessageSource("message_generator");
    setMessageResultId(m.id || m.result_key || null);
    void trackChristmasEvent("card_message_added", {
      productKey: PRODUCT,
      metadata: { message_source: "message_generator", language: m.language || locale },
    });
  }

  async function ensureProject(): Promise<{ id: string; token: string | null }> {
    if (projectId) return { id: projectId, token: ownerToken };
    const data = await cardsMessagesFunnel<{
      ok: boolean;
      project_id: string;
      owner_token: string | null;
    }>(
      {
        action: "createCardProject",
        style_key: styleKey,
        layout_key: layoutKey,
        message,
        recipient_name: recipientName,
        from_name: fromName,
        message_source: messageSource,
        message_result_id: messageResultId,
        guest_token: getOrCreateMessageGuestToken(),
      },
      await authBearer(),
    );
    setProjectId(data.project_id);
    if (data.owner_token) {
      setOwnerToken(data.owner_token);
      writeCardOwner({ projectId: data.project_id, ownerToken: data.owner_token });
    }
    return { id: data.project_id, token: data.owner_token };
  }

  async function createCard() {
    setBusy(true);
    setError(null);
    setShareError(null);
    try {
      if (!message.trim()) throw new Error(t("message.ask"));
      void trackChristmasEvent("card_preview_seen", { productKey: PRODUCT });
      const project = await ensureProject();
      await cardsMessagesFunnel(
        {
          action: "updateCardProject",
          project_id: project.id,
          owner_token: project.token,
          style_key: styleKey,
          layout_key: layoutKey,
          message,
          recipient_name: recipientName,
          from_name: fromName,
          message_source: messageSource,
          photo_present: Boolean(photoEl),
        },
        await authBearer(),
      );
      const rendered = await renderChristmasCard({
        message,
        styleKey,
        layoutKey,
        recipientName,
        fromName,
        photo: photoEl,
        projectRef: project.id.slice(0, 8),
      });
      await cardsMessagesFunnel(
        {
          action: "recordCardRender",
          project_id: project.id,
          owner_token: project.token,
          layout_key: layoutKey,
          width: rendered.width,
          height: rendered.height,
          byte_size: rendered.byteSize,
        },
        await authBearer(),
      );
      setResult({
        dataUrl: rendered.dataUrl,
        blob: rendered.blob,
        width: rendered.width,
        height: rendered.height,
        filename: rendered.filename,
      });
      setStep("result");
      clearMessageToCardHandoff();
      clearPortraitToCardHandoff();
      void trackChristmasEvent("card_generated", {
        productKey: PRODUCT,
        metadata: {
          style_key: styleKey,
          layout: layoutKey,
          photo_present: Boolean(photoEl),
          photo_source: photoSource,
          message_source: messageSource,
          card_type: cardType,
        },
      });
    } catch (e) {
      setError(t("preview.failed"));
      if (projectId) {
        void cardsMessagesFunnel({
          action: "recordCardRender",
          project_id: projectId,
          owner_token: ownerToken,
          failed: true,
          error_code: e instanceof Error ? e.message.slice(0, 80) : "render_failed",
        }).catch(() => undefined);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onDownload() {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
    void trackChristmasEvent("card_download", { productKey: PRODUCT });
    if (projectId) {
      void cardsMessagesFunnel({
        action: "trackCardDownload",
        project_id: projectId,
        owner_token: ownerToken,
      }).catch(() => undefined);
    }
  }

  async function onShare() {
    if (!result) return;
    setShareError(null);
    try {
      await shareCardFile(result.blob, result.filename);
      void trackChristmasEvent("card_share", { productKey: PRODUCT, metadata: { channel: "native" } });
      if (projectId) {
        void cardsMessagesFunnel({
          action: "trackCardShare",
          project_id: projectId,
          owner_token: ownerToken,
        }).catch(() => undefined);
      }
    } catch {
      setShareError(t("result.shareFailed"));
    }
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(
      locale === "ro"
        ? "Ți-am făcut un card de Crăciun cu TheDigitalGifter."
        : "I made you a Christmas card with TheDigitalGifter.",
    );
    window.open(`https://wa.me/?text=${text}%20${encodeURIComponent(seo.url)}`, "_blank", "noopener,noreferrer");
    void trackChristmasEvent("card_share", { productKey: PRODUCT, metadata: { channel: "whatsapp" } });
  }

  function shareEmail() {
    const subject = encodeURIComponent(locale === "ro" ? "Cardul tău de Crăciun" : "Your Christmas card");
    const body = encodeURIComponent(
      locale === "ro"
        ? `Am creat un card de Crăciun personalizat.\n${seo.url}`
        : `I created a personalized Christmas card.\n${seo.url}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    void trackChristmasEvent("card_share", { productKey: PRODUCT, metadata: { channel: "email" } });
  }

  async function copyPageLink() {
    try {
      await navigator.clipboard.writeText(seo.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      void trackChristmasEvent("card_share", { productKey: PRODUCT, metadata: { channel: "copy_link" } });
    } catch {
      setShareError(t("result.shareFailed"));
    }
  }

  function goBack() {
    const i = stepIndex(step);
    if (i <= 0) return;
    setStep(EDITOR_STEPS[i - 1]!);
    setMobilePane("edit");
  }

  function goNext() {
    if (step === "type") setStep("photo");
    else if (step === "photo") setStep("design");
    else if (step === "design") setStep("message");
    else if (step === "message") {
      setStep("preview");
      void trackChristmasEvent("card_preview_seen", { productKey: PRODUCT });
      setMobilePane("preview");
    }
  }

  const styleDef = CARD_STYLES.find((s) => s.key === styleKey) || CARD_STYLES[0]!;
  const hasPortrait = Boolean(readLastPortraitResult() || readPortraitToCardHandoff());

  return (
    <div className={`ccm-page ${fontsReady ? "ccm-page--fonts" : ""}`} lang={locale} dir="ltr">
      <PageHead
        title={seo.title}
        description={seo.description}
        url={seo.url}
        image={seo.image}
        exactTitle
      />
      <div className="ccm-ambient" aria-hidden="true">
        <div className="ccm-ambient__glow" />
      </div>

      <div className="ccm-wrap">
        <div className="ccm-crumb">
          <Link to="/christmas">{t("breadcrumb.christmas")}</Link>
          <span aria-hidden="true">/</span>
          <span>{t("breadcrumb.cards")}</span>
          <div className="ccm-lang" role="group" aria-label="Language">
            {(["en", "ro"] as LocaleCode[]).map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={locale === code}
                onClick={() => setLocale(code)}
              >
                {t(code === "en" ? "lang.en" : "lang.ro")}
              </button>
            ))}
          </div>
        </div>

        <section className="ccm-hero" aria-label={t("a11y.heroCard")}>
          <div>
            <p className="ccm-kicker">{t("hero.kicker")}</p>
            <p className="ccm-display" style={{ margin: "0.85rem 0 0", fontSize: "1.2rem", color: "var(--ccm-gold-bright)" }}>
              {t("brand")}
            </p>
            <h1>{t("hero.h1")}</h1>
            <p className="ccm-lede">{t("hero.lede")}</p>
            <p className="ccm-lede" style={{ marginTop: "0.55rem", fontSize: "0.98rem" }}>
              {t("hero.support")}
            </p>
            <div className="ccm-actions">
              <button type="button" className="ccm-btn ccm-btn--gold" onClick={() => startCreator("type")}>
                {t("hero.cta")}
              </button>
              <button type="button" className="ccm-btn ccm-btn--ghost" onClick={scrollToExamples}>
                {t("hero.secondary")}
              </button>
            </div>
          </div>

          <div>
            <div className="ccm-stage">
              <div className={`ccm-physical ${heroOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="ccm-physical__inner"
                  aria-expanded={heroOpen}
                  aria-label={heroOpen ? t("hero.close") : t("hero.open")}
                  onClick={() => setHeroOpen((v) => !v)}
                >
                  <div
                    className="ccm-face"
                    style={{
                      background: `linear-gradient(165deg, ${CARD_STYLES.find((s) => s.key === hero.styleKey)?.bgTop}, ${CARD_STYLES.find((s) => s.key === hero.styleKey)?.bgBottom})`,
                      color: CARD_STYLES.find((s) => s.key === hero.styleKey)?.text,
                    }}
                  >
                    <img
                      className="ccm-face__photo"
                      src={hero.photoSrc}
                      alt={locale === "ro" ? hero.photoAltRo : hero.photoAltEn}
                      width={640}
                      height={800}
                      fetchPriority="high"
                    />
                    <div
                      className="ccm-face__panel"
                      style={{
                        background: CARD_STYLES.find((s) => s.key === hero.styleKey)?.panel,
                      }}
                    >
                      <p className="ccm-face__greeting">
                        {locale === "ro" ? hero.greetingRo : hero.greetingEn}
                      </p>
                      <p className="ccm-face__meta">
                        {`${locale === "ro" ? hero.toRo : hero.toEn} · ${locale === "ro" ? hero.fromRo : hero.fromEn}`}
                      </p>
                    </div>
                  </div>
                  <div className="ccm-face ccm-face--back">
                    <p>{locale === "ro" ? hero.messageRo : hero.messageEn}</p>
                    <p className="ccm-face__sign">
                      {`${locale === "ro" ? hero.fromRo : hero.fromEn} · ${t("brand")}`}
                    </p>
                  </div>
                </button>
              </div>
            </div>
            <div className="ccm-tags" role="group" aria-label={t("examples.h2")}>
              {HERO_EXAMPLES.map((ex) => (
                <button
                  key={ex.key}
                  type="button"
                  className="ccm-chip"
                  aria-pressed={heroKey === ex.key}
                  onClick={() => {
                    setHeroKey(ex.key);
                    setHeroOpen(false);
                  }}
                >
                  {locale === "ro" ? ex.labelRo : ex.labelEn}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="ccm-section" id={examplesId} aria-labelledby={`${examplesId}-title`}>
          <h2 id={`${examplesId}-title`}>{t("examples.h2")}</h2>
          <p className="ccm-lede">{t("examples.lede")}</p>
          <div className="ccm-gallery">
            {EXAMPLES_GALLERY.map((ex) => (
              <article key={ex.key}>
                <span className="ccm-badge">{t("examples.demoBadge")}</span>
                <img
                  src={ex.photoSrc}
                  alt={locale === "ro" ? ex.photoAltRo : ex.photoAltEn}
                  width={480}
                  height={600}
                  loading="lazy"
                />
                <div className="ccm-gallery__cap">
                  <h3>{locale === "ro" ? ex.labelRo : ex.labelEn}</h3>
                  <p>{locale === "ro" ? ex.messageRo : ex.messageEn}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ccm-section" id={makerId} aria-labelledby={`${makerId}-title`}>
          <h2 id={`${makerId}-title`}>{t("create.h2")}</h2>
          <p className="ccm-lede">{t("create.lede")}</p>

          {!creatorOpen ? (
            <div className="ccm-actions">
              <button type="button" className="ccm-btn ccm-btn--gold" onClick={() => startCreator("type")}>
                {t("hero.cta")}
              </button>
            </div>
          ) : step === "result" && result ? (
            <div className="ccm-result-hero">
              <h3 className="ccm-display" style={{ margin: "0 0 0.75rem", fontSize: "1.8rem" }}>
                {t("result.h2")}
              </h3>
              <p className="ccm-lede" style={{ marginTop: 0 }}>
                {t("result.lede")}
              </p>
              <img src={result.dataUrl} alt={t("result.h2")} width={result.width} height={result.height} />
              <p className="ccm-note">{t("result.formatNote")}</p>
              {shareError ? <p className="ccm-error">{shareError}</p> : null}
              <div className="ccm-actions">
                <button type="button" className="ccm-btn ccm-btn--gold" onClick={() => void onDownload()}>
                  {t("result.download")}
                </button>
                <button type="button" className="ccm-btn ccm-btn--ghost" onClick={() => void onShare()}>
                  {t("result.share")}
                </button>
                <button type="button" className="ccm-btn ccm-btn--ghost" onClick={shareWhatsApp}>
                  {t("result.whatsapp")}
                </button>
                <button type="button" className="ccm-btn ccm-btn--ghost" onClick={shareEmail}>
                  {t("result.email")}
                </button>
                <button type="button" className="ccm-btn ccm-btn--ghost" onClick={() => void copyPageLink()}>
                  {copied ? t("result.copied") : t("result.copyLink")}
                </button>
                <button
                  type="button"
                  className="ccm-btn ccm-btn--ghost"
                  onClick={() => {
                    setResult(null);
                    setStep("preview");
                  }}
                >
                  {t("result.edit")}
                </button>
                <button
                  type="button"
                  className="ccm-btn ccm-btn--solid"
                  onClick={() => {
                    setResult(null);
                    setStep("type");
                    void trackChristmasEvent("card_create_another", { productKey: PRODUCT });
                  }}
                >
                  {t("result.another")}
                </button>
              </div>
            </div>
          ) : (
            <div className={`ccm-maker ${mobilePane === "preview" ? "is-preview" : "is-edit"}`}>
              <div className="ccm-editor-pane ccm-panel">
                <div className="ccm-mobile-tabs" role="tablist" aria-label="Editor">
                  <button
                    type="button"
                    className="ccm-chip"
                    role="tab"
                    aria-selected={mobilePane === "edit"}
                    onClick={() => setMobilePane("edit")}
                  >
                    {t("preview.mobileEdit")}
                  </button>
                  <button
                    type="button"
                    className="ccm-chip"
                    role="tab"
                    aria-selected={mobilePane === "preview"}
                    onClick={() => setMobilePane("preview")}
                  >
                    {t("preview.mobilePreview")}
                  </button>
                </div>

                <div className="ccm-progress" aria-label={t("a11y.progress")}>
                  {EDITOR_STEPS.map((s) => (
                    <span
                      key={s}
                      className={
                        step === s ? "is-active" : stepIndex(step) > stepIndex(s) ? "is-done" : ""
                      }
                    >
                      {t(`step.${s}`)}
                    </span>
                  ))}
                </div>

                {step === "type" ? (
                  <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                    <legend className="ccm-ask">{t("type.ask")}</legend>
                    <div className="ccm-types">
                      {CARD_TYPES.map((type) => (
                        <button
                          key={type.key}
                          type="button"
                          className="ccm-type"
                          aria-pressed={cardType === type.key}
                          onClick={() => selectType(type.key)}
                        >
                          {locale === "ro" ? type.labelRo : type.labelEn}
                        </button>
                      ))}
                    </div>
                    <div className="ccm-nav">
                      <button type="button" className="ccm-btn ccm-btn--gold" onClick={goNext}>
                        {t("nav.continue")}
                      </button>
                    </div>
                  </fieldset>
                ) : null}

                {step === "photo" ? (
                  <div>
                    <p className="ccm-ask">{t("photo.ask")}</p>
                    <p className="ccm-hint">{t("photo.hint")}</p>
                    <div className="ccm-upload">
                      {photoPreviewUrl ? (
                        <div className="ccm-upload__preview">
                          <img src={photoPreviewUrl} alt="" />
                        </div>
                      ) : (
                        <div className="ccm-upload__box">
                          <p className="ccm-hint" style={{ margin: 0 }}>
                            {photoSource === "portrait" ? t("photo.portraitLoaded") : t("photo.skipHint")}
                          </p>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        id={`${makerId}-photo`}
                        onChange={(e) => void onPhotoFile(e.target.files?.[0] || null)}
                      />
                      <div className="ccm-actions">
                        <button
                          type="button"
                          className="ccm-btn ccm-btn--gold"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {photoPreviewUrl ? t("photo.change") : t("photo.upload")}
                        </button>
                        <button
                          type="button"
                          className="ccm-btn ccm-btn--ghost"
                          onClick={() => void useExistingPortrait()}
                        >
                          {t("photo.usePortrait")}
                        </button>
                        {photoPreviewUrl ? (
                          <button
                            type="button"
                            className="ccm-btn ccm-btn--ghost"
                            onClick={() => void onPhotoFile(null)}
                          >
                            {t("photo.remove")}
                          </button>
                        ) : null}
                      </div>
                      {photoSource === "portrait" ? (
                        <p className="ccm-note">{t("photo.portraitLoaded")}</p>
                      ) : null}
                      {!hasPortrait ? <p className="ccm-note">{t("photo.noneAvailable")}</p> : null}
                    </div>
                    {error ? <p className="ccm-error">{error}</p> : null}
                    <div className="ccm-nav">
                      <button type="button" className="ccm-btn ccm-btn--ghost" onClick={goBack}>
                        {t("nav.back")}
                      </button>
                      <button type="button" className="ccm-btn ccm-btn--gold" onClick={goNext}>
                        {photoPreviewUrl ? t("nav.continue") : t("nav.skipPhoto")}
                      </button>
                    </div>
                  </div>
                ) : null}

                {step === "design" ? (
                  <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                    <legend className="ccm-ask">{t("design.ask")}</legend>
                    <p className="ccm-hint">{t("design.lede")}</p>
                    <div className="ccm-designs">
                      {CARD_DESIGN_ORDER.map((key) => {
                        const style = CARD_STYLES.find((s) => s.key === key)!;
                        const blurb = CARD_DESIGN_BLURBS[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            className="ccm-design"
                            aria-pressed={styleKey === key}
                            style={{
                              background: `linear-gradient(155deg, ${style.bgTop}, ${style.bgBottom})`,
                              color: style.text,
                            }}
                            onClick={() => selectStyle(key)}
                          >
                            <strong>{locale === "ro" ? blurb.categoryRo : blurb.categoryEn}</strong>
                            <span>{locale === "ro" ? blurb.ro : blurb.en}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="ccm-nav">
                      <button type="button" className="ccm-btn ccm-btn--ghost" onClick={goBack}>
                        {t("nav.back")}
                      </button>
                      <button type="button" className="ccm-btn ccm-btn--gold" onClick={goNext}>
                        {t("nav.continue")}
                      </button>
                    </div>
                  </fieldset>
                ) : null}

                {step === "message" ? (
                  <div>
                    <p className="ccm-ask">{t("message.ask")}</p>
                    <div className="ccm-tags" role="group" style={{ justifyContent: "flex-start" }}>
                      <button
                        type="button"
                        className="ccm-chip"
                        aria-pressed={messageMode === "write"}
                        onClick={() => setMessageMode("write")}
                      >
                        {t("message.writeOwn")}
                      </button>
                      <button
                        type="button"
                        className="ccm-chip"
                        aria-pressed={messageMode === "help"}
                        onClick={() => setMessageMode("help")}
                      >
                        {t("message.helpWrite")}
                      </button>
                    </div>

                    {messageMode === "help" ? (
                      <div>
                        <fieldset style={{ border: 0, margin: "1rem 0 0", padding: 0 }}>
                          <legend className="ccm-label">{t("message.who")}</legend>
                          <div className="ccm-tags" style={{ justifyContent: "flex-start" }}>
                            {CARD_MESSAGE_RECIPIENTS.map((key) => {
                              const row = MESSAGE_RECIPIENTS.find((r) => r.key === key);
                              if (!row) return null;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  className="ccm-chip"
                                  aria-pressed={helpRecipient === key}
                                  onClick={() => setHelpRecipient(key)}
                                >
                                  {labelFor(MESSAGE_RECIPIENTS, key, locale)}
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>
                        <fieldset style={{ border: 0, margin: "1rem 0 0", padding: 0 }}>
                          <legend className="ccm-label">{t("message.tone")}</legend>
                          <div className="ccm-tags" style={{ justifyContent: "flex-start" }}>
                            {CARD_MESSAGE_TONES.map((key) => (
                              <button
                                key={key}
                                type="button"
                                className="ccm-chip"
                                aria-pressed={helpTone === key}
                                onClick={() => setHelpTone(key)}
                              >
                                {labelFor(MESSAGE_TONES, key, locale)}
                              </button>
                            ))}
                          </div>
                        </fieldset>
                        <div className="ccm-actions">
                          <button
                            type="button"
                            className="ccm-btn ccm-btn--gold"
                            disabled={msgBusy}
                            onClick={() => void generateMessages(Boolean(suggestions.length))}
                          >
                            {msgBusy ? t("message.generating") : t("message.generate")}
                          </button>
                          {msgError ? (
                            <button
                              type="button"
                              className="ccm-btn ccm-btn--ghost"
                              onClick={() => void generateMessages(true)}
                            >
                              {t("message.retry")}
                            </button>
                          ) : null}
                        </div>
                        {msgError ? <p className="ccm-error">{msgError}</p> : null}
                        {suggestions.length > 0 ? (
                          <div style={{ marginTop: "1rem" }}>
                            <p className="ccm-label">{t("message.suggestions")}</p>
                            <ul style={{ listStyle: "none", margin: "0.6rem 0 0", padding: 0, display: "grid", gap: "0.65rem" }}>
                              {suggestions.map((m) => (
                                <li
                                  key={m.id || m.result_key}
                                  style={{
                                    border: "1px solid rgba(246,239,227,0.14)",
                                    borderRadius: "0.9rem",
                                    padding: "0.85rem",
                                  }}
                                >
                                  <p style={{ margin: 0, lineHeight: 1.5 }}>{m.text}</p>
                                  <button
                                    type="button"
                                    className="ccm-btn ccm-btn--ghost"
                                    style={{ marginTop: "0.65rem", minHeight: "2.4rem" }}
                                    onClick={() => applySuggestion(m)}
                                  >
                                    {t("message.useSuggestion")}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div style={{ marginTop: "1rem" }}>
                            <p className="ccm-hint">
                              {locale === "ro" ? DEMO_MESSAGES.heartfeltFamily.ro : DEMO_MESSAGES.heartfeltFamily.en}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className="ccm-field">
                      <label htmlFor={`${makerId}-message`}>{t("message.started")}</label>
                      <textarea
                        id={`${makerId}-message`}
                        className="ccm-textarea"
                        maxLength={MAX_CARD_MESSAGE_CHARS}
                        value={message}
                        onChange={(e) => onMessageChange(e.target.value)}
                        placeholder={t("message.placeholder")}
                      />
                      <span className="ccm-note">
                        {message.length}/{MAX_CARD_MESSAGE_CHARS} ·{" "}
                        <Link to="/christmas/messages" style={{ color: "var(--ccm-gold-bright)" }}>
                          {t("message.moreInspiration")}
                        </Link>
                      </span>
                    </div>

                    <div className="ccm-field">
                      <label htmlFor={`${makerId}-to`}>{t("personalize.to")}</label>
                      <input
                        id={`${makerId}-to`}
                        className="ccm-input"
                        maxLength={80}
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder={t("personalize.toPlaceholder")}
                      />
                    </div>
                    <div className="ccm-field">
                      <label htmlFor={`${makerId}-from`}>{t("personalize.from")}</label>
                      <input
                        id={`${makerId}-from`}
                        className="ccm-input"
                        maxLength={80}
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        placeholder={t("personalize.fromPlaceholder")}
                      />
                    </div>
                    <div className="ccm-field">
                      <label htmlFor={`${makerId}-year`}>{t("personalize.year")}</label>
                      <input
                        id={`${makerId}-year`}
                        className="ccm-input"
                        maxLength={4}
                        inputMode="numeric"
                        value={year}
                        onChange={(e) => setYear(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                      />
                    </div>

                    <div className="ccm-nav">
                      <button type="button" className="ccm-btn ccm-btn--ghost" onClick={goBack}>
                        {t("nav.back")}
                      </button>
                      <button
                        type="button"
                        className="ccm-btn ccm-btn--gold"
                        disabled={!message.trim()}
                        onClick={goNext}
                      >
                        {t("nav.continue")}
                      </button>
                    </div>
                  </div>
                ) : null}

                {step === "preview" ? (
                  <div>
                    <p className="ccm-ask">{t("preview.h2")}</p>
                    <p className="ccm-hint">{t("preview.lede")}</p>
                    {error ? <p className="ccm-error">{error}</p> : null}
                    <div className="ccm-nav">
                      <button type="button" className="ccm-btn ccm-btn--ghost" onClick={goBack}>
                        {t("nav.back")}
                      </button>
                      <button
                        type="button"
                        className="ccm-btn ccm-btn--ghost"
                        onClick={() => setStep("message")}
                      >
                        {t("preview.edit")}
                      </button>
                      <button
                        type="button"
                        className="ccm-btn ccm-btn--gold"
                        disabled={busy || !message.trim()}
                        onClick={() => void createCard()}
                      >
                        {busy ? t("preview.creating") : t("preview.create")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <aside className="ccm-preview-pane">
                <div className="ccm-panel">
                  <p className="ccm-label" style={{ marginBottom: "0.75rem" }}>
                    {styleDef.labelEn} · {t("a11y.livePreview")}
                  </p>
                  <CardLivePreview
                    message={message}
                    styleKey={styleKey}
                    layoutKey={layoutKey}
                    recipientName={recipientName}
                    fromName={fromName}
                    photo={photoEl}
                    year={year}
                    label={t("a11y.livePreview")}
                    emptyLabel={locale === "ro" ? hero.greetingRo : hero.greetingEn}
                  />
                </div>
              </aside>
            </div>
          )}
        </section>

        <section className="ccm-section" aria-labelledby="ccm-photos-title">
          <h2 id="ccm-photos-title">{t("photos.h2")}</h2>
          <p className="ccm-lede">{t("photos.lede")}</p>
        </section>

        <section className="ccm-section" aria-labelledby="ccm-messages-title">
          <h2 id="ccm-messages-title">{t("messages.h2")}</h2>
          <p className="ccm-lede">{t("messages.lede")}</p>
          <div className="ccm-actions">
            <Link className="ccm-btn ccm-btn--ghost" to="/christmas/messages">
              {t("message.moreInspiration")}
            </Link>
          </div>
        </section>

        <section className="ccm-section" aria-labelledby="ccm-portrait-title">
          <h2 id="ccm-portrait-title">{t("portrait.h2")}</h2>
          <p className="ccm-lede">{t("portrait.lede")}</p>
          <div className="ccm-actions">
            <button
              type="button"
              className="ccm-btn ccm-btn--gold"
              onClick={() => {
                void trackChristmasEvent("card_portrait_cross_sell_clicked", {
                  productKey: PRODUCT,
                  pathname: PATH,
                  metadata: { placement: "cards_page" },
                });
                if (hasPortrait) {
                  startCreator("photo");
                  void useExistingPortrait();
                } else {
                  window.location.assign("/christmas/photo-generator");
                }
              }}
            >
              {t("portrait.cta")}
            </button>
            <Link
              className="ccm-btn ccm-btn--ghost"
              to="/christmas/photo-generator"
              onClick={() => {
                void trackChristmasEvent("card_portrait_cross_sell_clicked", {
                  productKey: PRODUCT,
                  pathname: PATH,
                  metadata: { placement: "make_portrait" },
                });
              }}
            >
              {t("portrait.make")}
            </Link>
          </div>
        </section>

        <section className="ccm-section" aria-labelledby="ccm-how-title">
          <h2 id="ccm-how-title">{t("how.h2")}</h2>
          <div className="ccm-how">
            {[1, 2, 3, 4].map((n) => (
              <article key={n}>
                <span className="ccm-num">0{n}</span>
                <h3>{t(`how.${n}.title`)}</h3>
                <p>{t(`how.${n}.body`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ccm-section ccm-faq" aria-labelledby="ccm-faq-title">
          <h2 id="ccm-faq-title">{t("faq.h2")}</h2>
          {CARD_MAKER_FAQ_KEYS.map((base) => (
            <details key={base}>
              <summary>{t(`${base}.q`)}</summary>
              <p>{t(`${base}.a`)}</p>
            </details>
          ))}
        </section>

        <p className="ccm-note" style={{ marginTop: "2.5rem" }}>
          {t("hero.promise")} ·{" "}
          <Link to="/christmas" style={{ color: "var(--ccm-gold-bright)" }}>
            {t("breadcrumb.christmas")}
          </Link>{" "}
          ·{" "}
          <Link to="/christmas/gift-finder" style={{ color: "var(--ccm-gold-bright)" }}>
            Gift Finder
          </Link>
        </p>
      </div>
    </div>
  );
}

// Re-export for portrait funnel convenience without circular imports in tests.
export { cardsUrlFromPortrait, writePortraitToCardHandoff };
