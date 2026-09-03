/** Neutral loading placeholder — never looks like a real Apple Pay button. */
export function ExpressWalletSkeleton() {
  return (
    <div
      className="h-[55px] w-full animate-pulse rounded-[6px] bg-[#808080]/30"
      aria-hidden="true"
    />
  );
}
