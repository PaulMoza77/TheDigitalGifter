import { trackChristmasEvent } from "./analytics";
import {
  expressWalletAvailabilityReason,
  type ExpressWalletAvailability,
} from "@/features/pet/expressCheckoutOptions";

export function trackChristmasWalletAvailability(
  info: ExpressWalletAvailability,
  extra: {
    productKey: string;
    packageKey?: string | null;
    orderId?: string | null;
    pathname?: string | null;
    amountCents?: number | null;
  },
): void {
  void trackChristmasEvent(
    info.applePay ? "christmas_apple_pay_available" : "christmas_apple_pay_unavailable",
    {
      productKey: extra.productKey,
      packageKey: extra.packageKey ?? null,
      orderId: extra.orderId ?? null,
      pathname: extra.pathname ?? null,
      amountCents: extra.amountCents ?? null,
      metadata: {
        applePay: info.applePay,
        googlePay: info.googlePay,
        link: info.link,
        reason: expressWalletAvailabilityReason(info),
      },
    },
  );
  if (info.any) {
    void trackChristmasEvent("christmas_express_checkout_available", {
      productKey: extra.productKey,
      packageKey: extra.packageKey ?? null,
      orderId: extra.orderId ?? null,
      pathname: extra.pathname ?? null,
      amountCents: extra.amountCents ?? null,
      metadata: {
        applePay: info.applePay,
        googlePay: info.googlePay,
        link: info.link,
      },
    });
  }
}
