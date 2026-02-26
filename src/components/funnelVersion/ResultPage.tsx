// src/components/funnelVersion/ResultPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

function addCacheBuster(url: string) {
  const t = Date.now();
  return url.includes("?") ? `${url}&t=${t}` : `${url}?t=${t}`;
}

/**
 * IMPORTANT (Bucket):
 * - final image should be stored in a dedicated bucket (recommended) like: "generations"
 * - set VITE_GENERATIONS_BUCKET="generations"
 * If your DB stores full https URLs, bucket is not used.
 */
async function resolveImageUrl(raw: string | null): Promise<string | null> {
  if (!raw) return null;

  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Full URL already
  if (isHttpUrl(trimmed)) return trimmed;

  // If backend stored "/storage/v1/..." path
  if (trimmed.startsWith("/storage/v1/")) {
    const base = (import.meta as any).env?.VITE_SUPABASE_URL || "";
    return base ? `${base}${trimmed}` : trimmed; // fallback
  }

  // Treat as storage path -> signed URL (best for private bucket)
  const bucket = (import.meta as any).env?.VITE_GENERATIONS_BUCKET || "generations";

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(trimmed, 60 * 60);

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

  // ✅ debug only in dev (keeps UI clean in production)
  const [debug, setDebug] = useState<string>("");
  const DEV = (import.meta as any).env?.DEV === true;

  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

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

      while (!cancelledRef.current && Date.now() - start < maxMs) {
        const { data, error } = await supabase
          .from("generations")
          .select("*")
          .eq("stripe_session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("[ResultPage] DB error:", error);
          if (DEV) setDebug(`DB error: ${error.message}`);
          toast.error(error.message || "Failed to load result");
          break;
        }

        if (data) {
          const g = data as GenerationLoose;

          const status = String(pick(g, ["status", "state"]) ?? "") || null;
          const createdAt = String(pick(g, ["created_at", "createdAt"]) ?? "") || null;

          // ✅ Only trust FINAL fields (so it shows only here, after payment)
          // Prefer: final_image_url
          // Then: final_url (if you have it)
          // Avoid: preview_url, watermark_url etc.
          const rawFinal =
            (pick(g, ["final_image_url", "final_url", "finalImageUrl", "finalUrl"]) as
              | string
              | null) ?? null;

          const resolved = await resolveImageUrl(rawFinal);

          if (DEV) {
            setDebug(
              `id=${String(g.id)} status=${status ?? "?"} rawFinal=${
                rawFinal ?? "null"
              } resolved=${resolved ? "yes" : "no"}`
            );
          }

          if (resolved) {
            if (!cancelledRef.current) {
              setRow({
                id: String(g.id),
                status,
                final_image_url: addCacheBuster(resolved),
                created_at: createdAt,
              });
              setLoading(false);
            }
            return;
          }
        } else {
          if (DEV) setDebug("No generation row for this session_id yet.");
        }

        await new Promise((r) => setTimeout(r, intervalMs));
      }

      if (!cancelledRef.current) {
        setLoading(false);
        toast.message("Still processing. Try Refresh in a moment.");
      }
    }

    void load();

    return () => {
      cancelledRef.current = true;
    };
  }, [sessionId, navigate, DEV]);

  // ================== UI (AliveMoment-ish) ==================
  const url = row?.final_image_url;

  return (
    <div className="min-h-screen w-full bg-[#F3EEE6] text-[#111827]">
      {/* header (same system as other funnel pages) */}
      <div className="pt-10">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-sm text-black/60 hover:text-black/80 transition"
              onClick={() => navigate("/")}
            >
              Back
            </button>

            <div
              className="select-none text-[34px] font-semibold tracking-tight"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              TheDigitalGifter
            </div>

            <div className="text-sm text-black/60">Done</div>
          </div>

          <div className="mt-6 h-px w-full bg-black/10" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl px-6 pb-20 pt-10">
        <div className="mx-auto max-w-2xl text-center">
          <h1
            className="text-[28px] leading-tight sm:text-[40px] sm:leading-tight font-semibold"
            style={{ fontFamily: "ui-serif, Georgia, serif", color: "#0F3D2E" }}
          >
            {loading ? "Preparing your final gift…" : "✓ Your final gift is ready"}
          </h1>

          <p className="mt-3 text-sm sm:text-base text-black/65">
            {loading
              ? "Payment confirmed. We’re finishing the clean, high-quality version."
              : "This is the clean version — no watermark, ready to save or share."}
          </p>
        </div>

        <div className="mx-auto mt-10 w-full max-w-[820px]">
          <div className="rounded-[18px] border border-black/10 bg-white/55 shadow-[0_16px_40px_-26px_rgba(0,0,0,0.35)]">
            <div className="p-6 sm:p-8">
              <div className="overflow-hidden rounded-[16px] border border-black/10 bg-white">
                {loading ? (
                  <div className="flex h-[360px] w-full items-center justify-center">
                    <div className="text-sm text-black/60">Loading…</div>
                  </div>
                ) : url ? (
                  <img
                    src={url}
                    alt="Final result"
                    className="w-full h-auto"
                    onError={() => {
                      toast.error("Image failed to load. Try Refresh.");
                    }}
                  />
                ) : (
                  <div className="flex h-[360px] w-full flex-col items-center justify-center px-6 text-center">
                    <div className="text-sm font-semibold text-black/75">
                      Still finishing your image
                    </div>
                    <div className="mt-2 text-sm text-black/60">
                      It can take a little longer sometimes. Please refresh in a moment.
                    </div>
                    {DEV && debug ? (
                      <div className="mt-4 text-xs text-black/45 break-all">{debug}</div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full sm:w-auto rounded-full border border-black/15 bg-white/70 px-6 py-3 text-sm font-semibold text-black/70 hover:bg-white transition"
                >
                  Refresh
                </button>

                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto rounded-full bg-[#0F3D2E] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0C3326] transition shadow-[0_14px_40px_-26px_rgba(15,61,46,0.9)]"
                  >
                    Open full image
                  </a>
                ) : null}

                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="w-full sm:w-auto rounded-full border border-black/15 bg-white/70 px-6 py-3 text-sm font-semibold text-black/70 hover:bg-white transition"
                >
                  Back home
                </button>
              </div>

              {DEV && debug ? (
                <div className="mt-5 text-xs text-black/45 break-all text-center">{debug}</div>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      <div className="h-14" />
    </div>
  );
}