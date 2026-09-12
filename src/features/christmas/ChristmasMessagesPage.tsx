import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { parseChristmasLocalePath, CHRISTMAS_UI_LOCALES } from "@/features/christmas/seo/localeRouting";
import {
  normalizeWave1GenerationLocale,
  type Wave1GenerationLocale,
} from "@/features/christmas/i18n/wave1Locale";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "./analytics";
import {
  MESSAGE_LENGTHS,
  MESSAGE_RECIPIENTS,
  MESSAGE_TONES,
  labelFor,
  type LocaleCode,
} from "./cards/taxonomy";
import {
  MESSAGE_SESSION_KEY,
  cardsMessagesFunnel,
  getOrCreateMessageGuestToken,
  writeMessageToCardHandoff,
  type GeneratedMessage,
} from "./cards/cardsApi";
import {
  ChristmasProductSeoDepth,
  MESSAGES_SEO_DEPTH,
} from "./seo/ChristmasProductSeoDepth";
import { messagesT, type MessagesLocale } from "./messages/messagesCopy";

const PRODUCT = "christmas_messages";
const PAGE_PATH = "/christmas/messages";

async function authBearer() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export default function ChristmasMessagesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const pathLocale = normalizeWave1GenerationLocale(
    parseChristmasLocalePath(location.pathname).locale,
  ) as LocaleCode;
  const [locale, setLocale] = useState<LocaleCode>(pathLocale);
  useEffect(() => {
    setLocale(pathLocale);
  }, [pathLocale]);
  const uiLocale = locale as MessagesLocale;
  const [recipient, setRecipient] = useState(() => {
    const raw = params.get("for") || params.get("recipient") || "mom";
    return MESSAGE_RECIPIENTS.some((r) => r.key === raw) ? raw : "mom";
  });
  const [tone, setTone] = useState(() => {
    const mapped = params.get("tone") || "heartfelt";
    return MESSAGE_TONES.some((item) => item.key === mapped) ? mapped : "heartfelt";
  });
  const [length, setLength] = useState("medium");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<GeneratedMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    captureFunnelAttribution(window.location.search);
    void trackChristmasEvent("christmas_message_page_view", {
      productKey: PRODUCT,
      pathname: PAGE_PATH,
    });
    try {
      const sid = sessionStorage.getItem(MESSAGE_SESSION_KEY);
      if (!sid) return;
      void cardsMessagesFunnel<{
        ok: boolean;
        session_id: string;
        messages: GeneratedMessage[];
        used_fallback?: boolean;
      }>({
        action: "getMessageSession",
        session_id: sid,
        guest_token: getOrCreateMessageGuestToken(),
      })
        .then((data) => {
          setSessionId(data.session_id);
          setMessages(data.messages || []);
          setUsedFallback(Boolean(data.used_fallback));
        })
        .catch(() => undefined);
    } catch {
      /* ignore */
    }
  }, []);

  async function generate(forceNew = false) {
    setBusy(true);
    setError(null);
    setCopied(null);
    void trackChristmasEvent("message_generator_started", {
      productKey: PRODUCT,
      pathname: PAGE_PATH,
      locale,
    });
    try {
      const data = await cardsMessagesFunnel<{
        ok: boolean;
        session_id: string;
        messages: GeneratedMessage[];
        used_fallback?: boolean;
      }>(
        {
          action: "runMessageGenerator",
          guest_token: getOrCreateMessageGuestToken(),
          locale,
          recipient_key: recipient,
          tone_key: tone,
          length_key: length,
          custom_detail: custom.trim() || undefined,
          session_id: forceNew ? undefined : sessionId || undefined,
          force_new: forceNew,
        },
        await authBearer(),
      );
      setSessionId(data.session_id);
      setMessages(data.messages || []);
      setUsedFallback(Boolean(data.used_fallback));
      try {
        sessionStorage.setItem(MESSAGE_SESSION_KEY, data.session_id);
      } catch {
        /* ignore */
      }
      void trackChristmasEvent(forceNew ? "message_regenerated" : "message_generator_completed", {
        productKey: PRODUCT,
        pathname: PAGE_PATH,
        locale,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : messagesT("error.generate", uiLocale));
      void trackChristmasEvent("message_generator_failed", {
        productKey: PRODUCT,
        pathname: PAGE_PATH,
        locale,
      });
    } finally {
      setBusy(false);
    }
  }

  async function copyMessage(m: GeneratedMessage) {
    try {
      await navigator.clipboard.writeText(m.text);
      setCopied(m.id || m.result_key);
      void trackChristmasEvent("message_copied", { productKey: PRODUCT, pathname: PAGE_PATH, locale });
    } catch {
      setError(messagesT("error.copy", uiLocale));
    }
  }

  function useInCard(m: GeneratedMessage) {
    if (!sessionId) return;
    const resultId = m.id || m.result_key;
    if (!resultId) return;
    writeMessageToCardHandoff({
      resultId,
      text: m.text,
      language: m.language,
      sessionId,
      guestToken: getOrCreateMessageGuestToken(),
    });
    void trackChristmasEvent("message_to_card", { productKey: PRODUCT, pathname: PAGE_PATH, locale });
    void navigate("/christmas/cards?from_message=1");
  }

  const chip =
    "rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800";

  return (
    <main className="mx-auto max-w-3xl overflow-x-hidden px-4 py-10 text-slate-900 sm:px-6">
      <ChristmasPageHead path="/christmas/messages" />
      <p className="text-sm text-slate-500">
        <Link to="/christmas" className="underline-offset-2 hover:underline">
          {messagesT("breadcrumb.christmas", uiLocale)}
        </Link>{" "}
        / {messagesT("breadcrumb.messages", uiLocale)}
      </p>
      <h1 className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">
        {messagesT("hero.h1", uiLocale)}
      </h1>
      <p className="mt-2 max-w-2xl text-slate-600">{messagesT("hero.lede", uiLocale)}</p>

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label={messagesT("a11y.language", uiLocale)}>
        {CHRISTMAS_UI_LOCALES.map((item) => (
          <button
            key={item.code}
            type="button"
            onClick={() => setLocale(item.code as LocaleCode)}
            className={`${chip} ${locale === item.code ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}
          >
            {item.nativeName}
          </button>
        ))}
      </div>

      <section className="mt-8 space-y-6" aria-label={messagesT("a11y.options", uiLocale)}>
        <fieldset>
          <legend className="text-sm font-medium">{messagesT("legend.recipient", uiLocale)}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {MESSAGE_RECIPIENTS.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`${chip} ${
                  recipient === r.key ? "border-emerald-800 bg-emerald-900 text-white" : "border-slate-300 bg-white"
                }`}
                onClick={() => setRecipient(r.key)}
              >
                {labelFor(MESSAGE_RECIPIENTS, r.key, locale)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">{messagesT("legend.tone", uiLocale)}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {MESSAGE_TONES.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`${chip} ${
                  tone === t.key ? "border-emerald-800 bg-emerald-900 text-white" : "border-slate-300 bg-white"
                }`}
                onClick={() => setTone(t.key)}
              >
                {labelFor(MESSAGE_TONES, t.key, locale)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">{messagesT("legend.length", uiLocale)}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {MESSAGE_LENGTHS.map((l) => (
              <button
                key={l.key}
                type="button"
                className={`${chip} ${
                  length === l.key ? "border-emerald-800 bg-emerald-900 text-white" : "border-slate-300 bg-white"
                }`}
                onClick={() => setLength(l.key)}
              >
                {labelFor(MESSAGE_LENGTHS, l.key, locale)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="font-medium">{messagesT("detail.label", uiLocale)}</span>
          <input
            className="mt-1 w-full max-w-full rounded-md border border-slate-300 px-3 py-2"
            maxLength={200}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={messagesT("detail.placeholder", uiLocale)}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void generate(false)}
            className="rounded-md bg-emerald-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? messagesT("cta.generating", uiLocale) : messagesT("cta.generate", uiLocale)}
          </button>
          {messages.length > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void generate(true)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm"
            >
              {messagesT("cta.regenerate", uiLocale)}
            </button>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {usedFallback ? (
          <p className="text-xs text-amber-800">{messagesT("fallback.notice", uiLocale)}</p>
        ) : null}
      </section>

      {messages.length > 0 ? (
        <section className="mt-10 space-y-4" aria-label={messagesT("a11y.results", uiLocale)}>
          <h2 className="text-lg font-semibold">{messagesT("results.title", uiLocale)}</h2>
          <ul className="space-y-4">
            {messages.slice(0, 3).map((m) => {
              const key = m.id || m.result_key;
              return (
                <li key={key} className="rounded-lg border border-slate-200 p-4">
                  <p className="break-words whitespace-pre-wrap text-slate-800">{m.text}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      onClick={() => void copyMessage(m)}
                    >
                      {copied === key ? messagesT("cta.copied", uiLocale) : messagesT("cta.copy", uiLocale)}
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
                      onClick={() => useInCard(m)}
                    >
                      {messagesT("cta.useInCard", uiLocale)}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="mt-12 border-t border-slate-200 pt-8 text-sm text-slate-600">
        <h2 className="font-semibold text-slate-900">{messagesT("seo.ideasTitle", uiLocale)}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{messagesT("seo.idea.family", uiLocale)}</li>
          <li>{messagesT("seo.idea.romantic", uiLocale)}</li>
          <li>{messagesT("seo.idea.funny", uiLocale)}</li>
          <li>{messagesT("seo.idea.professional", uiLocale)}</li>
          <li>{messagesT("seo.idea.short", uiLocale)}</li>
        </ul>
        <p className="mt-4">
          {messagesT("crossSell.prompt", uiLocale)}{" "}
          <Link className="underline" to="/christmas/cards">
            {messagesT("crossSell.cardCta", uiLocale)}
          </Link>{" "}
          ·{" "}
          <Link className="underline" to="/christmas">
            {messagesT("breadcrumb.christmas", uiLocale)}
          </Link>
        </p>
      </section>

      {locale === "en" ? (
        <ChristmasProductSeoDepth content={MESSAGES_SEO_DEPTH} tone="light" />
      ) : null}
    </main>
  );
}
