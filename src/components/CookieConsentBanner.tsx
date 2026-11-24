import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  COOKIE_SETTINGS_EVENT,
  applyCookieConsent,
  readCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookieConsent";

const COOKIE_OFFSET_VAR = "--tdg-cookie-offset";

function setCookieOffset(px: number) {
  try {
    document.documentElement.style.setProperty(COOKIE_OFFSET_VAR, `${Math.max(0, Math.round(px))}px`);
  } catch {
    /* ignore */
  }
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisible(readCookieConsent() == null);

    function reopen() {
      setVisible(true);
    }
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  useLayoutEffect(() => {
    if (!visible) {
      setCookieOffset(0);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const sync = () => setCookieOffset(el.getBoundingClientRect().height);
    sync();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", sync);
      setCookieOffset(0);
    };
  }, [visible]);

  function choose(value: CookieConsentValue) {
    applyCookieConsent(value);
    setVisible(false);
    setCookieOffset(0);
  }

  if (!visible) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-[#0b1220]/96 px-3 py-2.5 text-white shadow-[0_-8px_28px_rgba(0,0,0,0.4)] backdrop-blur-md pb-[max(0.65rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-labelledby="tdg-cookie-title"
      aria-describedby="tdg-cookie-copy"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 max-w-2xl">
          <p id="tdg-cookie-title" className="text-xs font-semibold sm:text-sm">
            Cookies and analytics
          </p>
          <p id="tdg-cookie-copy" className="mt-0.5 text-[0.75rem] leading-5 text-white/75 sm:text-sm sm:leading-6">
            Essential cookies keep you signed in. Analytics/ads stay off until you accept.{" "}
            <Link className="underline decoration-white/40 underline-offset-2 hover:text-white" to="/privacy">
              Privacy
            </Link>
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0">
          <button
            type="button"
            className="min-h-10 rounded-full border border-white/20 px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 sm:px-4"
            onClick={() => choose("denied")}
          >
            Reject
          </button>
          <button
            type="button"
            className="min-h-10 rounded-full bg-[#ffd976] px-3 py-2 text-sm font-semibold text-[#1a1a1a] hover:brightness-110 sm:px-4"
            onClick={() => choose("granted")}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
