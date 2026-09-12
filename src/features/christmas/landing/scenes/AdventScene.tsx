import { useEffect, useRef, useState } from "react";
import { adventDayParts } from "../../tree/treeLogic";
import { LANDING_ASSETS } from "../assets";
import { landingT, type ChristmasLandingLocale } from "../copy";
import { useInViewOnce } from "../useInViewOnce";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";

function pickAdventLoop(): string {
  if (typeof window === "undefined") return LANDING_ASSETS.adventLoop540;
  return window.matchMedia("(min-width: 901px)").matches
    ? LANDING_ASSETS.adventLoop
    : LANDING_ASSETS.adventLoop540;
}

/**
 * Landing Advent: framed photoreal loop (door opens, light spills) —
 * sized like the gift-tree frame. Product flow stays on /christmas/advent.
 */
export function AdventScene({
  locale,
  onInteract,
  onCta,
}: {
  locale: ChristmasLandingLocale;
  onInteract: (day: number) => void;
  onCta: () => void;
}) {
  const t = (key: string) => landingT(key, locale);
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInViewOnce<HTMLElement>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewedRef = useRef(false);
  const [videoReady, setVideoReady] = useState(false);
  const [loopSrc] = useState(pickAdventLoop);
  const today = adventDayParts(new Date(), 2026).eligibleDay ?? 1;

  useEffect(() => {
    if (!inView || viewedRef.current) return;
    viewedRef.current = true;
    onInteract(today);
  }, [inView, onInteract, today]);

  useEffect(() => {
    if (reduced || !inView) return;
    const video = videoRef.current;
    if (!video) return;
    setVideoReady(false);
    const markReady = () => setVideoReady(true);
    if (video.readyState >= 2) markReady();
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("canplay", markReady);
    void video.play().catch(() => {
      /* autoplay blocked — poster remains */
    });
    return () => {
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
    };
  }, [inView, loopSrc, reduced]);

  return (
    <section
      id="advent"
      ref={ref}
      className="xmas-scene xmas-advent-landing"
      aria-labelledby="advent-title"
    >
      <div className={`xmas-advent-landing__intro xmas-reveal ${inView ? "is-in" : ""}`}>
        <p className="xmas-kicker">{t("advent.kicker")}</p>
        <h2 id="advent-title">{t("advent.h2")}</h2>
        <p className="xmas-lede">{t("advent.lede")}</p>
        <div className="xmas-actions" style={{ justifyContent: "center" }}>
          <button type="button" className="xmas-btn xmas-btn--gold" onClick={onCta}>
            {t("advent.cta")}
          </button>
        </div>
      </div>

      <div className={`xmas-advent-landing__frame xmas-reveal ${inView ? "is-in" : ""}`}>
        <button
          type="button"
          className="xmas-advent-stage"
          onClick={onCta}
          aria-label={t("advent.cta")}
        >
          <picture className="xmas-advent-stage__poster">
            <source type="image/webp" srcSet={LANDING_ASSETS.adventLoopPoster} />
            <img
              src={LANDING_ASSETS.adventLoopPosterJpg}
              alt={t("advent.alt")}
              width={1280}
              height={720}
            />
          </picture>
          {!reduced ? (
            <video
              ref={videoRef}
              className={`xmas-advent-stage__video${videoReady ? " is-ready" : ""}`}
              muted
              playsInline
              loop
              autoPlay
              preload="metadata"
              src={loopSrc}
            />
          ) : null}
        </button>
      </div>
    </section>
  );
}
