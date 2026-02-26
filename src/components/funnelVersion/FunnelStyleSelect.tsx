// src/components/funnelVersion/FunnelStyleSelect.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeString(x: unknown) {
  return String(x ?? "").trim();
}

function normalizeOccasion(raw: string) {
  const x = (raw || "").toLowerCase().trim();
  if (x === "new_born" || x === "newborn" || x === "new-born") return "newborn";
  return x || "newborn";
}

// ✅ next route (preview)
const NEXT_ROUTE = "/funnel/preview";

/**
 * Emoji mapping:
 * - If you later add a column in DB (ex: templates.emoji), we can use it.
 * - For now, deterministic mapping by style name.
 */
function emojiForStyle(nameOrId: string) {
  const s = (nameOrId || "").toLowerCase();
  if (s.includes("mystery") || s.includes("cinematic") || s.includes("dram")) return "🪄";
  if (s.includes("friendly") || s.includes("wave") || s.includes("hello")) return "👋";
  if (s.includes("play") || s.includes("fun") || s.includes("joy")) return "🔴";
  if (s.includes("hug") || s.includes("warm")) return "🫂";
  if (s.includes("kiss") || s.includes("love") || s.includes("rom")) return "💋";
  if (s.includes("walk") || s.includes("move")) return "🚶";
  if (s.includes("flower") || s.includes("bloom")) return "🌸";
  if (s.includes("spark") || s.includes("glow")) return "✨";
  return "✨";
}

/**
 * Subtitle line under the style name.
 * (Optional: you can delete this and keep only title if you want “strict” minimal.)
 */
function descriptionForStyle(nameOrId: string) {
  const s = (nameOrId || "").toLowerCase();
  if (s.includes("mystery")) return "Every photo is unique. Our AI picks the best motion for your memory.";
  if (s.includes("friendly") || s.includes("wave")) return "Add a natural, heartwarming wave — simple and welcoming.";
  if (s.includes("play")) return "Lively and joyful — perfect for fun, happy memories.";
  if (s.includes("hug")) return "Bring the feeling of closeness to life with a gentle embrace.";
  if (s.includes("kiss")) return "Showcase affection with a soft, romantic gesture.";
  if (s.includes("walk")) return "Add calm, lifelike movement as if you’re walking through time.";
  if (s.includes("flower") || s.includes("bloom")) return "Watch gentle flowers bloom around your photo, adding a touch of life.";
  return "Choose this vibe to continue.";
}

export default function FunnelStyleSelect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // context from Upload step
  const bucket = safeString(searchParams.get("bucket")) || "templates";
  const photoPath = safeString(searchParams.get("photo"));
  const slug = safeString(searchParams.get("slug")) || "newborn";

  const occasion = useMemo(() => {
    const fromQs = safeString(searchParams.get("occasion"));
    return normalizeOccasion(fromQs || slug || "newborn");
  }, [searchParams, slug]);

  const [loading, setLoading] = useState(true);
  const [styles, setStyles] = useState<FunnelStyle[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen w-full bg-[#F3EEE6] text-[#111827]">
      {/* Top brand */}
      <div className="pt-10">
        <div className="mx-auto max-w-5xl px-6">
          <div
            className="text-center text-[34px] font-semibold tracking-tight"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            alivemoment
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-10">
        <div className="mx-auto max-w-2xl text-center">
          <h1
            className="text-[28px] leading-tight sm:text-[40px] sm:leading-tight font-semibold"
            style={{ fontFamily: "ui-serif, Georgia, serif", color: "#0F3D2E" }}
          >
            How would you like to bring your first <br className="hidden sm:block" />
            photo to life?
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#111827]/70">
            Choose an animation style that feels right for your memory.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-xl">
          {!photoPath ? (
            <div className="mb-4 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Missing photo reference. Please go back and upload your photo again.
            </div>
          ) : null}

          {errorMsg ? (
            <div className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMsg}
            </div>
          ) : null}

          <div className="space-y-3">
            {loading ? (
              <>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-[10px] border border-[#D8DDE6] bg-white/40 px-6 py-5"
                  >
                    <div className="h-4 w-48 rounded bg-black/10" />
                    <div className="mt-2 h-3 w-72 rounded bg-black/5" />
                  </div>
                ))}
              </>
            ) : styles.length === 0 ? (
              <div className="rounded-[10px] border border-[#D8DDE6] bg-white/40 px-6 py-6 text-center">
                <div className="text-sm font-semibold">No styles found</div>
                <div className="mt-1 text-xs text-[#111827]/60">
                  Add templates with <b>occasion = {occasion}</b> and a <b>style_id</b>.
                </div>
              </div>
            ) : (
              styles.map((style) => {
                const emoji = emojiForStyle(style.name || style.id);
                const desc = descriptionForStyle(style.name || style.id);

                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => goNext(style)} // ✅ instant continue
                    disabled={!photoPath}
                    className={cn(
                      "w-full text-left rounded-[10px] border px-6 py-5 transition",
                      "border-[#D7DEEA] bg-[#F6F1E9] hover:bg-[#F8F4EE]",
                      "focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]/20",
                      !photoPath && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="pt-[1px] text-[14px] leading-none">{emoji}</div>
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-[#111827]">
                          {style.name}
                        </div>
                        <div className="mt-1 text-[12px] leading-snug text-[#111827]/55">
                          {desc}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* tiny footnote (optional) */}
          <div className="mt-10 text-center text-[11px] text-[#111827]/45">
            Clicking a style will generate your watermarked preview next.
          </div>
        </div>
      </div>
    </div>
  );
}