import { LegalDocument } from "@/pages/website/LegalDocument";

export function RefundPolicyPage() {
  return (
    <LegalDocument
      title="Refund Policy"
      description="When TheDigitalGifter refunds the €4.99 still-image purchase."
      updated="13 August 2026"
      notice="This policy replaces the old 48-hour unused-credit rule and the 14-day credit-pack rule. Those cannot coexist with immediate digital-content supply."
      sections={[
        {
          id: "product",
          title: "1. What you buy",
          paragraphs: [
            "€4.99 EUR for one still image, including one regeneration if the first result is not usable. No subscriptions and no credit balance.",
          ],
        },
        {
          id: "withdrawal",
          title: "2. Withdrawal for digital content",
          paragraphs: [
            "EU consumers normally have 14 days to withdraw from a distance contract. Because this is digital content created on demand, we ask you at checkout to request immediate supply and to acknowledge that the withdrawal right is lost once generation starts after confirmed payment.",
            "If you abandon Checkout, no payment is taken. If you pay but generation has not started, contact support and we will refund.",
          ],
        },
        {
          id: "when",
          title: "3. When we refund",
          paragraphs: [
            "We refund if payment is confirmed but we cannot deliver a result after retries, if Stripe charged you twice, or if there is confirmed unauthorised payment.",
            "We do not refund because you dislike a technically delivered image after the included regeneration has been used. Support can still review exceptional cases.",
          ],
        },
        {
          id: "how",
          title: "4. How to ask",
          paragraphs: [
            "Email support@thedigitalgifter.com with your order email and Stripe receipt. We usually reply within 1–2 business days. Approved refunds go back to the original payment method through Stripe.",
          ],
        },
      ]}
    />
  );
}
