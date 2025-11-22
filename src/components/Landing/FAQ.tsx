import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";

const faqs = [
  {
    question: "How does the credit system work?",
    answer:
      "Each AI card generation costs 1 credit. Video generations cost 5 credits. Credits are purchased in packs and never expire. You only pay for what you actually use, with no monthly commitments required.",
  },
  {
    question: "How does AI handle my photos?",
    answer:
      "Our advanced AI uses face detection and composition algorithms to perfectly position your photos within the chosen template. The AI preserves facial features while seamlessly blending them into the design. All photos are processed securely and automatically deleted after generation.",
  },
  {
    question: "How fast is video generation?",
    answer:
      "AI card generation takes approximately 30 seconds. Video generation using Google VEO3 technology typically completes in under 2 minutes. Processing time may vary slightly based on server load and complexity.",
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
  return (
    <section className="w-full py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-950/50 to-transparent">
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-16 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white">
            Frequently Asked{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Questions
            </span>
          </h2>
          <p className="text-xl text-slate-400">
            Everything you need to know about TheDigitalGifter
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 hover:border-blue-500/50 transition-colors"
              >
                <AccordionTrigger className="text-left text-white hover:text-blue-400 py-6">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-400 pb-6 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* Still have questions CTA */}
        <div
          className="text-center mt-16 animate-fade-in"
          style={{ animationDelay: "0.3s" }}
        >
          <p className="text-slate-400 mb-4">Still have questions?</p>
          <a
            href="mailto:support@thedigitalgifter.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </section>
  );
};
