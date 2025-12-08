import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import { PricingModal, CreditsFunnelModal } from "../components/PricingModal";
import { CreditsFunnelProvider } from "@/contexts/CreditsFunnelContext";
import Footer from "@/components/Footer";

export default function MainLayout() {
  // Keep local state for header "Buy Credits" button (opens normal pricing modal)
  const [showPricing, setShowPricing] = useState(false);

  const handleBuyCredits = () => {
    setShowPricing(true);
  };

  return (
    <CreditsFunnelProvider>
      <Header onBuyCredits={handleBuyCredits} />
      <Outlet />
      {/* Normal pricing modal triggered by header credits button */}
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
      />
      {/* Credits funnel modal triggered by context (from Generator, etc.) */}
      <CreditsFunnelModal />
      <Footer />
    </CreditsFunnelProvider>
  );
}
