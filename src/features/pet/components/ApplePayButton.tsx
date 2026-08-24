export function ApplePayButton({
  onClick,
  disabled,
}: {
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label="Buy with Apple Pay"
      disabled={disabled}
      onClick={onClick}
      className="tdg-apple-pay disabled:opacity-50"
    >
      <span className="tdg-apple-pay-label">
        Buy with
        <svg viewBox="0 0 16 20" aria-hidden="true" className="h-[18px] w-[14px] fill-current">
          <path d="M13.07 10.51c-.02-2.16 1.76-3.2 1.84-3.25-1.01-1.47-2.57-1.67-3.12-1.69-1.32-.14-2.59.78-3.26.78-.68 0-1.72-.76-2.84-.74-1.46.02-2.81.85-3.56 2.16-1.53 2.65-.39 6.56 1.08 8.71.73 1.05 1.59 2.23 2.72 2.19 1.1-.05 1.51-.7 2.84-.7 1.32 0 1.69.7 2.84.68 1.18-.02 1.92-1.07 2.63-2.13.84-1.21 1.18-2.39 1.2-2.45-.03-.01-2.29-.88-2.31-3.48zM10.9 3.68c.6-.73 1-1.74.89-2.75-.86.04-1.9.57-2.51 1.29-.55.64-1.03 1.67-.9 2.65.95.07 1.92-.48 2.52-1.19z" />
        </svg>
        Pay
      </span>
    </button>
  );
}
