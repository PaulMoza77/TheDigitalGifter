import { LegalDocument } from "@/pages/website/LegalDocument";

const NOTICE =
  "This is an operational draft aligned to the launch product (€4.99 still image, personal use). It is not a substitute for legal review before public checkout is enabled.";

export function TermsPage() {
  return (
    <LegalDocument
      title="Terms and Conditions"
      description="Terms for buying one personalized still image from TheDigitalGifter."
      updated="13 August 2026"
      notice={NOTICE}
      sections={[
        {
          id: "who",
          title: "1. Who we are",
          paragraphs: [
            "These terms apply to TheDigitalGifter (thedigitalgifter.com). Support: support@thedigitalgifter.com, usually within 1–2 business days.",
            "The launch product is a single still image generated from a photo you upload. There are no subscriptions, credit packs, Enterprise plans, or add-ons in this version.",
          ],
        },
        {
          id: "age",
          title: "2. Age limit",
          paragraphs: [
            "You must be at least 18 years old to buy or use the service. Do not upload photos of children unless you are the parent or legal guardian and the use is lawful.",
          ],
        },
        {
          id: "product",
          title: "3. The product",
          paragraphs: [
            "You pay €4.99 (EUR) plus any VAT shown at Stripe Checkout for one AI-generated still image. The price includes one regeneration if the first result is not usable.",
            "Output is a still image. Video generation is not offered. Licence is personal use only until a commercial licence is published.",
            "Results are AI-generated. Likeness, lighting, and details can differ from the uploaded photo. We mark results as AI-generated.",
          ],
        },
        {
          id: "photos",
          title: "4. Photos you upload",
          paragraphs: [
            "You must own the photo or have permission from every identifiable person. Do not upload illegal, sexual, violent, or infringing content.",
            "You grant us a limited licence to store, process, and transmit the photo to our processors (currently Stripe, Supabase, Replicate, and Vercel) solely to take payment and create the image you ordered.",
          ],
        },
        {
          id: "digital",
          title: "5. Immediate digital content and withdrawal",
          paragraphs: [
            "This is digital content supplied immediately after payment is confirmed. EU consumer law normally gives a 14-day withdrawal right for distance contracts.",
            "At checkout you must tick a consent box asking for immediate supply. Once generation starts after a confirmed payment, that withdrawal right is lost for the supplied image. The 14-day right and a 48-hour unused-credit window do not both apply; this product has no credits.",
            "If payment is confirmed but no usable image can be delivered after retries, you can request a refund. See the Refund Policy.",
          ],
        },
        {
          id: "payment",
          title: "6. Payment, VAT, and fulfilment",
          paragraphs: [
            "Payment is taken by Stripe. We create a pending order and generation before Checkout. Fulfilment starts only after the Stripe webhook confirms payment. The browser redirect does not start generation.",
            "Prices are in EUR. For B2C sales in the EU, VAT may be added at checkout where required. OSS registration and invoicing must be confirmed with an accountant before live sales.",
          ],
        },
        {
          id: "ai-act",
          title: "7. AI transparency",
          paragraphs: [
            "Article 50 of the EU AI Act transparency obligations apply from 2 August 2026. We disclose that outputs are AI-generated. Whether TheDigitalGifter is a provider, a deployer, or both, and how machine-readable marking must be implemented, still needs legal confirmation before launch.",
          ],
        },
        {
          id: "liability",
          title: "8. Liability",
          paragraphs: [
            "We do not guarantee a specific artistic result. We are responsible for delivering one image or a recoverable paid state, not for how you use the image. Nothing in these terms limits liability that cannot be limited under applicable law.",
          ],
        },
      ]}
    />
  );
}
