import { useMemo, useState, useEffect, useRef } from "react";
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { sanitizeStripeCheckoutCustomerError } from "../funnelGuards";
import { getStripePromise, reloadStripeForCheckout, stripeInstanceKeyFingerprint } from "../stripeLoader";
import { ApplePayButton } from "./ApplePayButton";

const EXPRESS_OPTIONS = {
  buttonHeight: 55,
  buttonTheme: { applePay: "black" as const, googlePay: "black" as const },
  buttonType: { applePay: "buy" as const, googlePay: "buy" as const },
  layout: { maxColumns: 1, maxRows: 2, overflow: "never" as const },
  paymentMethodOrder: ["apple_pay", "google_pay"],
  paymentMethods: {
    applePay: "always" as const,
    googlePay: "always" as const,
    link: "never" as const,
    paypal: "never" as const,
    amazonPay: "never" as const,
    klarna: "never" as const,
  },
};

function CheckoutBody({
  dueDisplay,
  returnUrl,
  payButtonLabel,
  busyLabel = "Paying…",
  loadingLabel = "Loading Apple Pay and card…",
  onBeforeConfirm,
  onReady,
  onPaymentInteraction,
  onInitError,
  confirmDisabled,
  payButtonClassName,
}: {
  dueDisplay: string;
  returnUrl: string;
  payButtonLabel?: (payLabel: string) => string;
  busyLabel?: string;
  loadingLabel?: string;
  onBeforeConfirm?: () => Promise<{ ok: boolean; error?: string; focusId?: string }>;
  onReady?: () => void;
  onPaymentInteraction?: () => void;
  onInitError?: (detail?: { initFailureCode?: string; stripeInstanceKeyFp?: string | null }) => void;
  confirmDisabled?: boolean;
  payButtonClassName?: string;
}) {
  const checkoutState = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applePayFromStripe, setApplePayFromStripe] = useState(false);
  const readyFired = useRef(false);
  const interactionFired = useRef(false);
  const initErrorFired = useRef(false);

  useEffect(() => {
    if (checkoutState.type === "success" && !readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
  }, [checkoutState.type, onReady]);

  useEffect(() => {
    if (checkoutState.type !== "error" || initErrorFired.current) return;
    initErrorFired.current = true;
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

  async function confirm(expressCheckoutConfirmEvent?: StripeExpressCheckoutElementConfirmEvent) {
    if (checkoutState.type !== "success") return;
    markInteraction();
    if (onBeforeConfirm) {
      const gate = await onBeforeConfirm();
      if (!gate.ok) {
        setError(gate.error || "Complete the form before paying.");
        if (gate.focusId) {
          document.getElementById(gate.focusId)?.focus();
          document.getElementById(gate.focusId)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const result = await checkoutState.checkout.confirm({
        returnUrl,
        ...(expressCheckoutConfirmEvent ? { expressCheckoutConfirmEvent } : {}),
      });
      if (result.type === "error") {
        setError(sanitizeStripeCheckoutCustomerError(result.error.message));
      }
    } catch (caught) {
      setError(sanitizeStripeCheckoutCustomerError(caught instanceof Error ? caught.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  if (checkoutState.type === "loading") {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <ApplePayButton disabled />
        <p className="text-center text-sm text-[#1a140e]/55">{loadingLabel}</p>
      </div>
    );
  }

  if (checkoutState.type === "error") {
    return (
      <div className="space-y-3 py-2">
        <p className="text-sm text-[#9a3412]" role="alert">
          {sanitizeStripeCheckoutCustomerError(checkoutState.error.message)}
        </p>
      </div>
    );
  }

  const payLabel = dueDisplay.replace(" USD", "");
  const buttonText = payButtonLabel ? payButtonLabel(payLabel) : `Pay ${payLabel} — Get portraits`;

  return (
    <div className="space-y-4">
      <ExpressCheckoutElement
        options={EXPRESS_OPTIONS}
        onReady={(event) => {
          setApplePayFromStripe(Boolean(event.availablePaymentMethods?.applePay));
          markInteraction();
        }}
        onConfirm={(event) => void confirm(event)}
        onClick={markInteraction}
      />
      {applePayFromStripe ? null : <ApplePayButton disabled={busy || confirmDisabled} />}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[#1a140e]/12" />
        <span className="text-[12px] text-[#1a140e]/45">Or pay with card</span>
        <span className="h-px flex-1 bg-[#1a140e]/12" />
      </div>

      <div onFocusCapture={markInteraction} onChangeCapture={markInteraction}>
        <PaymentElement
          options={{
            layout: "tabs",
            wallets: { applePay: "never", googlePay: "never", link: "never" },
          }}
        />
      </div>

      <button
        type="button"
        disabled={busy || confirmDisabled}
        onClick={() => void confirm()}
        className={
          payButtonClassName ??
          "h-14 min-h-[56px] w-full rounded-xl bg-[#1a140e] text-[16px] font-semibold text-white disabled:opacity-60"
        }
      >
        {busy ? busyLabel : buttonText}
      </button>

      {error ? (
        <p className="text-sm text-[#9a3412]" role="alert">
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
  returnUrl,
  payButtonLabel,
  busyLabel,
  loadingLabel,
  onBeforeConfirm,
  onReady,
  onPaymentInteraction,
  onInitError,
  confirmDisabled,
  appearanceTheme = "stripe",
  appearanceVariables,
  payButtonClassName,
}: {
  clientSecret: string;
  publishableKey: string;
  email?: string;
  dueDisplay: string;
  returnUrl: string;
  payButtonLabel?: (payLabel: string) => string;
  busyLabel?: string;
  loadingLabel?: string;
  onBeforeConfirm?: () => Promise<{ ok: boolean; error?: string; focusId?: string }>;
  onReady?: () => void;
  onPaymentInteraction?: () => void;
  onInitError?: (detail?: { initFailureCode?: string; stripeInstanceKeyFp?: string | null }) => void;
  confirmDisabled?: boolean;
  appearanceTheme?: "stripe" | "night";
  appearanceVariables?: Record<string, string>;
  payButtonClassName?: string;
}) {
  const [reloadNonce, setReloadNonce] = useState(0);
  const retriedRef = useRef(false);
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

  function handleInitError(detail?: { initFailureCode?: string; stripeInstanceKeyFp?: string | null }) {
    if (!retriedRef.current) {
      retriedRef.current = true;
      setReloadNonce((value) => value + 1);
      return;
    }
    onInitError?.(detail);
  }

  return (
    <CheckoutElementsProvider
      key={`${publishableKey}:${reloadNonce}:${clientSecret.includes("_secret_") ? "secret" : "invalid"}`}
      stripe={stripePromise}
      options={{
        clientSecret,
        defaultValues: email ? { email } : undefined,
        elementsOptions: {
          appearance: {
            theme: appearanceTheme,
            variables: appearanceVariables ?? {
              colorPrimary: "#1a140e",
              borderRadius: "12px",
            },
          },
        },
      }}
    >
      <CheckoutBody
        dueDisplay={dueDisplay}
        returnUrl={returnUrl}
        payButtonLabel={payButtonLabel}
        busyLabel={busyLabel}
        loadingLabel={loadingLabel}
        onBeforeConfirm={onBeforeConfirm}
        onReady={onReady}
        onPaymentInteraction={onPaymentInteraction}
        onInitError={handleInitError}
        confirmDisabled={confirmDisabled}
        payButtonClassName={payButtonClassName}
      />
    </CheckoutElementsProvider>
  );
}
