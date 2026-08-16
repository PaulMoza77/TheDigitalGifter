import { LegalDocument } from "@/pages/website/LegalDocument";

export function CookiePolicyPage() {
  return (
    <LegalDocument
      title="Cookie Policy"
      description="Essential vs analytics cookies on TheDigitalGifter."
      updated="13 August 2026"
      notice="Google Analytics 4 and Meta Pixel are blocked until you accept non-essential cookies."
      sections={[
        {
          id: "essential",
          title: "1. Essential",
          paragraphs: [
            "We use essential cookies and local storage to keep your uploaded-photo session, checkout state, and cookie choice. These are needed to provide the service you requested.",
          ],
        },
        {
          id: "analytics",
          title: "2. Analytics and advertising",
          paragraphs: [
            "Google Analytics 4 (G-6FVX69WYFG) and Meta Pixel (1673980440653322) measure visits and ads. They are off by default (consent denied) and load only if you click Accept analytics cookies.",
            "Rejecting them does not block checkout or image delivery.",
          ],
        },
        {
          id: "change",
          title: "3. Change your choice",
          paragraphs: [
            "Clear site data for thedigitalgifter.com or email support@thedigitalgifter.com. A future settings control can be added without changing this policy’s default-denied rule.",
          ],
        },
      ]}
    />
  );
}
