import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { HeroSection } from "@/domains/Landing/components/HeroSection";
import OccasionGrid from "@/domains/Landing/components/OccasionGrid";
import { HowItWorks } from "@/domains/Landing/components/HowItWorks";
import { Testimonials } from "@/domains/Landing/components/Testimonials";
import { PricingCTA } from "@/domains/Landing/components/PricingCTA";
import { FAQ } from "@/domains/Landing/components/FAQ";
import {
  landingBodyClass,
  landingPrimaryCtaClass,
  landingSecondaryCtaClass,
  landingSectionClass,
  landingSectionHeadingClass,
  landingEyebrowClass,
} from "@/domains/Landing/landingStyles";

const HomePage: React.FC = () => {
  return (
    <main className="tdg-home-page min-h-screen overflow-x-hidden">
      <HeroSection />

      <OccasionGrid />

      <HowItWorks />

      <Testimonials />

      <section
        className={`${landingSectionClass} relative overflow-hidden`}
        aria-label="Christmas Planner"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(232,198,117,0.1),transparent_45%),radial-gradient(circle_at_85%_100%,rgba(30,77,58,0.35),transparent_50%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className={landingEyebrowClass}>Christmas Planner 2026</p>
            <h2 className={`mt-4 ${landingSectionHeadingClass}`}>
              Plan gifts, budget, and meals in one place.
            </h2>
            <p className={`mt-3 max-w-xl ${landingBodyClass}`}>
              A seasonal companion to your creations — keep wish lists, spending,
              and holiday meals organized without scattered notes.
            </p>
          </div>
          <Link
            to="/christmas/planner"
            className={`${landingPrimaryCtaClass} shrink-0`}
          >
            Open Christmas Planner
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <PricingCTA />

      <section
        className={`${landingSectionClass} border-b-0 pb-16 pt-10 sm:pb-20`}
        aria-label="Get started"
      >
        <div className="mx-auto max-w-3xl rounded-3xl border border-[var(--tdg-home-border)] bg-[var(--tdg-home-surface)] px-6 py-10 text-center sm:px-10">
          <h2 className={landingSectionHeadingClass}>
            Ready when the moment matters.
          </h2>
          <p className={`mt-4 ${landingBodyClass}`}>
            Pick an occasion, add what makes it personal, and share something
            they will remember.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/generator" className={landingPrimaryCtaClass}>
              Create Something
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link to="/templates" className={landingSecondaryCtaClass}>
              Browse Templates
            </Link>
          </div>
        </div>
      </section>

      <FAQ />
    </main>
  );
};

export default HomePage;
