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
  resolveExpressCheckoutClick,
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
  confirmDisabled,
  payButtonClassName,
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
  confirmDisabled?: boolean;
  payButtonClassName?: string;
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
    const confirmPromise = isExpress
      ? checkoutState.checkout.confirm({
          expressCheckoutConfirmEvent,
          redirect: "if_required",
        })
      : null;
    setBusy(true);
    setError(null);
    try {
      if (!isExpress) {
        await syncCheckoutEmail(checkoutState.checkout);
      }
      const result = await (confirmPromise ?? checkoutState.checkout.confirm({}));
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

  if (checkoutState.type === "loading") {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <ApplePayButton disabled />
        <p className="text-center text-sm text-[#1a140e]/55">{loadingLabel}</p>
      </div>
    );
  }

  if (checkoutState.type === "error") {
    // When parent owns recovery, do not offer a Stripe-only retry that reloads the same invalid secret.
    if (onRecoverCheckout) {
      return (
        <div className="space-y-3 py-2">
          <p className="text-sm text-[#9a3412]" role="alert">
            {stripeCheckoutInitCustomerError(checkoutState.error.message)}
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-3 py-2">
        <p className="text-sm text-[#9a3412]" role="alert">
          {stripeCheckoutInitCustomerError(checkoutState.error.message)}
        </p>
        <button
          type="button"
          onClick={() => {
            initErrorHandled.current = false;
            onReloadCheckout?.();
          }}
          className="h-11 w-full rounded-full border border-[#f6efe4]/20 bg-transparent text-sm text-[#f6efe4]"
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
      <ExpressCheckoutElement
        options={{ ...PET_EXPRESS_CHECKOUT_OPTIONS, layout: { maxColumns: 1, maxRows: 2, overflow: "never" as const } }}
        onConfirm={(event) => void confirm(event)}
        onClick={(event) => resolveExpressCheckoutClick(event, markInteraction)}
        onCancel={() => setError(null)}
      />

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
  payButtonLabel,
  busyLabel,
  loadingLabel,
  onBeforeConfirm,
  onReady,
  onPaymentInteraction,
  onInitError,
  onRecoverCheckout,
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
        confirmDisabled={confirmDisabled}
        payButtonClassName={payButtonClassName}
      />
    </CheckoutElementsProvider>
  );
}
