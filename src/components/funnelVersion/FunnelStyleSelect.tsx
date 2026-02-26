// src/components/funnelVersion/FunnelStyleSelect.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// ✅ preview route
const NEXT_ROUTE = "/funnel/preview";

type TemplateDbRow = {
  id: string;
  title: string | null;
  prompt: string | null;
  occasion: string | null;
  style_id: string | null;
  isactive: boolean | null;
};

type FunnelStyle = {
  id: string; // style_id
  name: string; // title
  script: string; // prompt
};

function safeString(x: unknown) {
  return String(x ?? "").trim();
}

function normalizeOccasion(raw: string) {
  const x = (raw || "").toLowerCase().trim();
  if (x === "new_born" || x === "newborn" || x === "new-born") return "newborn";
  return x || "newborn";
}

/** emoji “vibe” generator (fără DB changes) */
function emojiForStyle(nameOrId: string) {
  const s = (nameOrId || "").toLowerCase();
  if (s.includes("mystery") || s.includes("cinematic") || s.includes("dram")) return "🪄";
  if (s.includes("wave") || s.includes("hello") || s.includes("hi")) return "👋";
  if (s.includes("play") || s.includes("fun") || s.includes("joy")) return "🔴";
  if (s.includes("hug") || s.includes("warm")) return "🫂";
  if (s.includes("kiss") || s.includes("love") || s.includes("rom")) return "💋";
  if (s.includes("walk") || s.includes("move")) return "🚶";
  if (s.includes("flower") || s.includes("bloom")) return "🌸";
  if (s.includes("spark") || s.includes("glow")) return "✨";
  return "✨";
}

export default function FunnelStyleSelect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // context from URL (coming from Upload step)
  const bucket = safeString(searchParams.get("bucket")) || "templates";
  const photoPath = safeString(searchParams.get("photo")); // required for next step
  const slug = safeString(searchParams.get("slug")) || "newborn";

  const occasion = useMemo(() => {
    const fromQs = safeString(searchParams.get("occasion"));
    return normalizeOccasion(fromQs || slug || "newborn");
  }, [searchParams, slug]);

  const [loading, setLoading] = useState(true);
  const [styles, setStyles] = useState<FunnelStyle[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // “alivemoment” header text
  const header = useMemo(() => {
    return {
      title: "How would you like to bring your first photo to life?",
      subtitle: "Choose an animation style that feels right for your memory.",
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const fetchStyles = async () => {
      setLoading(true);
      setErrorMsg(null);

      const primaryOccasion = occasion;
      const legacyOccasion = primaryOccasion === "newborn" ? "new_born" : null;

      const runQuery = async (occ: string) => {
        return await supabase
          .from("templates")
          .select(["id", "title", "prompt", "occasion", "style_id", "isactive"].join(","))
          .eq("isactive", true)
          .eq("occasion", occ)
          .order("style_id", { ascending: true });
      };

      let data: any[] = [];

      const q1 = await runQuery(primaryOccasion);
      if (q1.error) {
        if (!alive) return;
        console.error("[FunnelStyleSelect] fetch templates error:", q1.error);
        setErrorMsg(q1.error.message || "Failed to load styles.");
        setStyles([]);
        setLoading(false);
        return;
      }
      data = q1.data ?? [];

      if (data.length === 0 && legacyOccasion) {
        const q2 = await runQuery(legacyOccasion);
        if (!q2.error) data = q2.data ?? [];
      }

      if (!alive) return;

      const mapped: FunnelStyle[] = (data ?? [])
        .map((r) => r as unknown as TemplateDbRow)
        .filter((r) => safeString(r.style_id).length > 0)
        .map((r) => ({
          id: safeString(r.style_id),
          name: safeString(r.title) || safeString(r.style_id),
          script: safeString(r.prompt),
        }));

      setStyles(mapped);
      setLoading(false);
    };

    void fetchStyles();

    return () => {
      alive = false;
    };
  }, [occasion]);

  const goNext = (style: FunnelStyle) => {
    setErrorMsg(null);

    if (!photoPath) {
      setErrorMsg("Missing photo reference. Please go back and upload your photo again.");
      return;
    }

    // optional: store for internal use
    try {
      window.localStorage.setItem(
        "tdg_funnel_session",
        JSON.stringify({
          gift_type: occasion,
          style_id: style.id,
          script: style.script,
        })
      );
      window.localStorage.setItem("tdg_funnel_style", style.id);
      window.localStorage.setItem("tdg_funnel_slug", slug || occasion);
      window.localStorage.setItem("tdg_funnel_bucket", bucket);
      window.localStorage.setItem("tdg_funnel_photo_path", photoPath);
    } catch {
      // ignore
    }

    const qs = new URLSearchParams({
      bucket,
      photo: photoPath,
      slug: slug || occasion,
      style: style.id,
    });

    navigate(`${NEXT_ROUTE}?${qs.toString()}`);
  };

  const onBack = () => {
    // dacă ai un route dedicat upload step, schimbă aici:
    navigate(-1);
  };

  return (
    <div className="min-h-screen w-full bg-[#F5F1EA] text-[#1F2937]">
      {/* top bar */}
      <div className="px-5 pt-6 sm:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-[#1F2937]/80 hover:text-[#1F2937] transition"
            >
              Back
            </button>

            <div className="text-lg font-semibold tracking-wide" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
              alivemoment
            </div>

            <div className="text-sm text-[#1F2937]/70">2 of 2</div>
          </div>

          {/* progress bar */}
          <div className="mt-5 h-[3px] w-full rounded-full bg-black/10">
            <div className="h-[3px] w-[100%] rounded-full bg-[#0F3D2E]" />
          </div>
        </div>
      </div>

      {/* main */}
      <div className="px-5 pb-14 pt-10 sm:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h1
            className="text-2xl sm:text-4xl font-semibold"
            style={{ fontFamily: "ui-serif, Georgia, serif", color: "#0F3D2E" }}
          >
            {header.title}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#1F2937]/70">{header.subtitle}</p>
        </div>

        <div className="mx-auto mt-8 max-w-2xl">
          {!photoPath ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Missing photo reference. Please go back and upload your photo again.
            </div>
          ) : null}

          {errorMsg ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMsg}
            </div>
          ) : null}

          <div className="space-y-3">
            {loading ? (
              <>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[#D8DDE6] bg-white/60 px-5 py-4"
                  >
                    <div className="h-4 w-40 rounded bg-black/10" />
                    <div className="mt-2 h-3 w-64 rounded bg-black/5" />
                  </div>
                ))}
              </>
            ) : styles.length === 0 ? (
              <div className="rounded-xl border border-[#D8DDE6] bg-white/60 px-5 py-6 text-center">
                <div className="text-sm font-semibold">No styles found</div>
                <div className="mt-1 text-xs text-[#1F2937]/60">
                  Add templates with <b>occasion = {occasion}</b> and a <b>style_id</b>.
                </div>
              </div>
            ) : (
              styles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => goNext(style)} // ✅ instant continue
                  disabled={!photoPath}
                  className={cn(
                    "w-full text-left rounded-xl border px-5 py-4 transition",
                    "border-[#D8DDE6] bg-white/70 hover:bg-white",
                    "focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]/25",
                    !photoPath && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-lg">{emojiForStyle(style.name || style.id)}</div>
                    <div className="text-sm font-medium text-[#1F2937]">{style.name}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}