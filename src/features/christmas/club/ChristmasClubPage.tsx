import { useEffect, useMemo, useRef, useState } from "react";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { rememberAuthReturnTo } from "@/lib/auth/returnTo";
import {
  attributionParamsForInternal,
} from "@/features/pet/funnelAttribution";
import { trackChristmasEvent, getChristmasFunnelSessionId } from "../analytics";
import {
  CHRISTMAS_CLUB_ASSETS,
  CHRISTMAS_CLUB_AUTH_RETURN_PATH,
  CHRISTMAS_CLUB_CONFIG,
  CHRISTMAS_CLUB_DESKTOP_MEDIA,
  CHRISTMAS_CLUB_GOOGLE_PENDING_KEY,
  CHRISTMAS_CLUB_SEO,
} from "./config";
import { ChristmasLandingExperience } from "@/features/christmas/landing/ChristmasLandingExperience";
import { ChristmasClubScene } from "./ChristmasClubScene";
import { ChristmasCountdown } from "./ChristmasCountdown";
import { ChristmasClubSuccess, ChristmasJoinForm } from "./ChristmasJoinForm";
import { joinChristmasClub } from "./signupClient";
import { markClubJoined, readClubJoinedState } from "./signupState";
import "./christmasClub.css";

function loadClubFonts() {
  const id = "christmas-club-fonts";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

function preloadHeroAssets() {
  if (document.querySelector('link[data-cc-preload="hero"]')) return;
  const preload = document.createElement("link");
  preload.rel = "preload";
  preload.as = "image";
  preload.type = "image/webp";
  preload.href = CHRISTMAS_CLUB_ASSETS.hero1920;
  preload.setAttribute(
    "imagesrcset",
    `${CHRISTMAS_CLUB_ASSETS.hero1280} 1280w, ${CHRISTMAS_CLUB_ASSETS.hero1920} 1920w, ${CHRISTMAS_CLUB_ASSETS.hero2560} 2560w`,
  );
  preload.setAttribute("imagesizes", "100vw");
  preload.setAttribute("fetchpriority", "high");
  preload.setAttribute("data-cc-preload", "hero");
  document.head.appendChild(preload);

  if (!document.querySelector('link[data-cc-preload="loop"]')) {
    const wide = window.matchMedia(CHRISTMAS_CLUB_DESKTOP_MEDIA).matches;
    const loop = document.createElement("link");
    loop.rel = "preload";
    loop.as = "video";
    loop.href = wide ? CHRISTMAS_CLUB_ASSETS.heroLoop : CHRISTMAS_CLUB_ASSETS.heroLoop720;
    loop.setAttribute("data-cc-preload", "loop");
    document.head.appendChild(loop);
  }
}

function setThemeColor(color: string) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
}

function googleRedirectBase() {
  if (typeof window === "undefined") return "";
  if (window.location.hostname === "thedigitalgifter.com") {
    return "https://www.thedigitalgifter.com";
  }
  return window.location.origin;
}

