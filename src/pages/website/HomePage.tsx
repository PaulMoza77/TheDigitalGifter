import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gift, Heart, Sparkles } from "lucide-react";

import { HeroSection } from "@/domains/Landing/components/HeroSection";
import { HowItWorks } from "@/domains/Landing/components/HowItWorks";
import { FeaturesHighlight } from "@/domains/Landing/components/FeaturesHighlight";
import { Testimonials } from "@/domains/Landing/components/Testimonials";
import { PricingCTA } from "@/domains/Landing/components/PricingCTA";
import { FAQ } from "@/domains/Landing/components/FAQ";

const HomePage: React.FC = () => {
  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <HeroSection />

      <section className="relative border-y border-white/10 bg-gradient-to-b from-black via-slate-950 to-black px-4 py-20 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,214,102,0.12),transparent_45%)]" />

        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-yellow-400/25 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-200">
              <Sparkles className="h-4 w-4" />
              Gifts that feel personal
            </div>

            <h2 className="text-4xl font-black tracking-tight text-white sm:text-6xl">
              Create something they will actually feel.
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/65">
              Turn a photo, a name, or a message into a meaningful visual gift
              made for birthdays, love, apologies, family memories, pets, and
              special moments.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl">
              <Gift className="mb-4 h-7 w-7 text-yellow-300" />
              <h3 className="text-lg font-black text-white">
                Personal, not generic
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Add a name, a face, a memory, or a small detail that makes the
                result feel made only for them.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl">
              <Heart className="mb-4 h-7 w-7 text-pink-300" />
              <h3 className="text-lg font-black text-white">
                Built around emotion
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/55">
                From romantic gestures to family moments, every style is made to
                create a reaction.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl">
              <Sparkles className="mb-4 h-7 w-7 text-cyan-300" />
              <h3 className="text-lg font-black text-white">
                Beautiful in seconds
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Choose a template, add your details, and create a polished gift
                without complicated design tools.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/generator"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-400 px-8 py-4 text-base font-black text-black shadow-2xl shadow-yellow-500/20 transition hover:scale-[1.02]"
            >
              Start Creating
              <ArrowRight className="h-5 w-5" />
            </Link>

            <Link
              to="/templates"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-8 py-4 text-base font-bold text-white transition hover:bg-white/10"
            >
              Explore Templates
            </Link>
          </div>
        </div>
      </section>

      <HowItWorks />
      <FeaturesHighlight />
      <Testimonials />
      <PricingCTA />
      <FAQ />

      <section className="w-full px-4 py-24 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-yellow-400/25 bg-gradient-to-br from-yellow-400/15 via-orange-500/10 to-pink-500/15 p-8 text-center shadow-2xl shadow-yellow-500/10 sm:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.16),transparent_45%)]" />

          <div className="relative z-10">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-yellow-200">
              Make it personal
            </p>

            <h2 className="text-4xl font-black tracking-tight text-white sm:text-6xl">
              A small gesture can become a lasting memory.
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/70">
              Create name portraits, emotional cards, apology gifts, birthday
              surprises, love notes, family keepsakes and more.
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
              Choose a style. Add your details. Create something meaningful.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;