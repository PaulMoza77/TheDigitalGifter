import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import { PricingModal } from "../components/PricingModal";
import { toast } from "sonner";
import { useCheckoutMutation, useLoggedInUserQuery } from "@/data";

export default function MainLayout() {
  const [showPricing, setShowPricing] = useState(false);
  const { data: me } = useLoggedInUserQuery();
  const buyPack = useCheckoutMutation();

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
      const { url } = await buyPack.mutateAsync({ pack });
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
      {/* FOOTER */}
      <footer className="text-center py-6 text-[#dfe6f1] text-sm border-t border-white/10">
        <div className="mb-2 font-extrabold text-white">
          🎁 TheDigitalGifter
        </div>
        <p>© 2024 TheDigitalGifter. Spreading Christmas joy with AI.</p>
      </footer>
    </>
  );
}