export function ChristmasClubPage() {
  const { user, loading: authLoading } = useAuth();
  const [joined, setJoined] = useState(() => Boolean(readClubJoinedState()));
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const joinStarted = useRef(false);
  const googleCompletion = useRef(false);

  const utm = useMemo(() => attributionParamsForInternal(), []);

  useEffect(() => {
    loadClubFonts();
    preloadHeroAssets();
    setThemeColor("#140409");
    void trackChristmasEvent("christmas_page_view", {
      productKey: CHRISTMAS_CLUB_CONFIG.productKey,
      pathname: "/christmas",
      metadata: { surface: "christmas_club" },
    });
  }, []);

  useEffect(() => {
    if (authLoading || joined || googleCompletion.current) return;
    const pending =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(CHRISTMAS_CLUB_GOOGLE_PENDING_KEY) === "1";
    if (!pending || !user) return;
    googleCompletion.current = true;
    void completeGoogleJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, joined]);

  async function persistJoin(signupMethod: "email" | "google", email?: string) {
    const { data } = await supabase.auth.getSession();
    const result = await joinChristmasClub({
      email,
      signupMethod,
      source: CHRISTMAS_CLUB_CONFIG.source,
      campaignKey: CHRISTMAS_CLUB_CONFIG.campaignKey,
      campaignYear: CHRISTMAS_CLUB_CONFIG.campaignYear,
      landingPath: `${window.location.pathname}${window.location.search}`.slice(0, 160),
      funnelSessionId: getChristmasFunnelSessionId(),
      accessToken: data.session?.access_token ?? null,
      utm: {
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        utm_content: utm.utm_content,
        utm_term: utm.utm_term,
      },
    });
    if (!result.ok) {
      throw new Error(result.error || "Could not join just now.");
    }
    markClubJoined(signupMethod);
    setJoined(true);
    void trackChristmasEvent("christmas_join_completed", {
      productKey: CHRISTMAS_CLUB_CONFIG.productKey,
      pathname: "/christmas",
      metadata: { method: signupMethod, already_joined: result.alreadyJoined },
    });
    if (signupMethod === "google") {
      void trackChristmasEvent("christmas_google_auth_completed", {
        productKey: CHRISTMAS_CLUB_CONFIG.productKey,
        pathname: "/christmas",
        metadata: { method: "google" },
      });
    }
  }

  async function completeGoogleJoin() {
    try {
      window.sessionStorage.removeItem(CHRISTMAS_CLUB_GOOGLE_PENDING_KEY);
      setGoogleBusy(true);
      await persistJoin("google", user?.email ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in finished, but we couldn’t save your place.");
    } finally {
      setGoogleBusy(false);
    }
  }

  function markJoinStarted() {
    if (joinStarted.current) return;
    joinStarted.current = true;
    void trackChristmasEvent("christmas_join_started", {
      productKey: CHRISTMAS_CLUB_CONFIG.productKey,
      pathname: "/christmas",
      metadata: { surface: "christmas_club" },
    });
  }

  async function handleEmailJoin(email: string) {
    markJoinStarted();
    setError(null);
    setSubmitting(true);
    try {
      await persistJoin("email", email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t save your place just now.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleJoin() {
    markJoinStarted();
    setError(null);
    setGoogleBusy(true);
    void trackChristmasEvent("christmas_google_auth_started", {
      productKey: CHRISTMAS_CLUB_CONFIG.productKey,
      pathname: "/christmas",
      metadata: { method: "google" },
    });
    try {
      window.sessionStorage.setItem(CHRISTMAS_CLUB_GOOGLE_PENDING_KEY, "1");
      rememberAuthReturnTo(CHRISTMAS_CLUB_AUTH_RETURN_PATH);
      const base = googleRedirectBase();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: base ? `${base}/auth/callback` : undefined,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      window.sessionStorage.removeItem(CHRISTMAS_CLUB_GOOGLE_PENDING_KEY);
      setGoogleBusy(false);
      setError(
        err instanceof Error
          ? err.message
          : "Google sign-in isn’t available right now. You can still join with email.",
      );
    }
  }

  const showForm = !joined;

  return (
    <div className="christmas-club">
      <ChristmasPageHead path="/christmas" image={CHRISTMAS_CLUB_SEO.ogImage} />
      <div className="cc-stage">
        <ChristmasClubScene />

        <a className="cc-brand" href="/">
          <img src="/TheDigitalGifter.png" alt="" width={36} height={36} />
          <span>The Digital Gifter</span>
        </a>

        <section className="cc-hero">
          <div className="cc-hero__copy">
            <p className="cc-eyebrow">The Digital Gifter presents</p>
            <h1>Something magical is coming this Christmas.</h1>
            <p className="cc-lede">
              Join our Christmas countdown and discover little surprises along the way.
            </p>
          </div>

          <div className="cc-dock">
            <div className="cc-dock__countdown">
              <p className="cc-countdown-note">A few gifts already waiting inside the countdown.</p>
              <ChristmasCountdown config={CHRISTMAS_CLUB_CONFIG} />
            </div>

            <div className="cc-dock__join" id="join">
              {showForm ? (
                <>
                  <h2 className="sr-only">Join the Christmas Countdown</h2>
                  <ChristmasJoinForm
                    submitting={submitting}
                    googleBusy={googleBusy || authLoading}
                    googleAvailable
                    error={error}
                    onEmailJoin={(email) => void handleEmailJoin(email)}
                    onGoogleJoin={() => void handleGoogleJoin()}
                    onStarted={markJoinStarted}
                  />
                </>
              ) : (
                <ChristmasClubSuccess />
              )}
            </div>
          </div>
        </section>
      </div>

      <ChristmasLandingExperience includeHero={false} />
    </div>
  );
}

export default ChristmasClubPage;
