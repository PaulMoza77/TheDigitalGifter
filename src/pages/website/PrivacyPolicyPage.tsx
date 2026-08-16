import { LegalDocument } from "@/pages/website/LegalDocument";

export function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      description="How TheDigitalGifter handles photos, payment data, and account information."
      updated="13 August 2026"
      notice="Operational draft for the launch product. Counsel should review processor agreements, AI Act role, and VAT/OSS data before live checkout."
      sections={[
        {
          id: "what",
          title: "1. What we collect",
          paragraphs: [
            "Email address, the photo you upload, style/template choice, order and payment status, generated image, support messages, and technical logs needed to run the service.",
            "Stripe processes card data. We do not store full card numbers. We store Stripe session and payment identifiers needed for fulfilment, refunds, and accounting.",
          ],
        },
        {
          id: "why",
          title: "2. Why we use it",
          paragraphs: [
            "To take payment, generate the still image, email the result, provide support, prevent fraud and duplicate generation, delete files on the retention schedule, and meet legal duties (tax, consumer, and AI transparency).",
            "We do not sell personal data. We do not use uploaded photos to train a public model of our own.",
          ],
        },
        {
          id: "processors",
          title: "3. Processors",
          paragraphs: [
            "Stripe (payments), Supabase (database, auth, and private storage), Replicate / Google nano-banana (image generation), Vercel (hosting), and email delivery if configured. Analytics processors (Google Analytics 4 and Meta Pixel) run only after cookie consent.",
          ],
        },
        {
          id: "retention",
          title: "4. Retention and deletion",
          paragraphs: [
            "Uploaded photos: 24 hours, then deleted from private storage. Generated results: 30 days, then deleted. You can also email support@thedigitalgifter.com to request deletion of your account and remaining files.",
            "Payment records needed for accounting may be kept longer as required by law.",
          ],
        },
        {
          id: "rights",
          title: "5. Your rights",
          paragraphs: [
            "If GDPR applies, you can request access, correction, deletion, restriction, objection, and portability. Contact support@thedigitalgifter.com. You may also complain to your local data protection authority.",
          ],
        },
        {
          id: "cookies",
          title: "6. Cookies",
          paragraphs: [
            "Essential cookies and storage run the funnel and checkout. Non-essential analytics and advertising cookies are blocked until you accept them. See the Cookie Policy.",
          ],
        },
      ]}
    />
  );
}
