import { OccasionGrid } from "../components/Landing/OccasionGrid";
import { HowItWorks } from "../components/Landing/HowItWorks";
import { FeaturesHighlight } from "../components/Landing/FeaturesHighlight";
import { Testimonials } from "../components/Landing/Testimonials";
import { PricingCTA } from "../components/Landing/PricingCTA";
import { FAQ } from "../components/Landing/FAQ";
import { HeroSection } from "../components/Landing/HeroSection";
import { Link } from "react-router-dom";

const HomePage = () => {
  return (
    <>
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <HeroSection />
        <OccasionGrid />
        <HowItWorks />
        <FeaturesHighlight />
        <Testimonials />
        <PricingCTA />
        <FAQ />

        {/* Final CTA Section */}
        <section className="w-full py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center space-y-8 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-3xl p-12 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl" />

            <div className="relative z-10">
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                Ready to Create Your First{" "}
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  AI Card?
                </span>
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Join 50,000+ users creating stunning personalized cards with AI
              </p>
              <Link
                to="/generator"
                className="inline-flex items-center gap-2 px-10 py-5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-2xl font-semibold text-lg shadow-2xl shadow-blue-500/50 transition-all hover:scale-105"
              >
                Start Creating Free
              </Link>
              <p className="text-sm text-slate-400 mt-4">
                No credit card required • First card free
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default HomePage;
