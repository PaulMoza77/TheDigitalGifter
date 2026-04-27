// FILE: src/data/mutations/useCheckoutMutation.ts
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type Plan = "starter" | "pro" | "elite";

export type CheckoutArgs = {
  plan: Plan;
  email?: string | null;
  name?: string | null;
  generation_id?: string | null;
  template_id?: string | null;
  promo_code?: string | null;
  style_id?: string | null;
  funnel_slug?: string | null;
  occasion?: string | null;
  photo_path?: string | null;
};

export type CheckoutResponse = {
  url: string;
  id: string;
  generation_id?: string | null;
  user_id?: string | null;
  promo_applied?: boolean;
  promo_code?: string | null;
  discount_percent?: number | null;
  affiliate_applied?: boolean;
  affiliate_code?: string | null;
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

      const payload = {
        ...variables,
        email: variables.email || session.user.email,
      };

      const { data, error } = await supabase.functions.invoke<CheckoutResponse>(
        "create-checkout-session",
        {
          body: payload,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (error) {
        throw new Error(error.message || "Checkout failed");
      }

      if (!data?.url) {
        throw new Error("Checkout URL missing.");
      }

      return data;
    },
  });
}