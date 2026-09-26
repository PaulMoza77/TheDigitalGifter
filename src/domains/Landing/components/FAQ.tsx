import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion, useReducedMotion } from "framer-motion";
import {
  landingBodyClass,
  landingSectionClass,
  landingSectionHeadingClass,
  landingTertiaryLinkClass,
} from "@/domains/Landing/landingStyles";

const faqs = [
  {
    question: "How does the credit system work?",
    answer:
      "Each AI card generation costs upto 10 credit. Video generations cost 12 credits without audio and with audio it will be 24. Credits are purchased in packs and never expire. You only pay for what you actually use, with no monthly commitments required.",
  },
  {
    question: "How does AI handle my photos?",
    answer:
      "Our advanced AI uses face detection and composition algorithms to perfectly position your photos within the chosen template. The AI preserves facial features while seamlessly blending them into the design. All photos are processed securely and automatically deleted after generation.",
  },
  {
    question: "How fast is video generation?",
    answer:
      "AI card generation takes approximately 30 seconds. Video generation using Google VEO3.1 technology typically completes in under 2 minutes. Processing time may vary slightly based on server load and complexity.",
  },
  {
    question: "What about privacy and data security?",
    answer:
      "We take privacy seriously. Your photos are encrypted during upload, processed securely, and automatically deleted from our servers immediately after generation. We never store, share, or use your photos for any other purpose. Read our full privacy policy for details.",
  },
  {
    question: "What event categories do you support?",
    answer:
      "We support 14+ categories including Christmas, New Year's Eve, Birthday, Wedding, Baby Reveal, Pregnancy, Easter, Valentine's Day, Anniversary, Mother's Day, Father's Day, Graduation, Thanksgiving, and more. New categories are added regularly based on user requests.",
  },
  {
    question: "Can I use the cards commercially?",
    answer:
      "Creator and Pro plans include commercial use licenses, allowing you to use generated cards for business purposes, client work, and resale. Starter plan is for personal use only. Check our terms of service for full details.",
  },
  {
    question: "What's the resolution and print quality?",
    answer:
      "All cards are generated at 300 DPI (dots per inch), which is professional print quality. Downloads are available in high-resolution PNG and JPG formats, suitable for both digital sharing and professional printing services.",
  },
  {
    question: "Do I need design skills?",
    answer:
      "No design skills required! Simply choose a template, upload your photo(s), and let our AI do all the work. The system automatically handles composition, lighting adjustments, and perfect positioning.",
  },
];

export const FAQ = () => {
  const reduceMotion = useReducedMotion();

  return (
    <section
      className={`${landingSectionClass} border-t border-[var(--tdg-home-border)] py-12 sm:py-16`}
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-3xl">
        <motion.div
          className="mb-10 space-y-3 text-center"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <h2 id="faq-heading" className={landingSectionHeadingClass}>
            Questions
          </h2>
          <p className={landingBodyClass}>
            Credits, privacy, quality, and how creation works.
          </p>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="rounded-xl border border-[var(--tdg-home-border)] bg-[var(--tdg-home-surface)] px-5 transition-colors data-[state=open]:border-[var(--tdg-home-accent)]/40"
              >
                <AccordionTrigger className="py-5 text-left text-base font-medium text-[var(--tdg-home-text)] hover:text-[var(--tdg-home-accent)] hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-[var(--tdg-home-text-muted)]">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        <div className="mt-10 text-center">
          <p className="mb-3 text-sm text-[var(--tdg-home-text-muted)]">
            Still have questions?
          </p>
          <a
            href="mailto:support@thedigitalgifter.com"
            className={landingTertiaryLinkClass}
          >
            Contact support
          </a>
        </div>
      </div>
    </section>
  );
};
