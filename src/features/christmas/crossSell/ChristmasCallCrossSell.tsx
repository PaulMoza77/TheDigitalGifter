import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { trackChristmasEvent } from "@/features/christmas/analytics";
import {
  christmasPathForLocale,
  parseChristmasLocalePath,
  type ChristmasLocaleCode,
} from "@/features/christmas/seo/localeRouting";

export type CrossSellDestination = "santa_call" | "christmas_story";

type Props = {
  /** Free tool / surface id for revenue attribution */
  sourceTool: string;
  destination?: CrossSellDestination;
  /** Compact inline variant for dense result UIs */
  variant?: "inline" | "panel";
  className?: string;
};

const COPY: Record<
  "en" | "ro",
  Record<
    CrossSellDestination,
    { kicker: string; title: string; body: string; cta: string; href: string }
  >
> = {
  en: {
    santa_call: {
      kicker: "While you’re here",
      title: "A live call with Santa",
      body: "Turn the magic into a private 3-minute browser conversation — personalized with their name.",
      cta: "See Santa Call",
      href: "/christmas/santa-call",
    },
    christmas_story: {
      kicker: "Coming soon",
      title: "A personalized Christmas story",
      body: "Song, memory film, and a private gift page — preview only until checkout is approved.",
      cta: "Preview Christmas Story",
      href: "/christmas-story",
    },
  },
  ro: {
    santa_call: {
      kicker: "Cât ești aici",
      title: "Un apel live cu Moș Crăciun",
      body: "Transformă magia într-o conversație privată de 3 minute în browser — cu numele copilului.",
      cta: "Vezi Apel Moș Crăciun",
      href: "/christmas/santa-call",
    },
    christmas_story: {
      kicker: "În curând",
      title: "O poveste personalizată de Crăciun",
      body: "Cântec, film din amintiri și o pagină privată — doar preview până la aprobarea prețului.",
      cta: "Preview Christmas Story",
      href: "/christmas-story",
    },
  },
};

function resolveLang(pathname: string): "en" | "ro" {
  const parsed = parseChristmasLocalePath(pathname);
  return parsed.locale === "ro" ? "ro" : "en";
}

/**
 * Soft, non-blocking cross-sell toward live Santa Call (or Story preview).
 * Tracks impression + click with source tool and destination for revenue attribution.
 */
export function ChristmasCallCrossSell({
  sourceTool,
  destination = "santa_call",
  variant = "panel",
  className = "",
}: Props) {
  const seen = useRef(false);
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/christmas";
  const lang = resolveLang(pathname);
  const copy = COPY[lang][destination];
  const localeCode = (lang === "ro" ? "ro" : "en") as ChristmasLocaleCode;
  const href =
    destination === "christmas_story"
      ? copy.href
      : christmasPathForLocale(copy.href, localeCode);

  useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    void trackChristmasEvent("cross_sell_impression", {
      productKey: destination === "santa_call" ? "christmas_santa_voice_call" : "our_christmas_story",
      pathname,
      locale: lang,
      metadata: {
        source_tool: sourceTool,
        destination,
        cross_sell: true,
      },
    });
  }, [destination, lang, pathname, sourceTool]);

  const onClick = () => {
    void trackChristmasEvent("cross_sell_click", {
      productKey: destination === "santa_call" ? "christmas_santa_voice_call" : "our_christmas_story",
      pathname,
      locale: lang,
      metadata: {
        source_tool: sourceTool,
        destination,
        cross_sell: true,
      },
    });
  };

  if (variant === "inline") {
    return (
      <p className={`text-sm ${className}`.trim()}>
        <span className="opacity-70">{copy.kicker}: </span>
        <Link className="underline underline-offset-2 hover:opacity-90" to={href} onClick={onClick}>
          {copy.cta}
        </Link>
      </p>
    );
  }

  return (
    <aside
      className={`rounded-2xl border border-white/10 bg-black/20 px-4 py-4 sm:px-5 ${className}`.trim()}
      aria-label={copy.title}
      data-cross-sell-source={sourceTool}
      data-cross-sell-destination={destination}
    >
      <p className="text-[11px] uppercase tracking-[0.16em] opacity-60">{copy.kicker}</p>
      <p className="mt-1 font-serif text-lg leading-snug">{copy.title}</p>
      <p className="mt-1 text-sm opacity-75">{copy.body}</p>
      <Link
        to={href}
        onClick={onClick}
        className="mt-3 inline-flex text-sm font-semibold underline underline-offset-4 hover:opacity-90"
      >
        {copy.cta}
      </Link>
    </aside>
  );
}
