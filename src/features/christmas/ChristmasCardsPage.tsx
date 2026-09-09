import { useEffect, useId, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "./analytics";
import { FONT_HREF, LANDING_ASSETS } from "./landing/assets";
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
  STYLE_THUMB_SRC,
  getCardType,
  type CardTypeKey,
} from "./cards/cardMakerTypes";
import {
  downloadBlob,
  loadImageFromFile,
  renderChristmasCard,
  shareCardFile,
  validatePhotoFile,
} from "./cards/cardRenderer";
import {
  CARD_LAYOUTS,
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
  clearPortraitToCardHandoff,
  loadImageFromUrl,
  readLastPortraitResult,
  readPortraitToCardHandoff,
} from "./cards/portraitHandoff";
import "./cards/CardsMaker.css";

const PRODUCT = "christmas_card";
const PATH = "/christmas/cards";

async function authBearer() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

function toneLabel(key: string, locale: LocaleCode, t: (k: string) => string) {
  if (key === "professional") return t("tone.elegant");
  if (key === "short_and_sweet") return t("tone.short");
  return labelFor(MESSAGE_TONES, key, locale);
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
  const previewTracked = useRef(false);
  const creationTracked = useRef(false);

  const [locale, setLocale] = useState<LocaleCode>("en");
  const [fontsReady, setFontsReady] = useState(false);
  const [mobilePane, setMobilePane] = useState<"edit" | "preview">("preview");
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [messageHelpOpen, setMessageHelpOpen] = useState(false);

  const [cardType, setCardType] = useState<CardTypeKey>("family");
  const [styleKey, setStyleKey] = useState("classic_christmas");
  const [layoutKey, setLayoutKey] = useState<CardLayoutKey>("square");
  const [message, setMessage] = useState<string>(DEMO_MESSAGES.heartfeltFamily.en);
  const [messageSource, setMessageSource] = useState<"manual" | "message_generator">("manual");
  const [messageResultId, setMessageResultId] = useState<string | null>(null);
  const [helpRecipient, setHelpRecipient] = useState("family");
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
  const [showResult, setShowResult] = useState(false);

  const t = (key: string) => cardsT(key, locale);
  const seo = cardsMakerSeo(locale);
  const layoutDef = CARD_LAYOUTS.find((l) => l.key === layoutKey) || CARD_LAYOUTS[0]!;
  const hasPortrait = Boolean(readLastPortraitResult() || readPortraitToCardHandoff());

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
      if (draft.layoutKey === "square" || draft.layoutKey === "story" || draft.layoutKey === "landscape") {
        setLayoutKey(draft.layoutKey);
      }
      if (draft.recipientName) setRecipientName(draft.recipientName);
      if (draft.fromName) setFromName(draft.fromName);
      if (draft.messageSource) setMessageSource(draft.messageSource);
      if (draft.messageResultId) setMessageResultId(draft.messageResultId);
      if (draft.cardType && CARD_TYPES.some((c) => c.key === draft.cardType)) {
        setCardType(draft.cardType as CardTypeKey);
      }
      if (draft.year) setYear(draft.year);
      if (draft.locale === "ro" || draft.locale === "en") setLocale(draft.locale);
    } else if (locale === "ro") {
      setMessage(DEMO_MESSAGES.heartfeltFamily.ro);
    }

    const theme = parseCardTheme(params.get("theme") || params.get("style"));
    if (theme) setStyleKey(CARD_THEME_TO_STYLE[theme]);

    const owner = readCardOwner();
    if (owner) {
      setProjectId(owner.projectId);
      setOwnerToken(owner.ownerToken);
    }

    if (!creationTracked.current) {
      creationTracked.current = true;
      void trackChristmasEvent("card_creation_started", { productKey: PRODUCT, pathname: PATH });
    }
  }, [params]);

  useEffect(() => {
    if (messageHandoffApplied.current) return;
    const fromMessage = params.get("from_message") === "1";
    const handoff = readMessageToCardHandoff();
    if (!handoff) return;
    if (!fromMessage && !handoff.text) return;
    messageHandoffApplied.current = true;
    setMobilePane("preview");

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

  useEffect(() => {
    if (previewTracked.current) return;
    previewTracked.current = true;
    void trackChristmasEvent("card_preview_seen", { productKey: PRODUCT, pathname: PATH });
  }, []);

  useEffect(() => {
    if (locale === "ro" && message === DEMO_MESSAGES.heartfeltFamily.en) {
      setMessage(DEMO_MESSAGES.heartfeltFamily.ro);
    } else if (locale === "en" && message === DEMO_MESSAGES.heartfeltFamily.ro) {
      setMessage(DEMO_MESSAGES.heartfeltFamily.en);
    }
  }, [locale]);

  function scrollToExamples() {
    document.getElementById("ccm-examples")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      setMobilePane("preview");
    } catch {
      setError(t("photo.uploadFailed"));
    }
  }

  function selectStyle(key: string) {
    setStyleKey(key);
    const match = CARD_TYPES.find((c) => c.defaultStyle === key);
    if (match) setCardType(match.key);
    void trackChristmasEvent("card_style_selected", {
      productKey: PRODUCT,
      metadata: { style_key: key },
    });
  }

  function selectLayout(key: CardLayoutKey) {
    setLayoutKey(key);
    void trackChristmasEvent("card_layout_selected", {
      productKey: PRODUCT,
      metadata: { layout_key: key },
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
      const { curatedMessagesClient } = await import("./cards/messageEngine");
      const curated = curatedMessagesClient({
        locale,
        recipientKey: helpRecipient,
        toneKey: helpTone === "short_and_sweet" ? "short_and_sweet" : helpTone,
        lengthKey: helpTone === "short_and_sweet" ? "short" : "medium",
      });
      if (curated.length) {
        setSuggestions(
          curated.slice(0, 3).map((m) => ({
            id: m.result_key,
            result_key: m.result_key,
            text: m.text,
            tone_key: m.tone_key,
            length_key: m.length_key,
            recipient_key: m.recipient_key,
            language: m.language,
          })),
        );
        void trackChristmasEvent("card_message_generated", {
          productKey: PRODUCT,
          pathname: PATH,
          locale,
          metadata: { count: curated.length, source: "curated_fallback" },
        });
      } else {
        setMsgError(t("message.failed"));
        void trackChristmasEvent("message_generator_failed", {
          productKey: PRODUCT,
          pathname: PATH,
          locale,
        });
      }
    } finally {
      setMsgBusy(false);
    }
  }

  function applySuggestion(m: GeneratedMessage) {
    setMessage(m.text);
    setMessageSource("message_generator");
    setMessageResultId(m.id || m.result_key || null);
    setMessageHelpOpen(false);
    void trackChristmasEvent("card_message_added", {
      productKey: PRODUCT,
      metadata: { message_source: "message_generator", language: m.language || locale },
    });
  }

  async function ensureProject(): Promise<{ id: string; token: string | null }> {
    if (projectId) return { id: projectId, token: ownerToken };
    try {
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
    } catch {
      const localId = `local-${crypto.randomUUID().slice(0, 8)}`;
      setProjectId(localId);
      return { id: localId, token: null };
    }
  }

  async function createCard() {
    setBusy(true);
    setError(null);
    setShareError(null);
    try {
      if (!message.trim()) throw new Error(t("message.ask"));
      void trackChristmasEvent("card_preview_seen", { productKey: PRODUCT });
      const project = await ensureProject();
      if (project.token) {
        try {
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
        } catch {
          /* keep going — local render is the source of truth for V1 */
        }
      }
      const rendered = await renderChristmasCard({
        message,
        styleKey,
        layoutKey,
        recipientName,
        fromName,
        photo: photoEl,
        projectRef: project.id.slice(0, 8),
      });
      if (project.token) {
        try {
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
        } catch {
          /* ignore persistence failure */
        }
      }
      setResult({
        dataUrl: rendered.dataUrl,
        blob: rendered.blob,
        width: rendered.width,
        height: rendered.height,
        filename: rendered.filename,
      });
      setShowResult(true);
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
          local_only: !project.token,
        },
      });
      requestAnimationFrame(() => {
        document.getElementById("ccm-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch {
      setError(t("preview.failed"));
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

  function applyInspiration(key: string) {
    const ex = EXAMPLES_GALLERY.find((e) => e.key === key);
    if (!ex) return;
    setStyleKey(ex.styleKey);
    setMessage(locale === "ro" ? ex.messageRo : ex.messageEn);
    setRecipientName(locale === "ro" ? ex.toRo : ex.toEn);
    setFromName(locale === "ro" ? ex.fromRo : ex.fromEn);
    const type = CARD_TYPES.find((c) => c.key === key) || getCardType(cardType);
    if (CARD_TYPES.some((c) => c.key === key)) setCardType(key as CardTypeKey);
    else setCardType(type.key);
    void trackChristmasEvent("card_style_selected", {
      productKey: PRODUCT,
      metadata: { style_key: ex.styleKey, source: "inspiration", example: key },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMobilePane("preview");
  }

  const creatorControls = (
    <div className="ccm-creator">
      <header className="ccm-creator__intro">
        <p className="ccm-kicker">{t("hero.kicker")}</p>
        <h1>{t("hero.h1")}</h1>
        <p className="ccm-lede">{t("hero.lede")}</p>
      </header>

      <fieldset className="ccm-block">
        <legend className="ccm-label">{t("design.ask")}</legend>
        <div className="ccm-styles" role="listbox" aria-label={t("design.ask")}>
          {CARD_DESIGN_ORDER.map((key) => {
            const style = CARD_STYLES.find((s) => s.key === key)!;
            const blurb = CARD_DESIGN_BLURBS[key];
            const thumb = STYLE_THUMB_SRC[key];
            return (
              <button
                key={key}
                type="button"
                role="option"
                className="ccm-style"
                aria-selected={styleKey === key}
                aria-label={locale === "ro" ? blurb.categoryRo : blurb.categoryEn}
                onClick={() => selectStyle(key)}
              >
                <span
                  className="ccm-style__thumb"
                  style={{
                    background: `linear-gradient(155deg, ${style.bgTop}, ${style.bgBottom})`,
                  }}
                >
                  <img
                    src={thumb}
                    alt=""
                    width={120}
                    height={90}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="ccm-style__shine" aria-hidden="true" />
                </span>
                <span className="ccm-style__name">
                  {locale === "ro" ? blurb.categoryRo : blurb.categoryEn}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="ccm-block">
        <legend className="ccm-label">{t("layout.ask")}</legend>
        <div className="ccm-segment" role="group" aria-label={t("layout.ask")}>
          {CARD_LAYOUTS.map((layout) => (
            <button
              key={layout.key}
              type="button"
              className="ccm-segment__btn"
              aria-pressed={layoutKey === layout.key}
              onClick={() => selectLayout(layout.key)}
            >
              {locale === "ro" ? layout.labelRo : layout.labelEn}
            </button>
          ))}
        </div>
        <p className="ccm-note">
          {t("layout.dims")}: {layoutDef.width}×{layoutDef.height}
        </p>
      </fieldset>

      <div className="ccm-block">
        <div className="ccm-field">
          <label htmlFor={`${makerId}-message`}>{t("message.ask")}</label>
          <textarea
            id={`${makerId}-message`}
            className="ccm-textarea"
            maxLength={MAX_CARD_MESSAGE_CHARS}
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder={t("message.placeholder")}
          />
          <div className="ccm-message-meta">
            <span>
              {message.length}/{MAX_CARD_MESSAGE_CHARS}
            </span>
            <button
              type="button"
              className="ccm-text-link"
              aria-expanded={messageHelpOpen}
              onClick={() => setMessageHelpOpen((v) => !v)}
            >
              {messageHelpOpen ? t("message.hideHelp") : t("message.helpWrite")}
            </button>
          </div>
        </div>

        {messageHelpOpen ? (
          <div className="ccm-help" aria-label={t("message.helpWrite")}>
            <fieldset className="ccm-help__group">
              <legend className="ccm-label">{t("message.who")}</legend>
              <div className="ccm-pills">
                {CARD_MESSAGE_RECIPIENTS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="ccm-pill"
                    aria-pressed={helpRecipient === key}
                    onClick={() => setHelpRecipient(key)}
                  >
                    {labelFor(MESSAGE_RECIPIENTS, key, locale)}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="ccm-help__group">
              <legend className="ccm-label">{t("message.tone")}</legend>
              <div className="ccm-pills">
                {CARD_MESSAGE_TONES.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="ccm-pill"
                    aria-pressed={helpTone === key}
                    onClick={() => setHelpTone(key)}
                  >
                    {toneLabel(key, locale, t)}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="ccm-actions ccm-actions--tight">
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
              <ul className="ccm-suggestions">
                {suggestions.map((m) => (
                  <li key={m.id || m.result_key}>
                    <p>{m.text}</p>
                    <button type="button" className="ccm-text-link" onClick={() => applySuggestion(m)}>
                      {t("message.useSuggestion")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="ccm-block ccm-personal">
        <div className="ccm-field">
          <label htmlFor={`${makerId}-to`}>{t("personalize.to")}</label>
          <input
            id={`${makerId}-to`}
            className="ccm-input"
            maxLength={80}
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder={t("personalize.toPlaceholder")}
            autoComplete="off"
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
            autoComplete="name"
          />
        </div>
      </div>

      <div className="ccm-block">
        <p className="ccm-label">{t("photo.ask")}</p>
        <div className="ccm-photo">
          {photoPreviewUrl ? (
            <div className="ccm-photo__preview">
              <img src={photoPreviewUrl} alt="" width={96} height={96} />
            </div>
          ) : null}
          <div className="ccm-photo__actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              id={`${makerId}-photo`}
              onChange={(e) => void onPhotoFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              className="ccm-btn ccm-btn--ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreviewUrl ? t("photo.change") : t("photo.upload")}
            </button>
            {hasPortrait || photoSource === "portrait" ? (
              <button
                type="button"
                className="ccm-btn ccm-btn--ghost"
                onClick={() => void useExistingPortrait()}
              >
                {t("photo.usePortrait")}
              </button>
            ) : (
              <Link className="ccm-btn ccm-btn--ghost" to="/christmas/photo-generator">
                {t("portrait.make")}
              </Link>
            )}
            {photoPreviewUrl ? (
              <button type="button" className="ccm-text-link" onClick={() => void onPhotoFile(null)}>
                {t("photo.remove")}
              </button>
            ) : null}
          </div>
          <p className="ccm-note">
            {photoSource === "portrait" ? t("photo.portraitLoaded") : t("photo.hint")}
          </p>
        </div>
        {error ? <p className="ccm-error">{error}</p> : null}
      </div>

      <div className="ccm-cta-block">
        <button
          type="button"
          className="ccm-btn ccm-btn--gold ccm-btn--xl"
          disabled={busy || !message.trim()}
          onClick={() => void createCard()}
        >
          {busy ? t("preview.creating") : t("preview.create")}
        </button>
        <p className="ccm-note ccm-note--center">{t("hero.giftNote")}</p>
      </div>
    </div>
  );

  const livePreview = (
    <aside className="ccm-stage-pane" aria-label={t("a11y.livePreview")}>
      <CardLivePreview
        message={message}
        styleKey={styleKey}
        layoutKey={layoutKey}
        recipientName={recipientName}
        fromName={fromName}
        photo={photoEl}
        year={year}
        label={t("a11y.livePreview")}
        emptyLabel={locale === "ro" ? "Crăciun Fericit" : "Merry Christmas"}
        asideNote={t("hero.asideNote")}
      />
      <div className="ccm-stage-pane__cta">
        <button
          type="button"
          className="ccm-btn ccm-btn--gold ccm-btn--xl"
          disabled={busy || !message.trim()}
          onClick={() => void createCard()}
        >
          {busy ? t("preview.creating") : t("preview.create")}
        </button>
        <p className="ccm-note ccm-note--center">{t("hero.giftNote")}</p>
      </div>
    </aside>
  );

  return (
    <div className={`ccm-page ${fontsReady ? "ccm-page--fonts" : ""}`} lang={locale} dir="ltr">
      <PageHead
        title={seo.title}
        description={seo.description}
        url={seo.url}
        image={seo.image}
        exactTitle
      />

      <div className="ccm-world" aria-hidden="true">
        <div
          className="ccm-world__photo"
          style={{ backgroundImage: `url(${LANDING_ASSETS.hero})` }}
        />
        <div className="ccm-world__vignette" />
        <div className="ccm-world__bokeh" />
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
                {code === "en" ? "EN" : "RO"}
              </button>
            ))}
          </div>
        </div>

        <section className="ccm-hero-creator" aria-label={t("a11y.heroCard")} id="ccm-maker">
          <div className="ccm-mobile-bar">
            <button
              type="button"
              className="ccm-chip"
              aria-pressed={mobilePane === "preview"}
              onClick={() => {
                setMobilePane("preview");
                setPreviewCollapsed(false);
              }}
            >
              {t("preview.mobilePreview")}
            </button>
            <button
              type="button"
              className="ccm-chip"
              aria-pressed={mobilePane === "edit"}
              onClick={() => setMobilePane("edit")}
            >
              {t("preview.mobileEdit")}
            </button>
            {mobilePane === "preview" ? (
              <button
                type="button"
                className="ccm-text-link"
                onClick={() => setPreviewCollapsed((v) => !v)}
              >
                {previewCollapsed ? t("preview.expand") : t("preview.collapse")}
              </button>
            ) : null}
          </div>

          <div
            className={`ccm-hero-grid ${
              mobilePane === "preview" ? "is-mobile-preview" : "is-mobile-edit"
            } ${previewCollapsed ? "is-preview-collapsed" : ""}`}
          >
            <div className="ccm-hero-grid__controls">{creatorControls}</div>
            <div className="ccm-hero-grid__preview">{livePreview}</div>
          </div>
        </section>

        {showResult && result ? (
          <section className="ccm-section ccm-result-hero" id="ccm-result" aria-labelledby="ccm-result-title">
            <h2 id="ccm-result-title">{t("result.h2")}</h2>
            <p className="ccm-lede">{t("result.lede")}</p>
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
                  setShowResult(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                {t("result.edit")}
              </button>
              <button
                type="button"
                className="ccm-btn ccm-btn--solid"
                onClick={() => {
                  setShowResult(false);
                  setResult(null);
                  void trackChristmasEvent("card_create_another", { productKey: PRODUCT });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                {t("result.another")}
              </button>
            </div>
          </section>
        ) : null}

        <section className="ccm-section" id="ccm-examples" aria-labelledby={`${examplesId}-title`}>
          <h2 id={`${examplesId}-title`}>{t("examples.h2")}</h2>
          <p className="ccm-lede">{t("examples.lede")}</p>
          <div className="ccm-gallery">
            {EXAMPLES_GALLERY.map((ex) => (
              <article key={ex.key}>
                <button type="button" className="ccm-gallery__hit" onClick={() => applyInspiration(ex.key)}>
                  <span className="ccm-badge">{t("examples.demoBadge")}</span>
                  <img
                    src={ex.photoSrc}
                    alt={locale === "ro" ? ex.photoAltRo : ex.photoAltEn}
                    width={480}
                    height={600}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="ccm-gallery__cap">
                    <h3>{locale === "ro" ? ex.labelRo : ex.labelEn}</h3>
                    <p>{locale === "ro" ? ex.messageRo : ex.messageEn}</p>
                  </div>
                </button>
              </article>
            ))}
          </div>
          <div className="ccm-actions">
            <button type="button" className="ccm-btn ccm-btn--ghost" onClick={scrollToExamples}>
              {t("hero.secondary")}
            </button>
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
          </Link>
        </p>
      </div>

      <div className="ccm-sticky-cta" aria-hidden={showResult || undefined}>
        <button
          type="button"
          className="ccm-btn ccm-btn--gold ccm-btn--xl"
          disabled={busy || !message.trim()}
          onClick={() => void createCard()}
        >
          {busy ? t("preview.creating") : t("preview.create")}
        </button>
      </div>
    </div>
  );
}

export { cardsUrlFromPortrait } from "./cards/portraitHandoff";
