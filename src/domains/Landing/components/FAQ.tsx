import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { productTruth } from "@/config/productTruth";

const faqs = [
  {
    question: "How does the credit system work?",
    answer:
      "Credits are used when you generate. The amount required is shown on each template before you generate.",
  },
  {
    question: "How are my photos used?",
    answer: productTruth.copy.photoHandling,
  },
  {
    question: "What can I create?",
    answer:
      "You can create a personalized still image from an uploaded photo and a selected style. Choose an occasion and pick a template. Payment and image delivery are still being verified.",
  },
  {
    question: "What event categories do you support?",
    answer:
      "Available occasions include Christmas, New Year's Eve, Birthday, Wedding, Baby Reveal, Pregnancy, Easter, Valentine's Day, Anniversary, Mother's Day, Father's Day, Graduation, and Thanksgiving, plus personal, spiritual, and pet templates in the gallery.",
  },
  {
    question: "Do I need design skills?",
    answer:
      "No design skills are required. Choose a template, upload your photo, and generate the still image.",
  },
  {
    question: "How do I contact support?",
    answer: `Email ${productTruth.supportEmail}. ${productTruth.copy.supportResponseSentence}`,
  },
];

export const FAQ = () => {
  return (
    <section className="w-full py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-950/50 to-transparent">
      <div className="max-w-4xl mx-auto">
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
            Everything you need to know about {productTruth.brandName}
          </p>
        </motion.div>

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

        <div
          className="text-center mt-16 animate-fade-in"
          style={{ animationDelay: "0.3s" }}
        >
          <p className="text-slate-400 mb-4">Still have questions?</p>
          <a
            href={`mailto:${productTruth.supportEmail}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </section>
  );
};
