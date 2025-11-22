import { Helmet } from "react-helmet-async";
import { OccasionGrid } from "../components/Landing/OccasionGrid";
import { HowItWorks } from "../components/Landing/HowItWorks";
import { FeaturesHighlight } from "../components/Landing/FeaturesHighlight";
import { Testimonials } from "../components/Landing/Testimonials";
import { PricingCTA } from "../components/Landing/PricingCTA";
import { FAQ } from "../components/Landing/FAQ";
import { HeroSection } from "../components/Landing/HeroSection";
import { Link } from "react-router-dom";

const HomePage = () => {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://thedigitalgifter.com/#organization",
        name: "TheDigitalGifter",
        url: "https://thedigitalgifter.com",
        logo: {
          "@type": "ImageObject",
          url: "https://thedigitalgifter.com/logo.png",
        },
        sameAs: [
          "https://twitter.com/digitalgifter",
          "https://facebook.com/digitalgifter",
        ],
      },
      {
        "@type": "WebSite",
        "@id": "https://thedigitalgifter.com/#website",
        url: "https://thedigitalgifter.com",
        name: "TheDigitalGifter",
        publisher: {
          "@id": "https://thedigitalgifter.com/#organization",
        },
        potentialAction: {
          "@type": "SearchAction",
          target:
            "https://thedigitalgifter.com/templates?search={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "HowTo",
        name: "How to Create AI Christmas Cards",
        description:
          "Create stunning personalized AI Christmas cards in 4 simple steps",
        step: [
          {
            "@type": "HowToStep",
            position: 1,
            name: "Choose Your Style",
            text: "Browse 100+ premium templates across Christmas, birthdays, weddings, and more",
          },
          {
            "@type": "HowToStep",
            position: 2,
            name: "Upload Your Photos",
            text: "Add 1-4 photos and our AI will match faces perfectly",
          },
          {
            "@type": "HowToStep",
            position: 3,
            name: "AI Generates Magic",
            text: "Wait ~30 seconds for AI to create your personalized card",
          },
          {
            "@type": "HowToStep",
            position: 4,
            name: "Download & Share",
            text: "Get high-resolution cards ready for print or digital sharing",
          },
        ],
      },
      {
        "@type": "Product",
        name: "TheDigitalGifter AI Card Generator",
        description:
          "AI-powered personalized card and video generation platform",
        brand: {
          "@id": "https://thedigitalgifter.com/#organization",
        },
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: "9",
          highPrice: "79",
          offerCount: "3",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.9",
          reviewCount: "50000",
        },
      },
    ],
  };

  return (
    <>
      <Helmet>
        {/* Primary Meta Tags */}
        <title>
          TheDigitalGifter — AI Personalized Christmas Cards & Holiday Videos |
          Create in 30s
        </title>
        <meta
          name="description"
          content="Create stunning AI-powered Christmas cards, birthday cards, and holiday videos in seconds. Upload photos, choose from 100+ templates, and get print-quality personalized cards. Powered by advanced AI."
        />
        <meta
          name="keywords"
          content="AI Christmas cards, personalized holiday cards, AI video generator, birthday cards, wedding cards, digital greeting cards, AI card maker"
        />
        <link rel="canonical" href="https://thedigitalgifter.com" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://thedigitalgifter.com" />
        <meta
          property="og:title"
          content="TheDigitalGifter — AI Personalized Christmas Cards & Holiday Videos"
        />
        <meta
          property="og:description"
          content="Create stunning AI-powered Christmas cards, birthday cards, and holiday videos in seconds. 100+ premium templates, print-quality resolution."
        />
        <meta
          property="og:image"
          content="https://thedigitalgifter.com/og-image.jpg"
        />
        <meta property="og:site_name" content="TheDigitalGifter" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://thedigitalgifter.com" />
        <meta
          name="twitter:title"
          content="TheDigitalGifter — AI Personalized Christmas Cards & Holiday Videos"
        />
        <meta
          name="twitter:description"
          content="Create stunning AI-powered Christmas cards, birthday cards, and holiday videos in seconds. 100+ premium templates, print-quality resolution."
        />
        <meta name="twitter:image" content="/twitter-image.jpg" />
        <meta name="twitter:creator" content="@digitalgifter" />

        {/* Additional Meta Tags */}
        <meta name="author" content="TheDigitalGifter" />
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="revisit-after" content="7 days" />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

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
