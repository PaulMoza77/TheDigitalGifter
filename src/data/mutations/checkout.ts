import { useMutation } from "@tanstack/react-query";

type CheckoutArgs = {
  pack: string;
  quantity?: number;
};

type CheckoutResponse = {
  url?: string | null;
};

export function useCheckoutMutation() {
  return useMutation<CheckoutResponse, Error, CheckoutArgs>({
    mutationKey: ["checkout", "create"],
    mutationFn: async (variables) => {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variables),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Checkout failed");
      }

      return (await res.json()) as CheckoutResponse;
    },
  });
}