// FILE: src/data/mutations/useCheckoutMutation.ts
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type Plan = "starter" | "pro" | "elite";

type CheckoutArgs = {
  plan: Plan;
  email?: string;
  name?: string | null;
  generation_id?: string | null;
  template_id?: string | null;
  promo_code?: string | null;
  style_id?: string | null;
  funnel_slug?: string | null;
  occasion?: string | null;
  photo_path?: string | null;
};

type CheckoutResponse = {
  url?: string | null;
  id?: string;
  generation_id?: string;
  user_id?: string | null;
};

export function useCheckoutMutation() {
  return useMutation<CheckoutResponse, Error, CheckoutArgs>({
    mutationKey: ["checkout", "create"],
    mutationFn: async (variables) => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session?.access_token || !session.user?.id || !session.user?.email) {
        throw new Error("You must be logged in before checkout.");
      }

      const { data, error } = await supabase.functions.invoke(
        "create-checkout-session",
        {
          body: {
            ...variables,
            email: variables.email || session.user.email,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) {
        throw new Error(error.message || "Checkout failed");
      }

      const response = data as CheckoutResponse;

      if (!response?.url) {
        throw new Error("Checkout URL missing.");
      }

      return response;
    },
  });
}