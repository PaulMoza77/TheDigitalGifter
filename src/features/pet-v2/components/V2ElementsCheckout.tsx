/**
 * Pet V2 Stripe Elements checkout — Express wallets + card fallback.
 * Uses official loadStripe() + CheckoutElementsProvider.
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
import {
  CARD_PAY_INCOMPLETE_MESSAGE,
  isExpressCheckoutConfirmEvent,
  resolveExpressCheckoutClick,
} from "../../pet/expressCheckoutConfirm";
import { ApplePayButton } from "../../pet/components/ApplePayButton";
import { PET_EXPRESS_CHECKOUT_OPTIONS } from "../../pet/expressCheckoutOptions";
import { v2PayButtonLabel } from "../v2CheckoutHold";

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
  onExpressCancel,
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
  onExpressCancel?: () => void;
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
    console.info("[v2-elements-init]", { initFailureCode, checkoutProviderState: checkoutState.type });
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
      console.info("[v2-elements-email-sync]", {
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

    // Card-only gate — never block Express; Apple Pay requires immediate checkout.confirm().
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

    // Express: start confirm() in this tick. Await email / setState first and
    // Apple Pay never opens (lost user-gesture + Stripe 1s click window).
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
      const result = await (confirmPromise ??
        checkoutState.checkout.confirm({ redirect: "if_required" }));
      if (result.type === "error") {
        if (isExpress) failExpressCheckout(expressCheckoutConfirmEvent);
        const message = sanitizeStripeCheckoutCustomerError(result.error.message);
        console.info("[v2-elements-confirm]", { failureCode: result.error.code || "confirm_failed" });
        if (message) setError(message);
        return;
      }
      // Best-effort contact sync after wallet success (debounced save may have missed).
      void onBeforeConfirm?.().catch(() => undefined);
      const confirmedId =
        result.type === "success" && result.session?.id
          ? String(result.session.id)
          : sessionId;
      window.location.assign(
        `/pet/order?token=${encodeURIComponent(publicToken)}&session_id=${encodeURIComponent(confirmedId)}`,
      );
    } catch (caught) {
      if (isExpress) failExpressCheckout(expressCheckoutConfirmEvent);
      const message = sanitizeStripeCheckoutCustomerError(caught instanceof Error ? caught.message : undefined);
      console.info("[v2-elements-confirm]", {
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
  const labelFn = payButtonLabel ?? v2PayButtonLabel;
  const buttonText = labelFn(payLabel);

  return (
    <div className="space-y-4">
      <ExpressCheckoutElement
        options={PET_EXPRESS_CHECKOUT_OPTIONS}
        onConfirm={(event) => void confirm(event)}
        onClick={(event) => resolveExpressCheckoutClick(event, markInteraction)}
        onCancel={() => {
          setError(null);
          onExpressCancel?.();
        }}
      />

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

export function V2ElementsCheckout({
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
  onExpressCancel,
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
  onExpressCancel?: () => void;
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
        onExpressCancel={onExpressCancel}
        confirmDisabled={confirmDisabled}
        payButtonClassName={payButtonClassName}
      />
    </CheckoutElementsProvider>
  );
}
