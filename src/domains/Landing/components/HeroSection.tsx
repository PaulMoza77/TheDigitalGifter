import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { occasionHref, occasions } from "@/constants/occasions";
import {
  landingBodyClass,
  landingEyebrowClass,
  landingDisplayHeadingClass,
  landingPrimaryCtaClass,
  landingSecondaryCtaClass,
  landingTrustChipClass,
} from "@/domains/Landing/landingStyles";

const trustPoints = [
  "No design skills required",
  "Made for sharing",
  "High-resolution results",
  "Create in minutes",
];

export const HeroSection = () => {
  const [currentMockup, setCurrentMockup] = useState(0);
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!occasions.length || reduceMotion) return;

    const interval = window.setInterval(() => {
      setCurrentMockup((prev) => (prev + 1) % occasions.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  const currentOccasion = occasions[currentMockup];

  const handleOccasionClick = useCallback(() => {
    if (!currentOccasion) return;
    void navigate(occasionHref(currentOccasion.id));
  }, [currentOccasion, navigate]);

  if (!currentOccasion) return null;

  return (
    <section className="relative w-full overflow-hidden bg-[var(--tdg-home-bg)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(232,198,117,0.12),transparent_55%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <motion.div
          className="order-2 space-y-5 text-center lg:order-1 lg:text-left"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className={landingEyebrowClass}>The Digital Gifter</p>

          <h1 className={landingDisplayHeadingClass}>
            Make something personal for someone who matters.
          </h1>

          <p className={`mx-auto max-w-xl lg:mx-0 ${landingBodyClass}`}>
            Create personalized gifts, photos, videos and holiday experiences in
            minutes.
          </p>

          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
            <Link to="/generator" className={landingPrimaryCtaClass}>
              Create Something
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link to="/#categories" className={landingSecondaryCtaClass}>
              See What I Can Make
            </Link>
          </div>

          <ul
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1 lg:justify-start"
            aria-label="Product benefits"
          >
            {trustPoints.map((point) => (
              <li key={point} className={landingTrustChipClass}>
                {point}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          className="order-1 lg:order-2"
          initial={reduceMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.55 }}
        >
          <div className="relative mx-auto max-w-md lg:max-w-none">
            <div
              className="absolute -inset-3 rounded-3xl bg-[radial-gradient(circle_at_50%_50%,rgba(232,198,117,0.18),transparent_70%)]"
              aria-hidden="true"
            />

            <div className="relative overflow-hidden rounded-2xl border border-[var(--tdg-home-border)] shadow-2xl shadow-black/50 sm:rounded-3xl">
              <AnimatePresence mode="wait">
                <motion.button
                  type="button"
                  key={currentOccasion.id}
                  className="relative block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
                  onClick={handleOccasionClick}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  aria-label={`View ${currentOccasion.title} templates`}
                >
                  <img
                    src={currentOccasion.image}
                    alt={`Example ${currentOccasion.title} creation`}
                    className="h-[220px] w-full object-cover sm:h-[300px] lg:h-[360px]"
                    width={640}
                    height={360}
                  />

                  <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-xs font-medium text-[var(--tdg-home-text)] backdrop-blur-sm">
                    {currentOccasion.title}
                  </div>

                  <div className="absolute bottom-3 right-3 rounded-xl border border-[var(--tdg-home-border)] bg-[var(--tdg-home-surface)] px-3 py-2 text-xs font-semibold text-[var(--tdg-home-text)] sm:text-sm">
                    Real TDG style
                  </div>
                </motion.button>
              </AnimatePresence>
            </div>

            <p className="mt-3 text-center text-xs text-[var(--tdg-home-text-muted)] lg:text-left">
              Tap to explore this occasion. Examples rotate automatically.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
