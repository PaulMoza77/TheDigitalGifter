import { useMemo, useState, useEffect, useRef } from "react";
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { loadStripe, type StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
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
  confirmDisabled?: boolean;
  payButtonClassName?: string;
}) {
  const checkoutState = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applePayFromStripe, setApplePayFromStripe] = useState(false);
  const readyFired = useRef(false);
  const interactionFired = useRef(false);

  useEffect(() => {
    if (checkoutState.type === "success" && !readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
  }, [checkoutState.type, onReady]);

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
        setError(result.error.message);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment failed. No extra charge was created.");
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
      <p className="text-sm text-[#9a3412]" role="alert">
        {checkoutState.error.message}
      </p>
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
  confirmDisabled?: boolean;
  appearanceTheme?: "stripe" | "night";
  appearanceVariables?: Record<string, string>;
  payButtonClassName?: string;
}) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  return (
    <CheckoutElementsProvider
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
        confirmDisabled={confirmDisabled}
        payButtonClassName={payButtonClassName}
      />
    </CheckoutElementsProvider>
  );
}
