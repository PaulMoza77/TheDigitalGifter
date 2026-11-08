import { useEffect, useMemo, useState } from "react";
import {
  detectLanguageHeuristic,
  detectLanguageSwitch,
  type SantaDetectableLanguage,
} from "@/features/christmas/santa-call/languageDetect";

type SampleMeta = {
  file: string;
  ttfb_ms: number | null;
  duration_s: number | null;
  sample_cost_usd: number | null;
};

type VoiceCard = {
  id: string;
  provider: string;
  model: string;
  voice: string;
  status: string;
  samples: Record<string, SampleMeta>;
  latency_ttfb_avg_ms: number | null;
  estimated_cost_3min_usd: number | null;
  estimated_cost_3min_ron: number | null;
  languages_confirmed: string[];
  languages_documented?: string[];
  issues: string[];
  authenticity_notes?: string;
  cost_note?: string;
};

type Catalog = {
  generated_at: string;
  script: Record<string, string>;
  cards: VoiceCard[];
  recommendation_draft?: {
    launch_config: { provider: string; model: string; voice: string; reason: string };
    follow_up_when_credentials_arrive: string[];
  };
};

const DETECT_SAMPLES: Array<{ lang: SantaDetectableLanguage; text: string }> = [
  { lang: "ro", text: "Bună Andrei, îmi doresc o bicicletă roșie de Crăciun" },
  { lang: "en", text: "Hello Andrei, I want a red bicycle for Christmas" },
  { lang: "de", text: "Hallo Andrei, ich wünsche mir ein rotes Fahrrad zu Weihnachten" },
  { lang: "fr", text: "Bonjour Andrei, je souhaite un vélo rouge pour Noël" },
  { lang: "es", text: "Hola Andrei, quiero una bicicleta roja para Navidad" },
  { lang: "it", text: "Ciao Andrei, voglio una bicicletta rossa per Natale" },
  { lang: "ar", text: "مرحبا أندري أريد دراجة حمراء" },
];

export default function SantaVoiceBenchmarkPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "measured" | "blocked">("all");

  useEffect(() => {
    void fetch("/santa-voice-benchmark/catalog.json", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`catalog_http_${res.status}`);
        return (await res.json()) as Catalog;
      })
      .then(setCatalog)
      .catch((err) => setError(String(err?.message || err)));
  }, []);

  const cards = useMemo(() => {
    const list = catalog?.cards || [];
    if (filter === "measured") return list.filter((c) => c.status === "MEASURED");
    if (filter === "blocked") return list.filter((c) => c.status.startsWith("BLOCKED"));
    return list;
  }, [catalog, filter]);

  const detectRows = useMemo(() => {
    let current: SantaDetectableLanguage = "ro";
    return DETECT_SAMPLES.map((row) => {
      const initial = detectLanguageHeuristic(row.text);
      const switched = detectLanguageSwitch(row.text, current);
      current = switched.language === "unknown" ? current : switched.language;
      return { ...row, initial, switched };
    });
  }, []);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-6xl">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-500/90">Internal · not public</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Santa Voice Benchmark</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          Compare Santa voice candidates on the same script. OpenAI Realtime samples are measured. Azure and
          ElevenLabs stay blocked until credentials are approved — results are not invented.
        </p>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        {!catalog && !error ? <p className="mt-4 text-sm text-slate-400">Loading catalog…</p> : null}

        {catalog ? (
          <>
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="text-sm font-semibold text-white">Launch recommendation (pending your listen)</h3>
              <p className="mt-2 text-sm text-slate-300">
                <span className="text-amber-200">
                  {catalog.recommendation_draft?.launch_config.provider} /{" "}
                  {catalog.recommendation_draft?.launch_config.model} / voice=
                  {catalog.recommendation_draft?.launch_config.voice}
                </span>
              </p>
              <p className="mt-2 text-sm text-slate-400">{catalog.recommendation_draft?.launch_config.reason}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
                {(catalog.recommendation_draft?.follow_up_when_credentials_arrive || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["measured", "Measured"],
                  ["blocked", "Blocked"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={[
                    "rounded-lg border px-3 py-1.5 text-xs",
                    filter === id
                      ? "border-amber-600/60 bg-amber-950/40 text-amber-100"
                      : "border-slate-800 text-slate-400 hover:bg-slate-900",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
              <span className="self-center text-xs text-slate-500">
                Catalog {new Date(catalog.generated_at).toLocaleString()}
              </span>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {cards.map((card) => (
                <article
                  key={card.id}
                  className="rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{card.voice}</h3>
                      <p className="mt-1 text-xs text-slate-400">
                        {card.provider} · {card.model}
                      </p>
                    </div>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
                        card.status === "MEASURED"
                          ? "bg-emerald-950 text-emerald-300"
                          : "bg-slate-800 text-slate-400",
                      ].join(" ")}
                    >
                      {card.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-300">{card.authenticity_notes}</p>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <div>
                      <dt className="text-slate-500">TTFB avg</dt>
                      <dd className="text-slate-200">
                        {card.latency_ttfb_avg_ms != null ? `${card.latency_ttfb_avg_ms} ms` : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Est. 3 min</dt>
                      <dd className="text-slate-200">
                        {card.estimated_cost_3min_ron != null
                          ? `~${card.estimated_cost_3min_ron} RON`
                          : card.cost_note || "—"}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-slate-500">Languages</dt>
                      <dd className="text-slate-200">
                        {(card.languages_confirmed.length
                          ? card.languages_confirmed
                          : card.languages_documented || []
                        ).join(", ") || "—"}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 space-y-3">
                    {(["ro", "en", "de"] as const).map((lang) => {
                      const sample = card.samples?.[lang];
                      return (
                        <div key={lang} className="rounded-lg border border-slate-800/80 bg-black/20 p-3">
                          <div className="mb-2 flex items-center justify-between text-xs">
                            <span className="font-medium uppercase text-slate-300">{lang}</span>
                            <span className="text-slate-500">
                              {sample?.ttfb_ms != null ? `ttfb ${sample.ttfb_ms}ms` : "no sample"}
                            </span>
                          </div>
                          {sample?.file ? (
                            <audio controls preload="none" className="w-full" src={sample.file}>
                              <track kind="captions" />
                            </audio>
                          ) : (
                            <p className="text-xs text-slate-500">Sample unavailable (credentials blocked).</p>
                          )}
                          {catalog.script?.[lang] ? (
                            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{catalog.script[lang]}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {card.issues?.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-200/80">
                      {card.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>

            <section className="mt-10 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <h3 className="text-sm font-semibold text-white">Multilingual detection prototype</h3>
              <p className="mt-1 text-xs text-slate-400">
                Heuristic + explicit fallback (RO/EN/DE/FR/ES/IT/AR). Not claiming world-language coverage.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-xs text-slate-300">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Expected</th>
                      <th className="py-2 pr-3">Detected</th>
                      <th className="py-2 pr-3">Confidence</th>
                      <th className="py-2 pr-3">Switch from RO chain</th>
                      <th className="py-2">Sample</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detectRows.map((row) => (
                      <tr key={row.lang} className="border-t border-slate-800/80 align-top">
                        <td className="py-2 pr-3 uppercase">{row.lang}</td>
                        <td className="py-2 pr-3 uppercase">{row.initial.language}</td>
                        <td className="py-2 pr-3">{row.initial.confidence.toFixed(2)}</td>
                        <td className="py-2 pr-3">
                          {row.switched.language} ({row.switched.notes || row.switched.source})
                        </td>
                        <td className="py-2 text-slate-400">{row.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
