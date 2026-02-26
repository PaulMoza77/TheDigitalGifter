import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

type GenerationLoose = Record<string, any>;

type GenerationRow = {
  id: string;
  status: string | null;
  final_image_url: string | null; // resolved URL (http or signed)
  created_at: string | null;
};

function pick(obj: any, keys: string[]) {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null && obj?.[k] !== "") return obj[k];
  }
  return null;
}

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

async function resolveImageUrl(raw: string | null): Promise<string | null> {
  if (!raw) return null;
  if (isHttpUrl(raw)) return raw;

  // Dacă primești doar o cale (ex: "generations/abc.png"),
  // încearcă să o semnezi din Storage.
  // IMPORTANT: setează bucketul real în env (recomandat) sau schimbă default-ul.
  const bucket = (import.meta as any).env?.VITE_MEDIA_BUCKET || "site-media";

  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(raw, 60 * 60);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export default function ResultPage() {
  const q = useQuery();
  const navigate = useNavigate();

  const sessionId = q.get("session_id") || "";
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<GenerationRow | null>(null);
  const [debug, setDebug] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!sessionId) {
        toast.error("Missing session_id");
        navigate("/", { replace: true });
        return;
      }

      setLoading(true);
      setRow(null);
      setDebug("");

      const start = Date.now();
      const maxMs = 90_000; // 90s
      const intervalMs = 1500;

      while (!cancelled && Date.now() - start < maxMs) {
        // IMPORTANT: select("*") + map sinonime
        const { data, error } = await supabase
          .from("generations")
          .select("*")
          .eq("stripe_session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error(error);
          setDebug(`DB error: ${error.message}`);
          toast.error(error.message || "Failed to load result");
          break;
        }

        if (data) {
          const loose = data as GenerationLoose;

          const status = String(pick(loose, ["status", "state"]) ?? "");
          const createdAt = String(pick(loose, ["created_at", "createdAt"]) ?? "");
          const rawUrl =
            (pick(loose, ["final_image_url", "finalImageUrl"]) as string | null) ??
            (pick(loose, ["output_url", "outputUrl"]) as string | null) ??
            (pick(loose, ["result_url", "resultUrl"]) as string | null) ??
            (pick(loose, ["image_url", "imageUrl"]) as string | null);

          // dacă e storage path, îl convertim în signed url
          const resolved = await resolveImageUrl(rawUrl);

          setDebug(
            `found id=${String(loose.id)} status=${status || "?"} rawUrl=${rawUrl || "null"} resolved=${
              resolved ? "yes" : "no"
            }`
          );

          if (resolved) {
            if (!cancelled) {
              setRow({
                id: String(loose.id),
                status: status || null,
                final_image_url: resolved,
                created_at: createdAt || null,
              });
              setLoading(false);
            }
            return;
          }

          // dacă încă nu avem URL, continuăm polling
        } else {
          setDebug("No generation row found for this session_id yet.");
        }

        await new Promise((r) => setTimeout(r, intervalMs));
      }

      if (!cancelled) {
        setLoading(false);
        toast.message("Still processing. Try Refresh in a moment.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold">Preparing your result…</h1>
          <p className="mt-2 text-slate-400">
            Payment confirmed. We’re generating the final image (no watermark).
          </p>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="text-slate-400">Loading…</div>
            {debug ? (
              <div className="mt-3 text-xs text-slate-500 break-all">{debug}</div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const url = row?.final_image_url;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold">Your image is ready ✅</h1>
        <p className="mt-2 text-slate-400">This is the final version (no watermark).</p>

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 overflow-hidden">
          {url ? (
            <img src={url} alt="Final result" className="w-full h-auto rounded-xl" />
          ) : (
            <div className="p-6 text-slate-400">
              Result not ready yet (or URL not accessible). Hit Refresh in a few seconds.
              {debug ? <div className="mt-3 text-xs text-slate-500 break-all">{debug}</div> : null}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-slate-700 px-5 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Refresh
          </button>

          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              Open full image
            </a>
          ) : null}

          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-full border border-slate-700 px-5 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Back home
          </button>
        </div>

        {debug ? <div className="mt-4 text-xs text-slate-600 break-all">{debug}</div> : null}
      </div>
    </div>
  );
}