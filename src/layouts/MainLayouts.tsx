import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import { PricingModal, CreditsFunnelModal } from "../components/PricingModal";
import { CreditsFunnelProvider } from "@/contexts/CreditsFunnelContext";
import Footer from "@/components/Footer";

export default function MainLayout() {
  const [showPricing, setShowPricing] = useState(false);

  const handleBuyCredits = () => {
    alert("BUY CREDITS CLICKED");
    setShowPricing(true);
  };

  return (
    <CreditsFunnelProvider>
      <Header onBuyCredits={handleBuyCredits} />
      <Outlet />

      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
      />

      <CreditsFunnelModal />
      <Footer />
    </CreditsFunnelProvider>
  );
}