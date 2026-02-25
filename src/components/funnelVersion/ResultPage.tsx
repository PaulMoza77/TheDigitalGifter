import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

type GenerationRow = {
  id: string;
  status: string;
  final_image_url: string | null;
  created_at: string;
};

export default function ResultPage() {
  const q = useQuery();
  const navigate = useNavigate();

  const sessionId = q.get("session_id") || "";
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<GenerationRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!sessionId) {
        toast.error("Missing session_id");
        navigate("/", { replace: true });
        return;
      }

      setLoading(true);

      // Poll: așteptăm webhook-ul să scrie final_image_url în DB
      const start = Date.now();
      const maxMs = 60_000; // 60s
      const intervalMs = 1500;

      while (!cancelled && Date.now() - start < maxMs) {
        const { data, error } = await supabase
          .from("generations")
          .select("id,status,final_image_url,created_at")
          .eq("stripe_session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error(error);
          toast.error(error.message || "Failed to load result");
          break;
        }

        if (data && data.final_image_url) {
          if (!cancelled) {
            setRow(data as GenerationRow);
            setLoading(false);
          }
          return;
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
        <p className="mt-2 text-slate-400">
          This is the final version (no watermark).
        </p>

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 overflow-hidden">
          {url ? (
            <img
              src={url}
              alt="Final result"
              className="w-full h-auto rounded-xl"
            />
          ) : (
            <div className="p-6 text-slate-400">
              Result not ready yet. Hit Refresh in a few seconds.
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
      </div>
    </div>
  );
}