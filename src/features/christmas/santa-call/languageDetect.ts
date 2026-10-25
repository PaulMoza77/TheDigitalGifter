/**
 * Isolated language detection prototype for Santa Call multilingual routing.
 * Explicit fallback — never claims universal language coverage.
 */

export type SantaDetectableLanguage = "ro" | "en" | "de" | "fr" | "es" | "it" | "ar" | "unknown";

export type LanguageDetectResult = {
  language: SantaDetectableLanguage;
  confidence: number;
  source: "hint" | "heuristic" | "model" | "fallback";
  supported: boolean;
  notes?: string;
};

/** Languages we intentionally support for Santa Call v1 multilingual. */
export const SANTA_SUPPORTED_LANGUAGES: readonly SantaDetectableLanguage[] = [
  "ro",
  "en",
  "de",
  "fr",
  "es",
  "it",
  "ar",
] as const;

const ARABIC_RE = /[\u0600-\u06FF]/;
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const LATIN_RE = /[A-Za-zăâîșțĂÂÎȘȚäöüßàâçéèêëïîôùûüÿñáíóú]/;

// Avoid shared Romance stems (e.g. bare "bicicleta") as sole RO evidence — they collide with ES.
const RO_MARKERS =
  /\b(și|şi|bună|buna|crăciun|craciun|mulțumesc|multumesc|vreau|dorești|doresti|nerăbdător|nerabdator|spiridușii|spiridusii|bicicletă)\b/i;
const DE_MARKERS = /\b(und|ich|nicht|weihnachten|wunsch|wünsche|wuensche|hallo|bitte|danke|fahrrad|freude)\b/i;
const FR_MARKERS = /\b(je|oui|non|noël|noel|bonjour|merci|vélo|velo|souhaite|Noël)\b/i;
const ES_MARKERS = /\b(hola|gracias|navidad|quiero|bicicleta|para|por favor|niño|nino)\b/i;
const IT_MARKERS = /\b(ciao|grazie|natale|voglio|bicicletta|per favore|bambino)\b/i;
const EN_MARKERS = /\b(the|and|christmas|hello|want|bicycle|please|thank|elves|impatient)\b/i;

export function normalizeLanguageHint(raw: unknown): SantaDetectableLanguage | null {
  const v = String(raw || "")
    .trim()
    .toLowerCase()
    .slice(0, 8);
  if (!v) return null;
  const base = v.split(/[-_]/)[0] || v;
  if ((SANTA_SUPPORTED_LANGUAGES as readonly string[]).includes(base)) {
    return base as SantaDetectableLanguage;
  }
  return null;
}

/**
 * Fast offline heuristic for UI / routing before a model call.
 * Prefer explicit parent/guardian language selection when available.
 */
export function detectLanguageHeuristic(
  text: string,
  opts?: { preferred?: string | null },
): LanguageDetectResult {
  const preferred = normalizeLanguageHint(opts?.preferred);
  const sample = String(text || "").trim();
  if (!sample) {
    if (preferred) {
      return {
        language: preferred,
        confidence: 0.55,
        source: "hint",
        supported: true,
        notes: "empty_utterance_used_preference",
      };
    }
    return {
      language: "unknown",
      confidence: 0,
      source: "fallback",
      supported: false,
      notes: "empty_utterance",
    };
  }

  if (ARABIC_RE.test(sample)) {
    return { language: "ar", confidence: 0.92, source: "heuristic", supported: true };
  }
  if (CYRILLIC_RE.test(sample)) {
    return {
      language: "unknown",
      confidence: 0.4,
      source: "fallback",
      supported: false,
      notes: "cyrillic_not_in_v1_set",
    };
  }

  const markerHits = (re: RegExp): number => {
    const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
    const global = new RegExp(re.source, flags);
    return (sample.match(global) || []).length;
  };

  const scores: Array<{ lang: SantaDetectableLanguage; score: number }> = [
    {
      lang: "ro",
      score: markerHits(RO_MARKERS) * 2 + (/[ăâîșțşţ]/i.test(sample) ? 2 : 0),
    },
    {
      lang: "de",
      score: markerHits(DE_MARKERS) * 2 + (/[äöüß]/i.test(sample) ? 1.5 : 0),
    },
    {
      lang: "fr",
      score: markerHits(FR_MARKERS) * 2 + (/[àâçéèêëïîôùûüÿ]/i.test(sample) ? 1 : 0),
    },
    {
      lang: "es",
      score: markerHits(ES_MARKERS) * 2 + (/[ñáéíóú¿¡]/i.test(sample) ? 1.5 : 0),
    },
    { lang: "it", score: markerHits(IT_MARKERS) * 2 },
    {
      lang: "en",
      score: markerHits(EN_MARKERS) * 2 + (LATIN_RE.test(sample) && markerHits(EN_MARKERS) === 0 ? 0.5 : 0),
    },
  ];

  scores.sort((a, b) => b.score - a.score || a.lang.localeCompare(b.lang));
  const top = scores[0];
  const second = scores[1];

  if (!top || top.score < 1) {
    if (preferred) {
      return {
        language: preferred,
        confidence: 0.5,
        source: "fallback",
        supported: true,
        notes: "low_signal_used_preference",
      };
    }
    return {
      language: "en",
      confidence: 0.35,
      source: "fallback",
      supported: true,
      notes: "low_signal_default_en",
    };
  }

  const ambiguous = second && top.score - second.score < 0.75;
  if (ambiguous && preferred) {
    return {
      language: preferred,
      confidence: 0.6,
      source: "hint",
      supported: true,
      notes: "ambiguous_heuristic_prefer_hint",
    };
  }

  return {
    language: top.lang,
    confidence: Math.min(0.95, 0.55 + top.score / 6),
    source: "heuristic",
    supported: true,
  };
}

/**
 * Mid-call language switch: keep current language unless evidence is strong.
 */
export function detectLanguageSwitch(
  text: string,
  current: SantaDetectableLanguage,
): LanguageDetectResult {
  const next = detectLanguageHeuristic(text, { preferred: current === "unknown" ? "en" : current });
  if (next.language === current) return { ...next, notes: "unchanged" };
  if (next.confidence < 0.72) {
    return {
      language: current === "unknown" ? "en" : current,
      confidence: next.confidence,
      source: "fallback",
      supported: current !== "unknown",
      notes: "weak_switch_ignored",
    };
  }
  return { ...next, notes: "switched" };
}
