import React, { JSX, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

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
    void import("@/components/funnelVersion/FunnelPayment");
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

      const { data, error } = await supabase.rpc("upsert_funnel_lead", {
        p_email: e,
        p_occasion: occasion,
        p_style_id: style_id,
        p_funnel_slug: funnel_slug,
      });

      if (error) throw error;

      const nextSession: FunnelSession = {
        ...(s || {}),
        email: e,
        lead_id: (data as string | null) ?? null,
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
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F6F0E6] text-[#10221B]">
      <header className="px-4 pb-7 pt-8 text-center sm:px-5 sm:pt-12">
        <div className="font-serif text-[2rem] font-semibold leading-none tracking-tight text-[#10221B]">
          thedigitalgifter
        </div>
      </header>

      <div className="bg-[#F3D35B] px-4 py-3.5 text-center sm:py-4">
        <p className="mx-auto flex max-w-3xl items-start justify-center gap-2 text-sm font-medium leading-snug text-[#10221B] sm:text-[15px]">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1B3A30]" strokeWidth={3} aria-hidden />
          <span>
            You&apos;re eligible to redeem a <span className="font-bold">special offer</span> in the next
            step and save up to <span className="font-bold">65%</span> on your order.
          </span>
        </p>
      </div>

      <main className="mx-auto w-full max-w-xl px-4 pb-[max(4rem,env(safe-area-inset-bottom))] pt-10 sm:px-5 sm:pt-16">
        <h1 className="mx-auto max-w-md text-balance break-words text-center text-[1.35rem] font-semibold leading-snug text-[#1B3A30] sm:text-[1.65rem]">
          Enter your email to start creating and viewing your animated memories
        </h1>

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-sm font-medium text-[#1B3A30]">
          <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] bg-[#1B3A30] text-white">
            <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />
          </span>
          Make sure it&apos;s correct, so your moments reach you safely!
        </p>

        <form
          className="mx-auto mt-5 w-full max-w-md"
          onSubmit={(ev: React.FormEvent<HTMLFormElement>) => {
            ev.preventDefault();
            void handleContinue();
          }}
        >
          <input
            value={email}
            onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setEmail(ev.target.value)}
            onBlur={(): void => setTouched(true)}
            placeholder="Email"
            className={cn(
              "h-12 w-full rounded-lg border bg-white px-4 text-base text-[#10221B] outline-none placeholder:text-[#10221B]/40",
              emailError ? "border-red-400" : "border-[#1B3A30]/70"
            )}
            inputMode="email"
            autoComplete="email"
            type="email"
            required
            pattern="^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
            aria-invalid={emailError ? true : false}
            aria-describedby={emailError ? "funnel-email-error" : undefined}
          />

          {emailError ? (
            <div id="funnel-email-error" className="mt-2 text-center text-xs text-red-600">
              {emailError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className={cn(
              "mt-4 h-12 w-full rounded-full bg-[#1B3A30] text-base font-semibold text-white transition hover:brightness-110 active:brightness-95",
              saving && "cursor-wait opacity-80"
            )}
          >
            {saving ? "Saving..." : "Continue"}
          </button>
        </form>

        <p className="mx-auto mt-5 max-w-md text-center text-[11px] leading-relaxed text-[#10221B]/55 sm:text-xs">
          We respect your privacy. We will never sell, rent or share your email address. That&apos;s
          more than a{" "}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-[#10221B]">
            policy
          </Link>
          , it&apos;s our personal guarantee.
        </p>
      </main>
    </div>
  );
}