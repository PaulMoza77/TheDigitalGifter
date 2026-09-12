import { useMemo, useState, useEffect, useRef } from "react";
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { sanitizeStripeCheckoutCustomerError, stripeCheckoutInitCustomerError } from "../funnelGuards";
import {
  CARD_PAY_INCOMPLETE_MESSAGE,
  isExpressCheckoutConfirmEvent,
} from "../expressCheckoutConfirm";
import { getStripePromise, reloadStripeForCheckout, stripeInstanceKeyFingerprint } from "../stripeLoader";
import { ApplePayButton } from "./ApplePayButton";
import { PET_EXPRESS_CHECKOUT_OPTIONS } from "../expressCheckoutOptions";

function normalizeClientSecret(clientSecret: string): string {
  const value = String(clientSecret || "").trim();
  if (!value.includes("%")) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export type WalletAvailability = {
  applePay: boolean;
  googlePay: boolean;
  link: boolean;
  any: boolean;
};

const DARK_EXPRESS_OPTIONS = {
  ...PET_EXPRESS_CHECKOUT_OPTIONS,
  buttonHeight: 52,
  buttonTheme: { applePay: "white" as const, googlePay: "white" as const },
  buttonType: { applePay: "buy" as const, googlePay: "buy" as const },
  layout: { maxColumns: 1, maxRows: 2, overflow: "never" as const },
  paymentMethodOrder: ["applePay", "googlePay"],
  paymentMethods: {
    ...PET_EXPRESS_CHECKOUT_OPTIONS.paymentMethods,
    // Always reserve Apple Pay at the top when the device can offer it.
    applePay: "always" as const,
    googlePay: "auto" as const,
    link: "never" as const,
  },
};

function CheckoutBody({
  dueDisplay,
  email,
  payButtonLabel,
  busyLabel = "Paying…",
  loadingLabel = "Loading Apple Pay and card…",
  onBeforeConfirm,
  onReady,
  onPaymentInteraction,
  onInitError,
  onRecoverCheckout,
  onReloadCheckout,
  onWalletAvailability,
  confirmDisabled,
  payButtonClassName,
  surface = "light",
}: {
  dueDisplay: string;
  email?: string;
  payButtonLabel?: (payLabel: string) => string;
  busyLabel?: string;
  loadingLabel?: string;
  onBeforeConfirm?: () => Promise<{ ok: boolean; error?: string; focusId?: string }>;
  onReady?: () => void;
  onPaymentInteraction?: () => void;
  onInitError?: (detail?: { initFailureCode?: string; stripeInstanceKeyFp?: string | null }) => void;
  /** Order-aware recovery. When set, hides the Stripe-only secret reload retry. */
  onRecoverCheckout?: () => void;
  onReloadCheckout?: () => void;
  onWalletAvailability?: (info: WalletAvailability) => void;
  confirmDisabled?: boolean;
  payButtonClassName?: string;
  surface?: "light" | "dark";
}) {
  const checkoutState = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const readyFired = useRef(false);
  const interactionFired = useRef(false);
  const initErrorHandled = useRef(false);

  useEffect(() => {
    if (checkoutState.type === "success" && !readyFired.current) {
      readyFired.current = true;
      initErrorHandled.current = false;
      onReady?.();
    }
  }, [checkoutState.type, onReady]);

  useEffect(() => {
    if (checkoutState.type !== "error" || initErrorHandled.current) return;
    initErrorHandled.current = true;
    const message = checkoutState.error.message || "";
    const initFailureCode = /no such checkout\.session/i.test(message)
      ? "stripe_checkout_session_not_found"
      : /publishable key/i.test(message)
        ? "stripe_publishable_key_invalid"
        : "checkout_provider_init_failed";
    console.info("[stripe-checkout-init]", {
      initFailureCode,
      checkoutProviderState: checkoutState.type,
    });
    onInitError?.({ initFailureCode });
  }, [checkoutState.type, checkoutState, onInitError]);

  function markInteraction() {
    if (interactionFired.current) return;
    interactionFired.current = true;
    onPaymentInteraction?.();
  }

  async function syncCheckoutEmail(checkout: { updateEmail?: (value: string) => Promise<unknown> }) {
    const nextEmail = String(email || "").trim();
    if (!nextEmail || typeof checkout.updateEmail !== "function") return;
    try {
      await checkout.updateEmail(nextEmail);
    } catch (caught) {
      console.info("[stripe-checkout-email-sync]", {
        ok: false,
        reason: caught instanceof Error ? caught.name : "error",
      });
    }
  }

  function failExpressCheckout(event?: StripeExpressCheckoutElementConfirmEvent) {
    try {
      event?.paymentFailed?.({ reason: "fail" });
    } catch {
      // Stripe may already have dismissed the sheet.
    }
  }

  async function confirm(expressCheckoutConfirmEvent?: StripeExpressCheckoutElementConfirmEvent) {
    if (checkoutState.type !== "success") return;
    markInteraction();
    if (busy) return;

    const isExpress = isExpressCheckoutConfirmEvent(expressCheckoutConfirmEvent);

    if (!isExpress && onBeforeConfirm) {
      try {
        const gate = await onBeforeConfirm();
        if (!gate.ok) {
          setError(gate.error || "Complete the form before paying.");
          if (gate.focusId) {
            document.getElementById(gate.focusId)?.focus();
            document.getElementById(gate.focusId)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }
      } catch (caught) {
        const message =
          caught instanceof Error && caught.message.trim()
            ? caught.message.trim()
            : "Could not save your details. Try again.";
        setError(message);
        return;
      }
    }
    if (!isExpress && !paymentComplete) {
      setError(CARD_PAY_INCOMPLETE_MESSAGE);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await syncCheckoutEmail(checkoutState.checkout);
      const result = await checkoutState.checkout.confirm(
        isExpress ? { expressCheckoutConfirmEvent } : {},
      );
      if (result.type === "error") {
        if (isExpress) failExpressCheckout(expressCheckoutConfirmEvent);
        const message = sanitizeStripeCheckoutCustomerError(result.error.message);
        console.info("[stripe-checkout-confirm]", {
          failureCode: result.error.code || "confirm_failed",
        });
        if (message) setError(message);
      } else {
        void onBeforeConfirm?.().catch(() => undefined);
      }
    } catch (caught) {
      if (isExpress) failExpressCheckout(expressCheckoutConfirmEvent);
      const message = sanitizeStripeCheckoutCustomerError(caught instanceof Error ? caught.message : undefined);
      console.info("[stripe-checkout-confirm]", {
        failureCode: caught instanceof Error ? caught.name : "confirm_exception",
      });
      if (message) setError(message);
    } finally {
      setBusy(false);
    }
  }

  const mutedText = surface === "dark" ? "text-amber-50/70" : "text-[#1a140e]/55";
  const rule = surface === "dark" ? "bg-white/18" : "bg-[#1a140e]/12";
  const alertText = surface === "dark" ? "text-rose-200" : "text-[#9a3412]";
  const defaultPayClass =
    surface === "dark"
      ? "h-14 min-h-[56px] w-full rounded-xl bg-gradient-to-b from-[#f3e2b5] via-[#e0c078] to-[#c9a35a] text-[16px] font-semibold text-[#2a1c0e] disabled:opacity-60"
      : "h-14 min-h-[56px] w-full rounded-xl bg-[#1a140e] text-[16px] font-semibold text-white disabled:opacity-60";

  if (checkoutState.type === "loading") {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <ApplePayButton disabled />
        <p className={`text-center text-sm ${mutedText}`}>{loadingLabel}</p>
      </div>
    );
  }

  if (checkoutState.type === "error") {
    // When parent owns recovery, do not offer a Stripe-only retry that reloads the same invalid secret.
    if (onRecoverCheckout) {
      return (
        <div className="space-y-3 py-2">
          <p className={`text-sm ${alertText}`} role="alert">
            {stripeCheckoutInitCustomerError(checkoutState.error.message)}
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-3 py-2">
        <p className={`text-sm ${alertText}`} role="alert">
          {stripeCheckoutInitCustomerError(checkoutState.error.message)}
        </p>
        <button
          type="button"
          onClick={() => {
            initErrorHandled.current = false;
            onReloadCheckout?.();
          }}
          className={
            surface === "dark"
              ? "h-11 w-full rounded-full border border-[#f6efe4]/25 bg-transparent text-sm text-[#f6efe4]"
              : "h-11 w-full rounded-full border border-[#1a140e]/20 bg-transparent text-sm text-[#1a140e]"
          }
        >
          Retry secure payment
        </button>
      </div>
    );
  }

  const payLabel = dueDisplay.replace(" USD", "");
  const buttonText = payButtonLabel ? payButtonLabel(payLabel) : `Pay ${payLabel} — Get portraits`;

  return (
    <div className="space-y-4">
      <div className="min-h-[52px]">
        <ExpressCheckoutElement
          options={surface === "dark" ? DARK_EXPRESS_OPTIONS : {
            ...PET_EXPRESS_CHECKOUT_OPTIONS,
            layout: { maxColumns: 1, maxRows: 2, overflow: "never" as const },
            paymentMethods: {
              ...PET_EXPRESS_CHECKOUT_OPTIONS.paymentMethods,
              applePay: "always" as const,
            },
          }}
          onReady={(event) => {
            const methods = event?.availablePaymentMethods || {};
            const applePay = Boolean(methods.applePay);
            const googlePay = Boolean(methods.googlePay);
            const link = Boolean(methods.link);
            onWalletAvailability?.({
              applePay,
              googlePay,
              link,
              any: applePay || googlePay || link,
            });
          }}
          onConfirm={(event) => void confirm(event)}
          onClick={markInteraction}
          onCancel={() => setError(null)}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className={`h-px flex-1 ${rule}`} />
        <span className={`text-[12px] font-medium ${mutedText}`}>Or pay with card</span>
        <span className={`h-px flex-1 ${rule}`} />
      </div>

      <div onFocusCapture={markInteraction} onChangeCapture={markInteraction}>
        <PaymentElement
          options={{
            layout: "tabs",
            wallets: { applePay: "never", googlePay: "never", link: "never" },
          }}
          onChange={(event) => {
            setPaymentComplete(event.complete);
            if (event.complete) setError(null);
          }}
        />
      </div>

      <button
        type="button"
        disabled={busy || confirmDisabled}
        onClick={() => void confirm()}
        className={payButtonClassName ?? defaultPayClass}
      >
        {busy ? busyLabel : buttonText}
      </button>

      {error ? (
        <p className={`text-sm ${alertText}`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CustomStripeCheckout({
  clientSecret,
  publishableKey,
  email,
  dueDisplay,
  payButtonLabel,
  busyLabel,
  loadingLabel,
  onBeforeConfirm,
  onReady,
  onPaymentInteraction,
  onInitError,
  onRecoverCheckout,
  onWalletAvailability,
  confirmDisabled,
  appearanceTheme = "stripe",
  appearanceVariables,
  payButtonClassName,
}: {
  clientSecret: string;
  publishableKey: string;
  email?: string;
  dueDisplay: string;
  payButtonLabel?: (payLabel: string) => string;
  busyLabel?: string;
  loadingLabel?: string;
  onBeforeConfirm?: () => Promise<{ ok: boolean; error?: string; focusId?: string }>;
  onReady?: () => void;
  onPaymentInteraction?: () => void;
  onInitError?: (detail?: { initFailureCode?: string; stripeInstanceKeyFp?: string | null }) => void;
  onRecoverCheckout?: () => void;
  onWalletAvailability?: (info: WalletAvailability) => void;
  confirmDisabled?: boolean;
  appearanceTheme?: "stripe" | "night";
  appearanceVariables?: Record<string, string>;
  payButtonClassName?: string;
}) {
  const [reloadNonce, setReloadNonce] = useState(0);
  const hasAutoRetried = useRef(false);
  const normalizedClientSecret = useMemo(() => normalizeClientSecret(clientSecret), [clientSecret]);
  const stripePromise = useMemo(() => {
    const fp = stripeInstanceKeyFingerprint(publishableKey);
    console.info("[stripe-loader]", {
      stripeInstanceKeyFp: fp,
      source: "runtime_publishable_key",
      reloadNonce,
    });
    return reloadNonce > 0
      ? reloadStripeForCheckout(publishableKey)
      : getStripePromise(publishableKey);
  }, [publishableKey, reloadNonce]);

  function reloadCheckout() {
    hasAutoRetried.current = false;
    setReloadNonce((value) => value + 1);
  }

  function handleInitError(detail?: { initFailureCode?: string; stripeInstanceKeyFp?: string | null }) {
    if (!hasAutoRetried.current) {
      hasAutoRetried.current = true;
      setReloadNonce((value) => value + 1);
      return;
    }
    onInitError?.(detail);
  }

  function handleReady() {
    hasAutoRetried.current = false;
    onReady?.();
  }

  const surface = appearanceTheme === "night" ? "dark" : "light";
  const variables =
    appearanceVariables ??
    (appearanceTheme === "night"
      ? {
          colorPrimary: "#e0c078",
          colorBackground: "#1a1512",
          colorText: "#f6efe4",
          colorTextSecondary: "#e8dcc8",
          colorDanger: "#f5a8a0",
          borderRadius: "12px",
          fontFamily: 'system-ui, "Segoe UI", sans-serif',
          fontSizeBase: "16px",
        }
      : {
          colorPrimary: "#1a140e",
          borderRadius: "12px",
        });

  return (
    <CheckoutElementsProvider
      key={`${publishableKey}:${reloadNonce}:${normalizedClientSecret.includes("_secret_") ? "secret" : "invalid"}`}
      stripe={stripePromise}
      options={{
        clientSecret: normalizedClientSecret,
        defaultValues: email ? { email } : undefined,
        elementsOptions: {
          appearance: {
            theme: appearanceTheme,
            variables,
            rules: appearanceTheme === "night"
              ? {
                  ".Label": {
                    color: "#f0e6d4",
                    fontWeight: "600",
                    fontSize: "13px",
                  },
                  ".Input": {
                    backgroundColor: "#2a221c",
                    color: "#f6efe4",
                    border: "1px solid rgba(246, 239, 228, 0.28)",
                  },
                  ".Input:focus": {
                    border: "1px solid rgba(224, 192, 120, 0.8)",
                    boxShadow: "0 0 0 1px rgba(224, 192, 120, 0.35)",
                  },
                  ".Tab": {
                    color: "#e8dcc8",
                    border: "1px solid rgba(246, 239, 228, 0.18)",
                    backgroundColor: "#1a1512",
                  },
                  ".Tab--selected": {
                    color: "#1a140e",
                    backgroundColor: "#e0c078",
                    border: "1px solid #e0c078",
                  },
                }
              : undefined,
          },
        },
      }}
    >
      <CheckoutBody
        dueDisplay={dueDisplay}
        email={email}
        payButtonLabel={payButtonLabel}
        busyLabel={busyLabel}
        loadingLabel={loadingLabel}
        onBeforeConfirm={onBeforeConfirm}
        onReady={handleReady}
        onPaymentInteraction={onPaymentInteraction}
        onInitError={handleInitError}
        onRecoverCheckout={onRecoverCheckout}
        onReloadCheckout={reloadCheckout}
        onWalletAvailability={onWalletAvailability}
        confirmDisabled={confirmDisabled}
        payButtonClassName={payButtonClassName}
        surface={surface}
      />
    </CheckoutElementsProvider>
  );
}
