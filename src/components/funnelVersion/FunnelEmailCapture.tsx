import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

export default function FunnelEmailCapture() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("tdg_funnel_session") || "null") as
        | { gift_type?: string; style_id?: string; script?: string }
        | null;
    } catch {
      return null;
    }
  }, []);

  const handleContinue = async () => {
    const e = email.trim().toLowerCase();
    if (!isValidEmail(e)) {
      toast.error("Please enter a valid email.");
      return;
    }

    setSaving(true);
    try {
      const occasion = String(session?.gift_type || "").trim() || null;
      const style_id = String(session?.style_id || "").trim() || null;

      // upsert (nu dubla același email)
      const { data, error } = await supabase
        .from("funnel_leads")
        .upsert(
          { email: e, occasion, style_id },
          { onConflict: "email" }
        )
        .select("id")
        .single();

      if (error) throw error;

      // salvează lead_id în session (util la payment)
      const nextSession = {
        ...(session || {}),
        email: e,
        lead_id: data?.id || null,
      };
      localStorage.setItem("tdg_funnel_session", JSON.stringify(nextSession));

      navigate("/funnel/payment");
    } catch (err) {
      console.error("[FunnelEmailCapture] save error:", err);
      toast.error("Could not save email. Try again.");
    } finally {
      setSaving(false);
    }
  };

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
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <input
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                  inputMode="email"
                  autoComplete="email"
                />
              </div>

              <button
                type="button"
                onClick={handleContinue}
                disabled={saving}
                className={cn(
                  "w-full rounded-2xl px-6 py-3 font-semibold transition",
                  saving
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-[#6D5EF7] text-white hover:brightness-105 active:brightness-95 shadow-lg shadow-black/10"
                )}
              >
                {saving ? "Saving..." : "Continue"}
              </button>

              <div className="text-center text-xs text-slate-500">
                Tip: you can show this lead in Admin → Customers via <b>customers_unified</b>.
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}