/** Shared Stripe Express Checkout Element options for pet funnels. */
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
