import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import { PricingModal } from "../components/PricingModal";
import Footer from "@/components/Footer";

export default function MainLayout() {
  const [showPricing, setShowPricing] = useState(false);

  const handleBuyCredits = () => {
    setShowPricing(true);
  };

  return (
    <>
      <Header onBuyCredits={handleBuyCredits} />
      <Outlet />
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
      />
      <Footer />
    </>
  );
}
