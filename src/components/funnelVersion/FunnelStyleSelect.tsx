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
  name: string; // title (REAL from DB)
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

const NEXT_ROUTE = "/funnel/preview";

// ------- marketing helpers (DIFFERENT per template) -------

function emojiForStyle(title: string) {
  const s = (title || "").toLowerCase();

  if (s.includes("angel")) return "👼";
  if (s.includes("cozy") || s.includes("blanket")) return "🧸";
  if (s.includes("first") || s.includes("light") || s.includes("sun")) return "🌅";
  if (s.includes("gold") || s.includes("golden")) return "✨";
  if (s.includes("minimal")) return "🕊️";
  if (s.includes("pastel") || s.includes("soft")) return "🎀";
  if (s.includes("dream") || s.includes("sleep")) return "🌙";
  if (s.includes("film") || s.includes("cinema")) return "🎞️";
  if (s.includes("warm")) return "🫂";

  return "✨";
}

/**
 * HIGH-INTENT, UNIQUE descriptions per template title.
 * - exact matches (ideal for your current set)
 * - plus smart fallbacks so any new template still gets a distinct description
 */
function descriptionForTemplateTitle(title: string) {
  const t = (title || "").trim();
  const s = t.toLowerCase();

  // ✅ exact-name descriptions (your screenshot set)
  if (s === "angel sleep") {
    return "A serene, dreamy motion that feels like a lullaby — calm, tender, and instantly heart-melting.";
  }
  if (s === "cozy blanket") {
    return "Warm, comforting movement with a soft “home” feeling — perfect for snuggly, intimate moments.";
  }
  if (s === "first light") {
    return "A gentle sunrise-style reveal — clean, hopeful, and beautifully cinematic without feeling overdone.";
  }
  if (s === "golden memory") {
    return "A premium golden glow that elevates the moment — nostalgic, radiant, and made to be shared.";
  }
  if (s === "minimal studio") {
    return "Modern, clean, and editorial — subtle motion with a polished finish that looks expensive.";
  }
  if (s === "soft pastel") {
    return "A delicate pastel touch with smooth, airy motion — sweet, elegant, and gift-ready.";

  }

  // ✅ smart fallbacks by keywords (still varied)
  if (s.includes("angel")) {
    return "Soft, heavenly motion with a gentle glow — tender, peaceful, and emotionally rich.";
  }
  if (s.includes("sleep") || s.includes("dream")) {
    return "A dreamy, slow-motion feel — soothing, intimate, and perfect for quiet memories.";
  }
  if (s.includes("cozy") || s.includes("blanket") || s.includes("warm")) {
    return "Warm, comforting movement — like a hug in motion, soft and reassuring.";
  }
  if (s.includes("first") || s.includes("light") || s.includes("sunrise")) {
    return "A bright, uplifting reveal — clean, cinematic, and naturally beautiful.";
  }
  if (s.includes("gold") || s.includes("golden") || s.includes("glow")) {
    return "A premium glow that adds warmth and depth — timeless, radiant, and share-worthy.";
  }
  if (s.includes("minimal") || s.includes("studio") || s.includes("editorial")) {
    return "Minimal, modern, and polished — subtle motion that feels premium and intentional.";
  }
  if (s.includes("pastel") || s.includes("soft") || s.includes("pink")) {
    return "Soft, delicate color energy — gentle motion with a sweet, elegant finish.";
  }
  if (s.includes("cinema") || s.includes("film") || s.includes("movie")) {
    return "Cinematic motion with tasteful depth — dramatic in a subtle, premium way.";
  }

  // default (still “high intent”, not generic “click to continue”)
  return "A premium motion style designed to make your photo feel alive — elegant, emotional, and gift-ready.";
}

// Title adapted to TheDigitalGifter + occasion
function headerForOccasion(occasion: string) {
  if (occasion === "newborn") {
    return {
      title: "Choose the style for your newborn memory",
      subtitle: "Pick a vibe — we’ll generate a beautiful preview in seconds.",
    };
  }
  return {
    title: "Choose the style for your digital gift",
    subtitle: "Pick a vibe — we’ll generate a beautiful preview in seconds.",
  };
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

  const header = useMemo(() => headerForOccasion(occasion), [occasion]);

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
          name: safeString(r.title) || safeString(r.style_id), // ✅ REAL titles
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
      {/* Brand */}
      <div className="pt-10">
        <div className="mx-auto max-w-5xl px-6">
          <div
            className="text-center text-[34px] font-semibold tracking-tight"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}
          >
            TheDigitalGifter
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
            {header.title}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#111827]/70">
            {header.subtitle}
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
                    className="rounded-[10px] border border-[#D7DEEA] bg-white/40 px-6 py-5"
                  >
                    <div className="h-4 w-56 rounded bg-black/10" />
                    <div className="mt-2 h-3 w-80 rounded bg-black/5" />
                  </div>
                ))}
              </>
            ) : styles.length === 0 ? (
              <div className="rounded-[10px] border border-[#D7DEEA] bg-white/40 px-6 py-6 text-center">
                <div className="text-sm font-semibold">No styles found</div>
                <div className="mt-1 text-xs text-[#111827]/60">
                  Add templates with <b>occasion = {occasion}</b> and a <b>style_id</b>.
                </div>
              </div>
            ) : (
              styles.map((style) => {
                const emoji = emojiForStyle(style.name);
                const desc = descriptionForTemplateTitle(style.name);

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

          <div className="mt-10 text-center text-[11px] text-[#111827]/45">
            Your preview is generated instantly. Unlock the clean final after checkout.
          </div>
        </div>
      </div>
    </div>
  );
}