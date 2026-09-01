/** Shared Stripe Express Checkout Element options for pet funnels. */
export const PET_EXPRESS_CHECKOUT_OPTIONS = {
  buttonHeight: 55,
  buttonTheme: { applePay: "black" as const, googlePay: "black" as const },
  buttonType: { applePay: "buy" as const, googlePay: "buy" as const },
  layout: { maxColumns: 1, maxRows: 4 },
  // Apple Pay first when Stripe allows it; Link is the common non-Apple fallback.
  paymentMethodOrder: ["applePay", "link", "googlePay"],
  paymentMethods: {
    // "always" still requires a registered domain + Apple-capable browser, but
    // does not hide the button merely because Wallet has no active card yet.
    applePay: "always" as const,
    googlePay: "auto" as const,
    link: "auto" as const,
    paypal: "never" as const,
    amazonPay: "never" as const,
    klarna: "never" as const,
  },
};
