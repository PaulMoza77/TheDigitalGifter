import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type FunnelSession = {
  gift_type?: string;
  style_id?: string;
  script?: string;
  email?: string;
  lead_id?: string | number | null;
  funnel_slug?: string;
  generation_id?: string | null;
  template_id?: string | null;
  occasion?: string | null;
  photo_bucket?: string | null;
  photo_path?: string | null;
};

function readSession(): FunnelSession | null {
  try {
    return JSON.parse(localStorage.getItem("tdg_funnel_session") || "null") as FunnelSession | null;
  } catch {
    return null;
  }
}

function writeSession(next: FunnelSession) {
  try {
    localStorage.setItem("tdg_funnel_session", JSON.stringify(next));
  } catch {
    // ignore
  }
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function safeString(x: unknown) {
  return String(x ?? "").trim();
}

function isHttpUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

const SUPABASE_URL = "https://rmdsnpckutsucabledqz.supabase.co";

function resolvePublicObjectUrl(bucket: string, path: string) {
  const p = (path || "").replace(/^\/+/, "");
  if (!p) return "";
  if (isHttpUrl(p)) return p;
  if (p.startsWith("/storage/v1/")) return `${SUPABASE_URL}${p}`;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${p}`;
}

function getStoredPhotoRef(): { bucket: string; path: string } | null {
  const s = readSession();

  const bucket =
    safeString(s?.photo_bucket) ||
    safeString(localStorage.getItem("tdg_funnel_bucket")) ||
    "templates";

  const p1 =
    safeString(s?.photo_path) ||
    safeString(localStorage.getItem("tdg_funnel_photo_path")) ||
    safeString(localStorage.getItem("tdg_funnel_photo"));

  if (p1) return { bucket, path: p1 };

  const p2 = safeString(localStorage.getItem("tdg_uploaded_photo_path"));
  if (p2) return { bucket, path: p2 };

  return null;
}

function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={cx(
        "inline-flex select-none items-center justify-center rounded-full px-7 py-3 text-sm font-semibold transition",
        "bg-[#0f3d2e] text-white hover:bg-[#0c3326] active:scale-[0.99]",
        "shadow-[0_14px_40px_-26px_rgba(15,61,46,0.9)]",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        props.className
      )}
    >
      {props.children}
    </button>
  );
}

export default function FunnelPreview() {
  const navigate = useNavigate();

  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [hasPhoto, setHasPhoto] = useState(false);

  const redirectTimerRef = useRef<number | null>(null);

  const goNext = useCallback(() => {
    const s = readSession();
    const email = String(s?.email || "").trim().toLowerCase();
    navigate(email ? "/funnel/payment" : "/funnel/email");
  }, [navigate]);

  useEffect(() => {
    const ref = getStoredPhotoRef();
    const s = readSession() || {};

    if (!ref?.path) {
      redirectTimerRef.current = window.setTimeout(() => {
        navigate("/funnel/uploadPhoto", { replace: true });
      }, 250);
      return;
    }

    writeSession({
      ...s,
      photo_bucket: ref.bucket,
      photo_path: ref.path,
    });

    const url = resolvePublicObjectUrl(ref.bucket || "templates", ref.path);
    setPhotoUrl(url);
    setHasPhoto(!!url);

    return () => {
      if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current);
    };
  }, [navigate]);

  const bg = useMemo(
    () =>
      ({
        backgroundColor: "#F3EEE6",
      }) as React.CSSProperties,
    []
  );

  return (
    <div className="min-h-screen w-full" style={bg}>
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

      <div className="mx-auto max-w-5xl px-6 pb-20 pt-10">
        <div className="mx-auto max-w-2xl text-center">
          <h1
            className="text-[28px] leading-tight sm:text-[40px] sm:leading-tight font-semibold"
            style={{ fontFamily: "ui-serif, Georgia, serif", color: "#0F3D2E" }}
          >
            ✓ Your preview is ready
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#111827]/70">
            You’re one step away from unlocking the clean, full-quality version.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          <div className="flex items-center justify-center">
            <div className="w-full">
              <div className="mx-auto w-full max-w-[680px]">
                <div className="relative overflow-hidden rounded-[18px] border border-black/10 bg-white/40 shadow-[0_16px_40px_-26px_rgba(0,0,0,0.45)]">
                  <div className="relative w-full" style={{ paddingTop: "62%" }}>
                    <div className="absolute inset-0">
                      {hasPhoto ? (
                        <>
                          <img
                            src={photoUrl}
                            alt="Your photo (blurred preview)"
                            className="h-full w-full object-cover"
                            style={{
                              filter: "blur(18px)",
                              transform: "scale(1.06)",
                            }}
                            draggable={false}
                            onDragStart={(e) => e.preventDefault()}
                          />
                          <div className="absolute inset-0 bg-[#F3EEE6]/30" />
                          <div
                            className="absolute inset-0"
                            style={{
                              opacity: 0.12,
                              mixBlendMode: "overlay",
                              backgroundImage:
                                "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"140\" height=\"140\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"2\" stitchTiles=\"stitch\"/></filter><rect width=\"140\" height=\"140\" filter=\"url(%23n)\" opacity=\"0.35\"/></svg>')",
                              backgroundSize: "140px 140px",
                            }}
                          />
                        </>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-black/5">
                          <div className="text-sm text-black/60">No photo found. Redirecting…</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-center">
                  <Button onClick={goNext} disabled={!hasPhoto} className="w-full max-w-[420px]">
                    Unlock Full Quality
                  </Button>
                </div>

                <div className="mt-3 text-center text-xs text-[#111827]/55">
                  You’ll unlock the clean result after checkout.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="h-10" />
      </div>
    </div>
  );
}