import { Download, Gift, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  landingBodyClass,
  landingPrimaryCtaClass,
  landingSectionClass,
  landingSectionHeadingClass,
  landingEyebrowClass,
} from "@/domains/Landing/landingStyles";

const steps = [
  {
    icon: Gift,
    title: "Choose the moment",
    description:
      "Birthdays, love, apologies, pets, faith, family. Start with the occasion that fits them.",
  },
  {
    icon: Sparkles,
    title: "Make it personal",
    description:
      "Add a photo, name, or message. We handle layout and polish so it feels made only for them.",
  },
  {
    icon: Download,
    title: "Share the gift",
    description:
      "Download in high resolution and send it as a card, video, keepsake, or surprise.",
  },
];

export const HowItWorks = () => {
  const reduceMotion = useReducedMotion();

  return (
    <section className={landingSectionClass} aria-labelledby="how-it-works-heading">
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="mx-auto mb-12 max-w-3xl text-center sm:mb-16"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <p className={landingEyebrowClass}>How it works</p>

          <h2
            id="how-it-works-heading"
            className={`mt-4 ${landingSectionHeadingClass}`}
          >
            Three simple steps to something meaningful.
          </h2>

          <p className={`mt-4 ${landingBodyClass}`}>
            No design apps or blank canvases. Just a clear path from idea to
            finished gift.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              className="relative rounded-2xl border border-[var(--tdg-home-border)] bg-[var(--tdg-home-surface)] p-6 sm:p-8"
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.4 }}
            >
              <div
                className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--tdg-home-bg)] text-sm font-bold text-[var(--tdg-home-accent)] ring-1 ring-[var(--tdg-home-border)]"
                aria-hidden="true"
              >
                {index + 1}
              </div>

              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--tdg-home-bg)] ring-1 ring-[var(--tdg-home-border)]">
                <step.icon
                  className="h-6 w-6 text-[var(--tdg-home-accent)]"
                  aria-hidden="true"
                />
              </div>

              <h3 className="mb-2 text-lg font-semibold text-[var(--tdg-home-text)]">
                {step.title}
              </h3>

              <p className="text-sm leading-7 text-[var(--tdg-home-text-muted)]">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link to="/generator" className={landingPrimaryCtaClass}>
            Create Something
          </Link>
        </div>
      </div>
    </section>
  );
};
