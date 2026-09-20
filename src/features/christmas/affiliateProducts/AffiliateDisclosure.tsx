export const AFFILIATE_DISCLOSURE =
  "Some product links are affiliate links. We may earn a commission at no extra cost to you.";

export function AffiliateDisclosure({ className }: { className?: string }) {
  return <p className={className || "tdg-aff-disclose"}>{AFFILIATE_DISCLOSURE}</p>;
}
