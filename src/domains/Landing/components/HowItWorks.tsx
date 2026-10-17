import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  landingTertiaryLinkClass,
} from "@/domains/Landing/landingStyles";

const steps = [
  {
    title: "Choose the moment",
    description: "Birthdays, love, apologies, pets, faith, family.",
  },
  {
    title: "Make it personal",
    description: "A photo, a name, or a short message.",
  },
  {
    title: "Share the gift",
    description: "A card, a video, or a file they can keep.",
  },
];

export const HowItWorks = () => {
  return (
    <section
      className="w-full border-t border-[var(--tdg-home-border)] bg-[var(--tdg-home-bg)] px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
      aria-labelledby="how-it-works-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h2
            id="how-it-works-heading"
            className="text-2xl font-semibold tracking-tight text-[var(--tdg-home-text)]"
          >
            How it works
          </h2>
          <Link
            to="/generator"
            className={`${landingTertiaryLinkClass} inline-flex items-center gap-1.5`}
          >
            Create something
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <ol className="mt-6 grid grid-cols-1 gap-6 border-t border-[var(--tdg-home-border)] pt-6 sm:grid-cols-3 sm:gap-10">
          {steps.map((step, index) => (
            <li key={step.title}>
              <h3 className="text-[15px] font-medium tracking-tight text-[var(--tdg-home-text)] sm:text-base">
                <span className="mr-3 tabular-nums text-[var(--tdg-home-accent)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step.title}
              </h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--tdg-home-text-muted)]">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
