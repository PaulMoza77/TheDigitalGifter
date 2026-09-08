/** Stripe-reported wallet availability. Never invent Apple Pay chrome from this. */
export type ExpressWalletAvailability = {
  applePay: boolean;
  googlePay: boolean;
  link: boolean;
  any: boolean;
};

export function expressWalletAvailabilityFromMethods(
  methods?: { applePay?: boolean; googlePay?: boolean; link?: boolean } | null,
): ExpressWalletAvailability {
  const applePay = Boolean(methods?.applePay);
  const googlePay = Boolean(methods?.googlePay);
  const link = Boolean(methods?.link);
  return {
    applePay,
    googlePay,
    link,
    any: applePay || googlePay || link,
  };
}

export function expressWalletAvailabilityReason(info: ExpressWalletAvailability): string {
  return info.any
    ? "wallet_available"
    : "wallet_unavailable_device_or_domain_or_stripe_config";
}

/** Shared Express Checkout Element options for Pet + Christmas paid funnels. */
export const PET_EXPRESS_CHECKOUT_OPTIONS = {
  buttonHeight: 55,
  buttonTheme: { applePay: "black" as const, googlePay: "black" as const },
  buttonType: { applePay: "buy" as const, googlePay: "buy" as const },
  layout: { maxColumns: 1, maxRows: 4 },
  paymentMethodOrder: ["applePay", "googlePay"],
  paymentMethods: {
    // "auto" hides wallets until domain association + device support are verified.
    applePay: "auto" as const,
    googlePay: "auto" as const,
    link: "auto" as const,
    paypal: "never" as const,
    amazonPay: "never" as const,
    klarna: "never" as const,
  },
};
