import { useEffect, useState } from "react";

export function ApplePayButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    try {
      setAvailable(
        typeof window !== "undefined" &&
          "ApplePaySession" in window &&
          Boolean((window as Window & { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession?.canMakePayments?.()),
      );
    } catch {
      setAvailable(false);
    }
  }, []);

  if (!available) return null;

  return (
    <button
      type="button"
      aria-label="Pay with Apple Pay"
      disabled={disabled}
      onClick={onClick}
      className="tdg-apple-pay h-14 min-h-[56px] w-full rounded-2xl disabled:opacity-50"
    />
  );
}
