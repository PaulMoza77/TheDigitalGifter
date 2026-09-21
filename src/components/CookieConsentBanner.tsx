import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  COOKIE_SETTINGS_EVENT,
  applyCookieConsent,
  readCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookieConsent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readCookieConsent() == null);

    function reopen() {
      setVisible(true);
    }
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  function choose(value: CookieConsentValue) {
    applyCookieConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-white/10 bg-[#0b1220]/95 p-4 text-white shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
      role="dialog"
      aria-labelledby="tdg-cookie-title"
      aria-describedby="tdg-cookie-copy"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p id="tdg-cookie-title" className="text-sm font-semibold">
            Cookies and analytics
          </p>
          <p id="tdg-cookie-copy" className="mt-1 text-sm leading-6 text-white/75">
            We use essential cookies to keep you signed in. Analytics and ads stay off until you
            accept. Read the{" "}
            <Link className="underline decoration-white/40 underline-offset-2 hover:text-white" to="/privacy">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            onClick={() => choose("denied")}
          >
            Reject
          </button>
          <button
            type="button"
            className="rounded-full bg-[#ffd976] px-4 py-2 text-sm font-semibold text-[#1a1a1a] hover:brightness-110"
            onClick={() => choose("granted")}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
