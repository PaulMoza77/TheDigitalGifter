// src/components/funnelVersion/FunnelEmailCapture.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Strict-ish email check:
 * - must contain "@"
 * - must contain a dot after "@"
 * - no spaces
 */
function isValidEmail(email: string) {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

type FunnelSession = {
  gift_type?: string;
  style_id?: string;
  script?: string;
  email?: string;
  lead_id?: string | number | null;
};

function readSession(): FunnelSession | null {
  try {
    return JSON.parse(localStorage.getItem("tdg_funnel_session") || "null") as FunnelSession | null;
  } catch {
    return null;
  }
}

export default function FunnelEmailCapture() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const session = useMemo(() => readSession(), []);

  const trimmedEmail = email.trim().toLowerCase();
  const emailOk = isValidEmail(trimmedEmail);

  const emailError =
    !touched
      ? ""
      : !trimmedEmail
        ? "Email is required."
        : !emailOk
          ? "Please enter a valid email (must include @ and a domain)."
          : "";

  // ✅ Guards:
  // - if no photo => back to upload
  // - if already have a valid email in session => jump to payment
  useEffect(() => {
    const photo = (localStorage.getItem("tdg_funnel_photo") || "").trim();
    if (!photo) {
      navigate("/funnel/uploadPhoto", { replace: true });
      return;
    }

    const s = readSession();
    const existingEmail = String(s?.email || "").trim().toLowerCase();
    if (existingEmail && isValidEmail(existingEmail)) {
      navigate("/funnel/payment", { replace: true });
      return;
    }

    if (existingEmail) setEmail(existingEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleContinue() {
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

      const occasion = String(s?.gift_type || "").trim() || null;
      const style_id = String(s?.style_id || "").trim() || null;

      const { data, error } = await supabase
        .from("funnel_leads")
        .upsert({ email: e, occasion, style_id }, { onConflict: "email" })
        .select("id")
        .single();

      if (error) throw error;

      const nextSession: FunnelSession = {
        ...(s || {}),
        email: e,
        lead_id: data?.id ?? null,
      };

      localStorage.setItem("tdg_funnel_session", JSON.stringify(nextSession));

      navigate("/funnel/payment");
    } catch (err: any) {
      // Show the real Supabase message (helps you debug RLS / missing table / permissions)
      console.error("[FunnelEmailCapture] save error:", err);
      const msg =
        err?.message ||
        err?.error_description ||
        err?.hint ||
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
          <h1 className="text-3xl font-semibold sm:text-5xl">
            Where should we send it?
          </h1>
          <p className="mt-4 text-sm text-slate-600 sm:text-base">
            Enter your email to save your design and continue to payment.
          </p>
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
                  onChange={(ev) => setEmail(ev.target.value)}
                  onBlur={() => setTouched(true)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") void handleContinue();
                  }}
                  placeholder="you@example.com"
                  className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                  inputMode="email"
                  autoComplete="email"
                  type="email"
                  required
                  // browser-level enforcement (still we validate in JS)
                  pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                  aria-invalid={!!emailError}
                />
              </div>

              {emailError ? (
                <div className="text-xs text-red-600">{emailError}</div>
              ) : (
                <div className="text-xs text-slate-500">
                  Must include <b>@</b> and a valid domain (example: gmail.com).
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleContinue()}
                disabled={saving || !emailOk}
                className={cn(
                  "w-full rounded-2xl px-6 py-3 font-semibold transition",
                  saving || !emailOk
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-[#6D5EF7] text-white hover:brightness-105 active:brightness-95 shadow-lg shadow-black/10"
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