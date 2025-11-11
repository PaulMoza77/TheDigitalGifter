import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PricingModal } from "./PricingModal";
import { toast } from "sonner";

type Pack = "starter" | "creator" | "pro" | "enterprise";

export function PurchaseCredits() {
  const [showModal, setShowModal] = useState(false);
  const credits = useQuery(api.credits.getUserCredits) ?? 0;
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const createCheckoutByPack = useAction(api.checkout.createCheckoutByPack);

  // ✅ Funcția care pornește plata
  async function onBuyPack(pack: Pack) {
    try {
      if (!loggedInUser) {
        toast.error("Please sign in to purchase credits");
        return;
      }

      console.log("[PurchaseCredits] start checkout", {
        pack,
        userId: loggedInUser._id,
      });

      const { url } = await createCheckoutByPack({ pack });

      console.log("[PurchaseCredits] stripe url:", url);
      if (!url) {
        toast.error(
          "Nu am primit URL de la Stripe. Verifică ENV-urile PRICE_* în Convex."
        );
        return;
      }

      window.location.assign(url);
    } catch (e) {
      console.error("[PurchaseCredits] error:", e);
      toast.error("Eroare la inițierea plății. Vezi consola pentru detalii.");
    }
  }

  return (
    <div className="glass-card p-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-light mb-2">Your Credits</h3>

        <div className="mb-4">
          <span className="text-3xl font-bold text-festive-green">
            {credits}
          </span>
          <span className="text-light-muted ml-1">credits remaining</span>
        </div>

        <p className="text-sm text-light-muted mb-4">
          Use credits to generate AI images and greeting cards
        </p>

        <button
          onClick={() => setShowModal(true)}
          className="btn-festive"
          type="button"
        >
          Buy More Credits
        </button>
      </div>

      <PricingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onBuyPack={onBuyPack}
      />
    </div>
  );
}
