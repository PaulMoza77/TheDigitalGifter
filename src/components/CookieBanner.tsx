import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  hasAnalyticsConsent,
  readCookieConsent,
  writeCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookieConsent";
import { loadMarketingScripts, revokeMarketingConsent } from "@/lib/analytics";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = readCookieConsent();
    if (!existing) {
      setVisible(true);
      return;
    }
    if (hasAnalyticsConsent(existing)) {
      loadMarketingScripts();
    } else {
      revokeMarketingConsent();
    }
  }, []);

  function choose(value: CookieConsentValue) {
    writeCookieConsent(value);
    if (value === "accepted") loadMarketingScripts();
    else revokeMarketingConsent();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] p-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-[#0b1220] p-4 text-sm text-white shadow-2xl">
        <p className="leading-6 text-white/85">
          We use essential cookies to run checkout and deliver your image.
          Analytics and advertising cookies (Google Analytics and Meta Pixel)
          stay off until you accept. Read the{" "}
          <Link to="/cookies" className="underline">
            Cookie Policy
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-full border border-white/20 px-4 py-2 text-white/80"
            onClick={() => choose("rejected")}
          >
            Reject non-essential
          </button>
          <button
            type="button"
            className="rounded-full bg-[#ffd976] px-4 py-2 font-semibold text-[#0b1220]"
            onClick={() => choose("accepted")}
          >
            Accept analytics cookies
          </button>
        </div>
      </div>
    </div>
  );
}
