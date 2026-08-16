import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PET_FAQS } from "../catalog";

export function PetFaq() {
  return (
    <section aria-labelledby="pet-faq-heading" className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.22em] text-[#d4a84b]">Questions</p>
        <h2 id="pet-faq-heading" className="mt-2 text-3xl font-semibold tracking-tight text-[#f6efe4]">
          Before you gift this
        </h2>
      </div>
      <Accordion
        type="single"
        collapsible
        className="rounded-3xl border border-[#f6efe4]/10 bg-[#1a1410]/70 px-5"
      >
        {PET_FAQS.map((faq, index) => (
          <AccordionItem
            key={faq.question}
            value={`faq-${index}`}
            className="border-[#f6efe4]/10"
          >
            <AccordionTrigger className="text-left text-base text-[#f6efe4] hover:no-underline">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-6 text-[#f6efe4]/72">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
