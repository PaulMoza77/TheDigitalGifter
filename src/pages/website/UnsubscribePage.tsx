// src/pages/website/UnsubscribePage.tsx
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type Status = "loading" | "success" | "error";

/**
 * Expects:
 *  - query param: ?userId=<uuid>  OR ?email=<email>
 *
 * Recommended DB:
 * 1) public.email_preferences
 *    - user_id uuid (unique) OR email text (unique)
 *    - marketing boolean default true
 *    - updated_at timestamptz
 *
 * This page will try:
 *  - if userId exists: update by user_id
 *  - else if email exists: update by email
 *
 * If table/columns differ, adjust the update() payload + eq() column.
 */
export function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId")?.trim() || "";
  const email = searchParams.get("email")?.trim() || "";

  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setStatus("loading");

      try {
        if (!userId && !email) {
          if (!cancelled) setStatus("error");
          return;
        }

        // ✅ choose match column
        const matchCol = userId ? "user_id" : "email";
        const matchVal = userId ? userId : email;

        // ✅ try update first
        const { data: updated, error: updateErr } = await supabase
          .from("email_preferences")
          .update({
            marketing: false,
            updated_at: new Date().toISOString(),
          })
          .eq(matchCol, matchVal)
          .select("id")
          .maybeSingle();

        if (updateErr) throw updateErr;

        // If no row existed, create it (upsert behavior)
        if (!updated) {
          const insertPayload: Record<string, any> = {
            marketing: false,
            updated_at: new Date().toISOString(),
          };
          if (userId) insertPayload.user_id = userId;
          if (!userId && email) insertPayload.email = email;

          const { error: insertErr } = await supabase
            .from("email_preferences")
            .upsert(insertPayload, { onConflict: userId ? "user_id" : "email" });

          if (insertErr) throw insertErr;
        }

        if (!cancelled) setStatus("success");
      } catch (e) {
        console.error("[UnsubscribePage] error:", e);
        if (!cancelled) setStatus("error");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [userId, email]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="max-w-md w-full bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
        {status === "loading" && (
          <>
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-50 mb-2">
              Unsubscribing...
            </h1>
            <p className="text-sm text-slate-400">
              Please wait while we update your email preferences.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-slate-50 mb-3">
              You&apos;ve been unsubscribed
            </h1>
            <p className="text-slate-400 mb-6">
              You won&apos;t receive any more marketing emails from us.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              You can resubscribe anytime from your account settings.
            </p>
            <a
              href="/"
              className="inline-block bg-indigo-500 text-white px-6 py-2 rounded-full font-medium hover:bg-indigo-400 transition-colors"
            >
              Return to Home
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-slate-50 mb-3">
              Something went wrong
            </h1>
            <p className="text-slate-400 mb-6">
              We couldn&apos;t process your unsubscribe request. Please try again
              or contact support.
            </p>
            <a
              href="/"
              className="inline-block bg-indigo-500 text-white px-6 py-2 rounded-full font-medium hover:bg-indigo-400 transition-colors"
            >
              Return to Home
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default UnsubscribePage;
