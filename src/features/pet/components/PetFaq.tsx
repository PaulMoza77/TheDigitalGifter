import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PET_FAQS } from "../catalog";

export function PetFaq() {
  return (
    <section aria-labelledby="pet-faq-heading">
      <h2 id="pet-faq-heading" className="text-2xl font-semibold tracking-tight text-[#f6efe4] sm:text-3xl">
        FAQ
      </h2>
      <Accordion type="single" collapsible className="mt-4 border-t border-[#f6efe4]/10">
        {PET_FAQS.map((faq, index) => (
          <AccordionItem key={faq.question} value={`faq-${index}`} className="border-[#f6efe4]/10">
            <AccordionTrigger className="text-left text-base text-[#f6efe4] hover:no-underline">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-6 text-[#f6efe4]/68">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
