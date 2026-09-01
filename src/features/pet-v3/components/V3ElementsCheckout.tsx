/**
 * Cat V3 Stripe Elements checkout — Minutes Guides architecture.
 * Uses official loadStripe() + CheckoutElementsProvider. Does NOT use stripeLoader /
 * Dahlia script injection / window.Stripe mutation.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { sanitizeStripeCheckoutCustomerError, stripeCheckoutInitCustomerError } from "../../pet/funnelGuards";
import { ApplePayButton } from "../../pet/components/ApplePayButton";

const EXPRESS_OPTIONS = {
  buttonHeight: 55,
  buttonTheme: { applePay: "black" as const, googlePay: "black" as const },
  buttonType: { applePay: "buy" as const, googlePay: "buy" as const },
  layout: { maxColumns: 1, maxRows: 4 },
  paymentMethodOrder: ["applePay", "googlePay"],
  paymentMethods: {
    applePay: "always" as const,
    googlePay: "always" as const,
    link: "never" as const,
    paypal: "never" as const,
    amazonPay: "never" as const,
    klarna: "never" as const,
  },
};

const ELEMENTS_INIT_TIMEOUT_MS = 18_000;

function normalizeClientSecret(clientSecret: string): string {
  const value = String(clientSecret || "").trim();
  if (!value.includes("%")) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function CheckoutBody({
  dueDisplay,
  email,
  publicToken,
  sessionId,
  payButtonLabel,
  busyLabel = "Processing secure payment…",
  loadingLabel = "Loading secure payment…",
  onBeforeConfirm,
  onReady,
  onPaymentInteraction,
  onInitError,
  confirmDisabled,
  payButtonClassName,
}: {
  dueDisplay: string;
  email?: string;
  publicToken: string;
  sessionId: string;
  payButtonLabel?: (payLabel: string) => string;
  busyLabel?: string;
  loadingLabel?: string;
  onBeforeConfirm?: () => Promise<{ ok: boolean; error?: string; focusId?: string }>;
  onReady?: () => void;
  onPaymentInteraction?: () => void;
  onInitError?: (detail?: { initFailureCode?: string }) => void;
  confirmDisabled?: boolean;
  payButtonClassName?: string;
}) {
  const checkoutState = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [applePayFromStripe, setApplePayFromStripe] = useState(false);
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
    console.info("[v3-elements-init]", { initFailureCode, checkoutProviderState: checkoutState.type });
    onInitError?.({ initFailureCode });
  }, [checkoutState.type, checkoutState, onInitError]);

  useEffect(() => {
    if (checkoutState.type !== "loading") return;
    const timer = window.setTimeout(() => {
      if (readyFired.current || initErrorHandled.current) return;
      initErrorHandled.current = true;
      onInitError?.({ initFailureCode: "elements_init_timeout" });
    }, ELEMENTS_INIT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [checkoutState.type, onInitError]);

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
      console.info("[v3-elements-email-sync]", {
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
    if (onBeforeConfirm) {
      try {
        const gate = await onBeforeConfirm();
        if (!gate.ok) {
          failExpressCheckout(expressCheckoutConfirmEvent);
          setError(gate.error || "Complete the form before paying.");
          if (gate.focusId) {
            document.getElementById(gate.focusId)?.focus();
            document.getElementById(gate.focusId)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }
      } catch (caught) {
        failExpressCheckout(expressCheckoutConfirmEvent);
        const message =
          caught instanceof Error && caught.message.trim()
            ? caught.message.trim()
            : "Could not save your details. Try again.";
        setError(message);
        return;
      }
    }
    if (!expressCheckoutConfirmEvent && !paymentComplete) {
      setError("Enter your full card details before paying.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await syncCheckoutEmail(checkoutState.checkout);
      // Server Session return_url is SoT — do not pass a client returnUrl.
      const result = await checkoutState.checkout.confirm(
        expressCheckoutConfirmEvent
          ? { expressCheckoutConfirmEvent, redirect: "if_required" }
          : { redirect: "if_required" },
      );
      if (result.type === "error") {
        const message = sanitizeStripeCheckoutCustomerError(result.error.message);
        console.info("[v3-elements-confirm]", { failureCode: result.error.code || "confirm_failed" });
        if (message) setError(message);
        return;
      }
      const confirmedId =
        result.type === "success" && result.session?.id
          ? String(result.session.id)
          : sessionId;
      window.location.assign(
        `/pet/order?token=${encodeURIComponent(publicToken)}&session_id=${encodeURIComponent(confirmedId)}`,
      );
    } catch (caught) {
      const message = sanitizeStripeCheckoutCustomerError(caught instanceof Error ? caught.message : undefined);
      console.info("[v3-elements-confirm]", {
        failureCode: caught instanceof Error ? caught.name : "confirm_exception",
      });
      if (message) setError(message);
    } finally {
      setBusy(false);
    }
  }

  if (checkoutState.type === "loading") {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <ApplePayButton disabled />
        <p className="text-center text-sm text-[#f6efe4]/55">{loadingLabel}</p>
      </div>
    );
  }

  if (checkoutState.type === "error") {
    return (
      <div className="space-y-3 py-2">
        <p className="text-sm text-[#9a3412]" role="alert">
          {stripeCheckoutInitCustomerError(checkoutState.error.message)}
        </p>
      </div>
    );
  }

  const payLabel = dueDisplay.replace(" USD", "");
  const buttonText = payButtonLabel ? payButtonLabel(payLabel) : `Pay ${payLabel}`;

  return (
    <div className="space-y-4">
      <ExpressCheckoutElement
        options={EXPRESS_OPTIONS}
        onReady={(event) => {
          // Wallet availability is not Begin Checkout.
          setApplePayFromStripe(Boolean(event.availablePaymentMethods?.applePay));
        }}
        onConfirm={(event) => void confirm(event)}
        onClick={markInteraction}
        onCancel={() => setError(null)}
      />
      {applePayFromStripe ? null : <ApplePayButton disabled={busy || confirmDisabled} />}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[#f6efe4]/12" />
        <span className="text-[12px] text-[#f6efe4]/45">Or pay with card</span>
        <span className="h-px flex-1 bg-[#f6efe4]/12" />
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
        className={
          payButtonClassName ??
          "h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] disabled:opacity-40"
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

export function V3ElementsCheckout({
  clientSecret,
  publishableKey,
  email,
  publicToken,
  sessionId,
  dueDisplay,
  payButtonLabel,
  busyLabel,
  loadingLabel,
  onBeforeConfirm,
  onReady,
  onPaymentInteraction,
  onInitError,
  confirmDisabled,
  appearanceVariables,
  payButtonClassName,
}: {
  clientSecret: string;
  publishableKey: string;
  email?: string;
  publicToken: string;
  sessionId: string;
  dueDisplay: string;
  payButtonLabel?: (payLabel: string) => string;
  busyLabel?: string;
  loadingLabel?: string;
  onBeforeConfirm?: () => Promise<{ ok: boolean; error?: string; focusId?: string }>;
  onReady?: () => void;
  onPaymentInteraction?: () => void;
  onInitError?: (detail?: { initFailureCode?: string }) => void;
  confirmDisabled?: boolean;
  appearanceVariables?: Record<string, string>;
  payButtonClassName?: string;
}) {
  const normalizedClientSecret = useMemo(() => normalizeClientSecret(clientSecret), [clientSecret]);
  const stripePromise = useMemo(() => {
    const key = String(publishableKey || "").trim();
    if (!key.startsWith("pk_")) return Promise.resolve(null);
    return loadStripe(key);
  }, [publishableKey]);

  useEffect(() => {
    let cancelled = false;
    void stripePromise.then((stripe) => {
      if (cancelled) return;
      if (!stripe) {
        onInitError?.({ initFailureCode: "stripe_js_load_failed" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [stripePromise, onInitError]);

  return (
    <CheckoutElementsProvider
      key={`${publishableKey}:${normalizedClientSecret.includes("_secret_") ? "secret" : "invalid"}`}
      stripe={stripePromise}
      options={{
        clientSecret: normalizedClientSecret,
        defaultValues: email ? { email } : undefined,
        elementsOptions: {
          appearance: {
            theme: "night",
            variables: appearanceVariables ?? {
              colorPrimary: "#d4a84b",
              colorBackground: "#1a1410",
              colorText: "#f6efe4",
              colorDanger: "#9a3412",
              borderRadius: "16px",
              fontFamily: "system-ui, sans-serif",
            },
          },
        },
      }}
    >
      <CheckoutBody
        dueDisplay={dueDisplay}
        email={email}
        publicToken={publicToken}
        sessionId={sessionId}
        payButtonLabel={payButtonLabel}
        busyLabel={busyLabel}
        loadingLabel={loadingLabel}
        onBeforeConfirm={onBeforeConfirm}
        onReady={onReady}
        onPaymentInteraction={onPaymentInteraction}
        onInitError={onInitError}
        confirmDisabled={confirmDisabled}
        payButtonClassName={payButtonClassName}
      />
    </CheckoutElementsProvider>
  );
}
