import { toast } from "sonner";
import { Doc } from "../../convex/_generated/dataModel";

type Pack = "starter" | "creator" | "pro" | "enterprise";

/**
 * Global checkout handler for all pricing flows
 * Handles auth checks, Stripe redirect, and error handling
 */
export async function handleCheckout({
  pack,
  user,
  checkoutMutation,
}: {
  pack: Pack;
  user: Doc<"users"> | null;
  checkoutMutation: {
    mutateAsync: (input: { pack: string }) => Promise<{ url?: string | null }>;
  };
}) {
  // Auth check
  if (!user) {
    toast.error("Please sign in to purchase credits");
    return false;
  }

  try {
    console.log("[handleCheckout] Starting checkout", {
      pack,
      userId: user._id,
    });

    const response = await checkoutMutation.mutateAsync({ pack });
    const url = response?.url;

    if (url) {
      console.log("[handleCheckout] Redirecting to Stripe", { url });
      window.location.assign(url);
      return true;
    } else {
      console.error("[handleCheckout] No Stripe URL returned");
      toast.error("Failed to create checkout session. Please try again.");
      return false;
    }
  } catch (err: any) {
    console.error("[handleCheckout] Stripe checkout failed", err);
    const message = err?.message || "Checkout failed. Please try again.";

    if (message.includes("Must be logged in")) {
      toast.error("Please sign in to purchase credits");
    } else {
      toast.error("Failed to create checkout session. Please try again.");
    }

    return false;
  }
}
