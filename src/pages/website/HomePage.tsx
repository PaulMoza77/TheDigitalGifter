import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, Wand2, Heart, ArrowRight } from "lucide-react";

import { HeroSection } from "@/domains/Landing/components/HeroSection";
import { TrendingNowRow } from "@/components/website/TrendingNowRow";
import { HowItWorks } from "@/domains/Landing/components/HowItWorks";
import { FeaturesHighlight } from "@/domains/Landing/components/FeaturesHighlight";
import { Testimonials } from "@/domains/Landing/components/Testimonials";
import { PricingCTA } from "@/domains/Landing/components/PricingCTA";
import { FAQ } from "@/domains/Landing/components/FAQ";

const HomePage: React.FC = () => {
  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <HeroSection />

      <section className="relative border-y border-white/10 bg-gradient-to-b from-black via-slate-950 to-black px-4 py-14 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,214,102,0.14),transparent_42%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/25 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-200">
              <Sparkles className="h-4 w-4" />
              Personalized AI gifts in seconds
            </div>

            <h2 className="max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
              Turn any photo into a card that feels personal, emotional and
              worth sharing.
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
              Choose a style, add a name or message, upload a photo and create a
              beautiful personalized result for birthdays, apologies, love,
              family moments, pets and more.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/generator"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-400 px-7 py-4 text-base font-black text-black shadow-2xl shadow-yellow-500/20 transition hover:scale-[1.02]"
              >
                Start Creating
                <ArrowRight className="h-5 w-5" />
              </Link>

              <Link
                to="/templates"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-base font-bold text-white transition hover:bg-white/10"
              >
                Explore Templates
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <Wand2 className="mb-3 h-6 w-6 text-yellow-300" />
              <h3 className="font-bold">AI photo transformation</h3>
              <p className="mt-1 text-sm text-white/55">
                From simple photo to premium personalized artwork.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <Heart className="mb-3 h-6 w-6 text-pink-300" />
              <h3 className="font-bold">Made for emotions</h3>
              <p className="mt-1 text-sm text-white/55">
                Perfect for gifts, memories, love, apologies and special days.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <Sparkles className="mb-3 h-6 w-6 text-cyan-300" />
              <h3 className="font-bold">Fast and easy</h3>
              <p className="mt-1 text-sm text-white/55">
                Pick a template, add details, generate and download.
              </p>
            </div>
          </div>
        </div>
      </section>

      <TrendingNowRow />
      <HowItWorks />
      <FeaturesHighlight />
      <Testimonials />
      <PricingCTA />
      <FAQ />

      <section className="w-full px-4 py-24 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-yellow-400/25 bg-gradient-to-br from-yellow-400/15 via-orange-500/10 to-pink-500/15 p-8 text-center shadow-2xl shadow-yellow-500/10 sm:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.18),transparent_45%)]" />

          <div className="relative z-10">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-yellow-200">
              First creation is waiting
            </p>

            <h2 className="text-4xl font-black tracking-tight text-white sm:text-6xl">
              Create something they will actually remember.
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/70">
              Personalized cards, name portraits, emotional gifts and beautiful
              AI-generated memories — all in one place.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/generator"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-9 py-5 text-lg font-black text-black shadow-2xl transition hover:scale-[1.02]"
              >
                Create Now
                <ArrowRight className="h-5 w-5" />
              </Link>

              <Link
                to="/templates"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-black/20 px-9 py-5 text-lg font-bold text-white backdrop-blur transition hover:bg-black/35"
              >
                See Templates
              </Link>
            </div>

            <p className="mt-5 text-sm text-white/45">
              No complicated design tools. Just choose, personalize and create.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;