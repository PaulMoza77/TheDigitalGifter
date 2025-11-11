import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import SignOutButton from "./components/SignOutButton";
import { useState, useEffect } from "react";
import HeroSection from "./components/HeroSection";
import GeneratorPage from "./components/GeneratorPage";
import TemplatesGrid from "./components/TemplatesGrid";
import { Toaster, toast } from "sonner";
import { PricingModal } from "./components/PricingModal";
import { CreditsDisplay } from "./components/CreditsDisplay";

export default function App() {
  const [currentView, setCurrentView] = useState<
    "landing" | "generator" | "templates"
  >("landing");
  const [showPricing, setShowPricing] = useState(false);

  const me = useQuery(api.auth.loggedInUser);
  const buyPack = useAction(api.checkout.createCheckoutByPack);

  // Detect checkout success and refresh credits
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      console.log(
        "[App] Checkout success detected, credits should update automatically via query"
      );
      // Remove query param for clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="min-h-screen bg-black text-gray-900 flex flex-col">
      <header className="sticky top-0 z-50 bg-gray-900 border-b border-gray-700 flex justify-between items-center px-6 py-3 shadow-lg">
        <h1 className="text-2xl font-bold font-poppins text-white">
          TheDigitalGifter
        </h1>
        <div className="flex items-center space-x-4">
          <CreditsDisplay />
          <button
            onClick={() => setShowPricing(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            Buy Credits
          </button>

          {me ? <SignOutButton /> : <SignInForm />}
        </div>
      </header>
      {currentView === "landing" && (
        <HeroSection
          onStartCreating={() => setCurrentView("generator")}
          onViewTemplates={() => setCurrentView("templates")}
        />
      )}

      {currentView === "generator" && <GeneratorPage />}

      {currentView === "templates" && (
        <div className="p-6">
          <button
            onClick={() => setCurrentView("landing")}
            className="bg-gray-600 text-white mb-4 px-4 py-2 rounded-md"
          >
            ← Back to Landing
          </button>
          <TemplatesGrid />
        </div>
      )}

      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        onBuyPack={async (pack) => {
          // Require login before checkout
          if (!me) {
            toast.error("Please sign in to purchase credits");
            setShowPricing(false);
            return;
          }

          try {
            console.log("[App] Starting checkout", { pack, userId: me._id });
            const { url } = await buyPack({ pack });
            if (url) {
              console.log("[App] Redirecting to Stripe", { url });
              window.location.assign(url);
            } else {
              console.error("[App] No Stripe URL returned");
              toast.error(
                "Failed to create checkout session. Please try again."
              );
            }
          } catch (err: any) {
            console.error("[App] Stripe checkout failed", err);
            const message =
              err?.message || "Checkout failed. Please try again.";
            if (message.includes("Must be logged in")) {
              toast.error("Please sign in to purchase credits");
            } else {
              toast.error(
                "Failed to create checkout session. Please try again."
              );
            }
          }
        }}
      />
      <Toaster />
    </div>
  );
}
