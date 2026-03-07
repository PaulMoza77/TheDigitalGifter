import React, { JSX, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function isValidEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

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

function writeSession(next: FunnelSession): void {
  try {
    localStorage.setItem("tdg_funnel_session", JSON.stringify(next));
  } catch {
    // ignore
  }
}

type FunnelLeadUpsert = {
  email: string;
  occasion: string | null;
  style_id: string | null;
  funnel_slug: string;
};

type FunnelLeadRow = {
  id: string | number;
};

type SupabaseLikeError = {
  message?: string;
  error_description?: string;
  hint?: string;
};

export default function FunnelEmailCapture(): JSX.Element {
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>("");
  const [touched, setTouched] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const trimmedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const emailOk = useMemo(() => isValidEmail(trimmedEmail), [trimmedEmail]);

  const emailError: string = !touched
    ? ""
    : !trimmedEmail
      ? "Email is required."
      : !emailOk
        ? "Please enter a valid email."
        : "";

  useEffect((): void => {
    const s = readSession();
    const photo =
      String(s?.photo_path || "").trim() ||
      String(localStorage.getItem("tdg_funnel_photo") || "").trim() ||
      String(localStorage.getItem("tdg_funnel_photo_path") || "").trim();

    if (!photo) {
      navigate("/funnel/uploadPhoto", { replace: true });
      return;
    }

    const existingEmail = String(s?.email || "").trim().toLowerCase();

    if (existingEmail && isValidEmail(existingEmail)) {
      navigate("/funnel/payment", { replace: true });
      return;
    }

    if (existingEmail) setEmail(existingEmail);
  }, [navigate]);

  async function handleContinue(): Promise<void> {
    const e = email.trim().toLowerCase();
    setTouched(true);

    if (!isValidEmail(e)) {
      toast.error("Please enter a valid email.");
      return;
    }

    if (saving) return;

    setSaving(true);

    try {
      const s = readSession();

      const occasion =
        String(s?.gift_type || "").trim() ||
        String(s?.occasion || "").trim() ||
        null;

      const style_id = String(s?.style_id || "").trim() || null;

      const funnel_slug =
        String(s?.funnel_slug || "").trim() ||
        String(localStorage.getItem("tdg_funnel_slug") || "").trim() ||
        "newborn";

      const payload: FunnelLeadUpsert = {
        email: e,
        occasion,
        style_id,
        funnel_slug,
      };

      const { data, error } = await supabase
        .from("funnel_leads")
        .upsert(payload, { onConflict: "email" })
        .select("id")
        .single<FunnelLeadRow>();

      if (error) throw error;

      const nextSession: FunnelSession = {
        ...(s || {}),
        email: e,
        lead_id: data?.id ?? null,
        funnel_slug,
      };

      writeSession(nextSession);
      localStorage.setItem("tdg_email", e);
      localStorage.setItem("tdg_funnel_slug", funnel_slug);

      navigate("/funnel/payment");
    } catch (err: unknown) {
      console.error("[FunnelEmailCapture] save error:", err);

      const e = err as SupabaseLikeError | string;

      const msg: string =
        (typeof e === "string" ? e : e?.message) ||
        (typeof e === "string" ? "" : e?.error_description) ||
        (typeof e === "string" ? "" : e?.hint) ||
        "Could not save email. Try again.";

      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#F6F5FF] text-slate-900">
      <div className="relative mx-auto w-full max-w-2xl px-5 py-12 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mx-auto text-center"
        >
          <h1 className="text-3xl font-semibold sm:text-5xl">Where should we send it?</h1>
          <p className="mt-4 text-sm text-slate-600 sm:text-base">Enter your email to continue.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mx-auto mt-10"
        >
          <Card className="overflow-hidden rounded-[28px] border-slate-200 bg-white/80 shadow-[0_12px_40px_-18px_rgba(17,24,39,0.35)] backdrop-blur">
            <CardHeader>
              <div className="text-sm font-semibold">Email</div>
              <div className="text-xs text-slate-500">We’ll never spam you.</div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div
                className={cn(
                  "rounded-2xl border bg-white px-4 py-3",
                  emailError ? "border-red-300" : "border-slate-200"
                )}
              >
                <input
                  value={email}
                  onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setEmail(ev.target.value)}
                  onBlur={(): void => setTouched(true)}
                  onKeyDown={(ev: React.KeyboardEvent<HTMLInputElement>) => {
                    if (ev.key === "Enter") void handleContinue();
                  }}
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  inputMode="email"
                  autoComplete="email"
                  type="email"
                  required
                  pattern="^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
                  aria-invalid={emailError ? true : false}
                />
              </div>

              {emailError ? <div className="text-xs text-red-600">{emailError}</div> : null}

              <button
                type="button"
                onClick={(): void => void handleContinue()}
                disabled={saving || !emailOk}
                className={cn(
                  "w-full rounded-2xl px-6 py-3 font-semibold transition",
                  saving || !emailOk
                    ? "cursor-not-allowed bg-slate-200 text-slate-500"
                    : "bg-[#6D5EF7] text-white shadow-lg shadow-black/10 hover:brightness-105 active:brightness-95"
                )}
              >
                {saving ? "Saving..." : "Continue"}
              </button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}