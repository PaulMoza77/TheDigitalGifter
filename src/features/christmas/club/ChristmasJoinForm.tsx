import { useState, type FormEvent } from "react";
import { clubT, type ClubLocale } from "./copy";
import { clubEmailValidationMessage, isValidClubEmail, normalizeClubEmail } from "./email";

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function ChristmasJoinForm({
  locale = "en",
  submitting,
  googleBusy,
  googleAvailable,
  error,
  onEmailJoin,
  onGoogleJoin,
  onStarted,
}: {
  locale?: ClubLocale;
  submitting: boolean;
  googleBusy: boolean;
  googleAvailable: boolean;
  error: string | null;
  onEmailJoin: (email: string) => void;
  onGoogleJoin: () => void;
  onStarted: () => void;
}) {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const t = (key: string) => clubT(key, locale);
  const validation = touched ? clubEmailValidationMessage(email, locale) : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    const next = normalizeClubEmail(email);
    if (!isValidClubEmail(next)) return;
    onEmailJoin(next);
  }

  return (
    <div className="cc-join">
      <p>{t("join.lede")}</p>
      <form className="cc-form" onSubmit={handleSubmit} noValidate>
        <label className="sr-only" htmlFor="christmas-club-email">
          {t("join.emailLabel")}
        </label>
        <input
          id="christmas-club-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t("join.emailPlaceholder")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onFocus={onStarted}
          onBlur={() => setTouched(true)}
          aria-invalid={Boolean(validation)}
        />
        <button className="cc-cta" type="submit" disabled={submitting}>
          {submitting ? t("join.ctaBusy") : t("join.cta")}
        </button>
      </form>
      {validation ? <p className="cc-error">{validation}</p> : null}
      {error ? <p className="cc-error">{error}</p> : null}

      {googleAvailable ? (
        <>
          <div className="cc-divider">{t("join.or")}</div>
          <button
            type="button"
            className="cc-google"
            onClick={onGoogleJoin}
            disabled={googleBusy || submitting}
          >
            <GoogleMark />
            {t("join.google")}
          </button>
        </>
      ) : null}
    </div>
  );
}

export function ChristmasClubSuccess({ locale = "en" }: { locale?: ClubLocale }) {
  const t = (key: string) => clubT(key, locale);
  return (
    <div className="cc-success" role="status">
      <p className="cc-eyebrow">{t("success.eyebrow")}</p>
      <h2>{t("success.h2")}</h2>
      <p>{t("success.lede")}</p>
      <p>{t("success.body")}</p>
      <p className="cc-whisper">{t("success.whisper")}</p>
    </div>
  );
}
