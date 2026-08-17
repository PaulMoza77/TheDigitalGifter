import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createPublicSupportTicket } from "./api";
import {
  isHoneypotFilled,
  parseSupportCategory,
  publicSupportErrorMessage,
  validateSupportForm,
} from "./guards";
import { peekPetPublicToken, readPetSupportContext, storeGuestSupportToken, takePetPublicToken } from "./storage";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_EXPECTED_RESPONSE,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_SUBJECT_MAX,
  type SupportFormErrors,
  type SupportFormValues,
} from "./types";

const emptyValues: SupportFormValues = {
  email: "",
  category: "",
  subject: "",
  message: "",
  website: "",
  attachPetOrder: false,
};

export function SupportTicketForm() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const petContext = useMemo(() => readPetSupportContext(), []);
  const [values, setValues] = useState<SupportFormValues>(() => ({
    ...emptyValues,
    email: user?.email ?? "",
    category: parseSupportCategory(searchParams.get("category")),
    attachPetOrder: petContext.hasPetOrder,
  }));
  const [errors, setErrors] = useState<SupportFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reference: string; expectedResponse: string } | null>(
    null,
  );

  useEffect(() => {
    if (!user?.email) return;
    setValues((current) => (current.email ? current : { ...current, email: user.email ?? "" }));
  }, [user?.email]);

  function update<K extends keyof SupportFormValues>(key: K, value: SupportFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFormError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateSupportForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!values.category) return;

    if (isHoneypotFilled(values.website)) {
      setResult({
        reference: "TDG-000000",
        expectedResponse: SUPPORT_EXPECTED_RESPONSE,
      });
      return;
    }

    try {
      setSubmitting(true);
      const petPublicToken = values.attachPetOrder ? peekPetPublicToken() : null;
      const created = await createPublicSupportTicket({
        email: values.email,
        category: values.category,
        subject: values.subject,
        message: values.message,
        petPublicToken,
        pagePath: window.location.pathname,
        honeypot: values.website,
      });
      if (values.attachPetOrder) takePetPublicToken();
      if (created.guestToken) storeGuestSupportToken(created.reference, created.guestToken);
      setResult({
        reference: created.reference,
        expectedResponse: created.expectedResponse,
      });
    } catch (error) {
      setFormError(publicSupportErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <section className="rounded-lg border border-[#ffd976]/20 bg-gradient-to-r from-[#ffd976]/10 to-[#ffd976]/5 p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg border border-[#ffd976]/20 bg-white/5 p-2">
            <CheckCircle2 size={20} className="text-[#ffd976]" />
          </div>
          <h2 className="text-xl font-bold text-white">Ticket received</h2>
        </div>
        <p className="text-sm leading-relaxed text-white/75">
          Thanks — we have your request. Keep this reference if you need to follow up.
        </p>
        <p className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-lg tracking-[0.18em] text-[#ffd976]">
          {result.reference}
        </p>
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-white/70">
          <Clock size={16} className="text-[#ffd976]" />
          {result.expectedResponse}
        </p>
      </section>
    );
  }

  const fieldClass =
    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-[#ffd976]/40";

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-5" noValidate>
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="support-website">Company website</label>
        <input
          id="support-website"
          name="website"
          autoComplete="off"
          tabIndex={-1}
          value={values.website}
          onChange={(event) => update("website", event.target.value)}
        />
      </div>

      <Field label="Email" error={errors.email} htmlFor="support-email">
        <input
          id="support-email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => update("email", event.target.value)}
          className={fieldClass}
          maxLength={254}
        />
      </Field>

      <Field label="Category" error={errors.category} htmlFor="support-category">
        <select
          id="support-category"
          value={values.category}
          onChange={(event) => update("category", parseSupportCategory(event.target.value))}
          className={fieldClass}
        >
          <option value="">Select a category</option>
          {SUPPORT_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Subject" error={errors.subject} htmlFor="support-subject">
        <input
          id="support-subject"
          value={values.subject}
          onChange={(event) => update("subject", event.target.value)}
          className={fieldClass}
          maxLength={SUPPORT_SUBJECT_MAX}
        />
      </Field>

      <Field label="Message" error={errors.message} htmlFor="support-message">
        <textarea
          id="support-message"
          value={values.message}
          onChange={(event) => update("message", event.target.value)}
          rows={7}
          className={`${fieldClass} min-h-[160px] resize-y`}
          maxLength={SUPPORT_MESSAGE_MAX}
        />
      </Field>

      {petContext.hasPetOrder ? (
        <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
          <input
            type="checkbox"
            checked={values.attachPetOrder}
            onChange={(event) => update("attachPetOrder", event.target.checked)}
            className="mt-1"
          />
          <span>Attach my current pet order so support can look it up. We will not put the order link in this page URL.</span>
        </label>
      ) : null}

      {formError ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[#ffd976]/30 bg-[#ffd976]/20 px-6 py-3 font-medium text-[#ffd976] transition hover:bg-[#ffd976]/30 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? "Sending…" : "Submit ticket"}
      </button>

      <p className="text-xs text-white/45">
        Need a policy instead?{" "}
        <Link to="/refunds" className="text-[#ffd976] hover:underline">
          Refunds
        </Link>
        ,{" "}
        <Link to="/privacy" className="text-[#ffd976] hover:underline">
          Privacy
        </Link>
        , or{" "}
        <Link to="/terms" className="text-[#ffd976] hover:underline">
          Terms
        </Link>
        .
      </p>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-white/80">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
