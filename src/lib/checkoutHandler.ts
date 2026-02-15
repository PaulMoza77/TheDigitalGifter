// src/lib/checkoutHandler.ts
import { supabase } from "@/lib/supabase";

export type LoggedInUserLite = {
  id: string;
  email: string | null;
};

export type CheckoutArgs = {
  pack: string;
  quantity?: number;
  user: LoggedInUserLite | null;
};

export async function handleCheckout(args: CheckoutArgs): Promise<void> {
  const { pack, quantity = 1, user } = args;

  // (optional) you can require login:
  // if (!user) throw new Error("Please sign in to purchase credits.");

  // Call Supabase Edge Function to create Stripe Checkout
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: { pack, quantity, userId: user?.id ?? null },
  });

  if (error) {
    throw error;
  }

  const url = (data as any)?.url as string | null | undefined;
  if (!url) {
    throw new Error("Checkout URL missing from server response.");
  }

  window.location.href = url;
}