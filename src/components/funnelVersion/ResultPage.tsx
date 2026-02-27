// src/components/funnelVersion/ResultPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Separator } from "@/components/ui/separator";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

type ResultRow = {
  id: string;
  status: string | null;
  final_image_url: string | null; // full https URL OR signed URL
  final_bucket: string | null; // optional
  final_storage_path: string | null; // optional
  created_at: string | null;
  updated_at: string | null;
};

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test((s || "").trim());
}

/**
 * If you store outputs in private storage (bucket+path), we create a signed URL.
 * If final_image_url is already http(s), we use it directly.
 */
async function resolveFinalUrl(row: ResultRow): Promise<string | null> {
  const direct = (row.final_image_url || "").trim();
  if (direct && isHttpUrl(direct)) return direct;

  const bucket = (row.final_bucket || "").trim();
  const path = (row.final_storage_path || "").trim();

  if (!bucket || !path) return direct || null;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);

  if (error) return null;
  return data?.signedUrl ?? null;
}

export default function ResultPage() {
  const q = useQuery();
  const navigate = useNavigate();

  const sessionId = (q.get("session_id") || "").trim();

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<ResultRow | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [debug, setDebug] = useState<string>("");

  const stepLabel = useMemo(() => "3 of 3", []);
  const pageBg = useMemo(() => ({ background: "#f6f1ea" as const }), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!sessionId) {
        setLoading(false);
        setDebug("Missing session_id in URL.");
        return;
      }

      setLoading(true);
      setRow(null);
      setFinalUrl(null);
      setDebug("");

      const start = Date.now();
      const maxMs = 120_000; // 2 min
      const intervalMs = 1500;

      while (!cancelled && Date.now() - start < maxMs) {
        let r: ResultRow | null = null;

        // 1) RPC (recommended)
        try {
          const { data, error } = await supabase.rpc("get_generation_by_session", {
            p_session_id: sessionId,
          });

          if (!error && Array.isArray(data) && data.length > 0) {
            const x = data[0] as any;
            r = {
              id: String(x.id ?? ""),
              status: x.status ?? null,
              final_image_url: x.final_image_url ?? null,
              final_bucket: x.final_bucket ?? null,
              final_storage_path: x.final_storage_path ?? null,
              created_at: x.created_at ?? null,
              updated_at: x.updated_at ?? null,
            };
          } else if (error) {
            const msg = String(error.message || "");
            // nu spamam debug daca functia nu exista (caz normal)
            const low = msg.toLowerCase();
            if (!low.includes("function") && !low.includes("rpc")) {
              setDebug(`RPC error: ${msg}`);
            }
          }
        } catch {
          // ignore -> fallback
        }

        // 2) Fallback direct select
        if (!r) {
          const { data, error } = await supabase
            .from("generations")
            .select(
              "id,status,final_image_url,final_bucket,final_storage_path,created_at,updated_at"
            )
            .eq("stripe_session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            setDebug(`DB error: ${error.message || "Unknown"}`);
            break;
          }

          if (data) {
            const x = data as any;
            r = {
              id: String(x.id ?? ""),
              status: x.status ?? null,
              final_image_url: x.final_image_url ?? null,
              final_bucket: x.final_bucket ?? null,
              final_storage_path: x.final_storage_path ?? null,
              created_at: x.created_at ?? null,
              updated_at: x.updated_at ?? null,
            };
          }
        }

        if (r) {
          if (!cancelled) setRow(r);

          const url = await resolveFinalUrl(r);

          if (!cancelled) {
            setDebug(
              `found id=${r.id || "?"} status=${r.status || "?"} final_image_url=${
                r.final_image_url ? "yes" : "no"
              } bucket=${r.final_bucket || "—"} path=${r.final_storage_path || "—"} resolved=${
                url ? "yes" : "no"
              }`
            );
          }

          if (url) {
            if (!cancelled) {
              setFinalUrl(url);
              setLoading(false);
            }
            return;
          }
        } else {
          if (!cancelled) setDebug("No generation row found yet for this session_id.");
        }

        await new Promise((res) => setTimeout(res, intervalMs));
      }

      if (!cancelled) setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="min-h-screen" style={pageBg}>
        <header className="mx-auto w-full max-w-5xl px-6 pt-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-sm text-zinc-700 hover:text-zinc-900 transition"
              onClick={() => navigate("/")}
            >
              Back
            </button>

            <div className="select-none text-xl tracking-wide font-semibold">
              TheDigitalGifter
            </div>

            <div className="text-sm text-zinc-700">{stepLabel}</div>
          </div>

          <div className="mt-5">
            <Separator className="bg-zinc-200" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-6">
          <div className="flex flex-col items-center justify-center py-14">
            <h1 className="text-center text-4xl md:text-5xl font-semibold text-[#0b3b2e]">
              We couldn’t open your result
            </h1>
            <p className="mt-3 max-w-xl text-center text-base md:text-lg text-zinc-700">
              The payment session is missing. Please return to the start and try again.
            </p>

            {debug ? (
              <div className="mt-6 max-w-xl rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 text-xs text-zinc-600 break-all">
                {debug}
              </div>
            ) : null}

            <div className="mt-8">
              <button
                type="button"
                className="rounded-full bg-[#0b3b2e] px-8 py-3 text-sm font-semibold text-white hover:bg-[#082c22] transition"
                onClick={() => navigate("/funnel/uploadPhoto")}
              >
                Start again
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={pageBg}>
      <header className="mx-auto w-full max-w-5xl px-6 pt-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="text-sm text-zinc-700 hover:text-zinc-900 transition"
            onClick={() => navigate("/")}
          >
            Back
          </button>

          <div className="select-none text-xl tracking-wide font-semibold">
            TheDigitalGifter
          </div>

          <div className="text-sm text-zinc-700">{stepLabel}</div>
        </div>

        <div className="mt-5">
          <Separator className="bg-zinc-200" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6">
        <div className="flex flex-col items-center justify-center py-14">
          <h1 className="text-center text-4xl md:text-5xl font-semibold text-[#0b3b2e]">
            {finalUrl ? "Your gift is ready ✓" : loading ? "Finishing your gift…" : "Almost there…"}
          </h1>

          <p className="mt-3 max-w-xl text-center text-base md:text-lg text-zinc-700">
            {finalUrl
              ? "Here’s the full-quality version — clean, sharp, and ready to share."
              : "We’re creating the full-quality image now. This usually takes a moment."}
          </p>

          <div className="mt-10 w-full max-w-3xl">
            <div className="rounded-3xl border border-zinc-200 bg-white/55 shadow-sm p-4 md:p-6 overflow-hidden">
              <div className="relative w-full overflow-hidden rounded-2xl border bg-white">
                {finalUrl ? (
                  <img
                    src={finalUrl}
                    alt="Final result"
                    className="w-full h-auto object-contain"
                    onError={() => setDebug((d) => `${d}\nIMG error loading finalUrl`)}
                  />
                ) : (
                  <div className="flex min-h-[360px] items-center justify-center bg-white">
                    <div className="text-center">
                      <div className="text-sm font-medium text-zinc-800">
                        {loading ? "Generating your final image…" : "Result not ready yet"}
                      </div>
                      <div className="mt-1 text-sm text-zinc-600">
                        {loading
                          ? "Keep this tab open — we’ll show it as soon as it’s ready."
                          : "Click Refresh and we’ll check again."}
                      </div>
                      {debug ? (
                        <div className="mt-4 text-xs text-zinc-500 break-all max-w-[520px] mx-auto">
                          {debug}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition"
                >
                  Refresh
                </button>

                {finalUrl ? (
                  <a
                    href={finalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-[#0b3b2e] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#082c22] transition"
                  >
                    Open full image
                  </a>
                ) : null}

                <button
                  type="button"
                  onClick={() => navigate("/funnel/uploadPhoto")}
                  className="rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition"
                >
                  Start new gift
                </button>
              </div>

              <div className="mt-4 text-center text-xs text-zinc-500">
                Tip: save the image or open it in a new tab for the best quality.
              </div>
            </div>
          </div>

          {debug ? (
            <div className="mt-6 max-w-3xl rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 text-xs text-zinc-600 break-all">
              {debug}
            </div>
          ) : null}
        </div>
      </main>

      <div className="h-14" />
    </div>
  );
}