import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import { PricingModal } from "../components/PricingModal";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export default function MainLayout() {
  const [showPricing, setShowPricing] = useState(false);
  const me = useQuery(api.auth.loggedInUser);
  const buyPack = useAction(api.checkout.createCheckoutByPack);

  const handleBuyCredits = () => {
    setShowPricing(true);
  };

  const handleBuyPack = async (pack: string) => {
    if (!me) {
      toast.error("Please sign in to purchase credits");
      setShowPricing(false);
      return;
    }

    try {
      console.log("[MainLayout] Starting checkout", { pack, userId: me._id });
      const { url } = await buyPack({ pack });
      if (url) {
        console.log("[MainLayout] Redirecting to Stripe", { url });
        window.location.assign(url);
      } else {
        console.error("[MainLayout] No Stripe URL returned");
        toast.error("Failed to create checkout session. Please try again.");
      }
    } catch (err: any) {
      console.error("[MainLayout] Stripe checkout failed", err);
      const message = err?.message || "Checkout failed. Please try again.";
      if (message.includes("Must be logged in")) {
        toast.error("Please sign in to purchase credits");
      } else {
        toast.error("Failed to create checkout session. Please try again.");
      }
    }
  };

  return (
    <>
      <Header onBuyCredits={handleBuyCredits} />
      <Outlet />
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        onBuyPack={handleBuyPack}
      />
    </>
  );
}
