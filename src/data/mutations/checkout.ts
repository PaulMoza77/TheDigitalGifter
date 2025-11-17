import { useMutation } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";

type CheckoutArgs = {
  pack: string;
};

type CheckoutResponse = {
  url?: string | null;
};

export function useCheckoutMutation() {
  const convex = useConvex();

  return useMutation<CheckoutResponse, Error, CheckoutArgs>({
    mutationKey: ["checkout", "create"],
    mutationFn: (variables) =>
      convex.action(api.checkout.createCheckoutByPack, variables),
  });
}
