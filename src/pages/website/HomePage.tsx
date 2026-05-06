import React from "react";
import { Link } from "react-router-dom";

import { HeroSection } from "@/domains/Landing/components/HeroSection";
import { TrendingNowRow } from "@/components/website/TrendingNowRow";
import { HowItWorks } from "@/domains/Landing/components/HowItWorks";
import { FeaturesHighlight } from "@/domains/Landing/components/FeaturesHighlight";
import { Testimonials } from "@/domains/Landing/components/Testimonials";
import { PricingCTA } from "@/domains/Landing/components/PricingCTA";
import { FAQ } from "@/domains/Landing/components/FAQ";

const HomePage: React.FC = () => {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <HeroSection />
      <TrendingNowRow />
      <HowItWorks />
      <FeaturesHighlight />
      <Testimonials />
      <PricingCTA />
      <FAQ />

      <section className="w-full px-4 py-24 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-900/20 to-purple-900/20 p-12 text-center">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl" />

          <div className="relative z-10">
            <h2 className="mb-4 text-4xl font-bold text-white sm:text-5xl">
              Ready to Create Your First{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Personalized Card?
              </span>
            </h2>

            <p className="mb-8 text-xl text-slate-300">
              Turn a simple photo into something emotional, beautiful and worth sharing.
            </p>

            <Link
              to="/generator"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 px-10 py-5 text-lg font-semibold text-white shadow-2xl shadow-blue-500/50 transition-all hover:scale-105 hover:from-blue-700 hover:to-cyan-700"
            >
              Start Creating Free
            </Link>

            <p className="mt-4 text-sm text-slate-400">
              No credit card required • First card free
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;