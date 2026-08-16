import { Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { productTruth, isCheckoutEnabled } from "@/config/productTruth";
import { productModel } from "@/config/productModel";

const features = [
  "One AI-generated still image",
  "One included regeneration if needed",
  "Personal use",
  `Support in ${productTruth.copy.supportResponseTime}`,
];

export const PricingCTA = () => {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
            <Sparkles className="h-4 w-4 text-[#ffd976]" />
            Launch price
          </div>
          <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            One image. {productModel.displayPrice}.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/60">
            No subscriptions, no credit packs, no Enterprise add-ons. EUR only.
          </p>
        </motion.div>

        <div className="mx-auto mt-12 max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-left">
          <div className="text-center">
            <h3 className="text-2xl font-black text-white">{productModel.name}</h3>
            <div className="mt-4 text-5xl font-black text-[#ffd976]">
              {productModel.displayPrice}
            </div>
            <p className="mt-2 text-sm text-white/45">one-time · EUR · VAT may apply</p>
          </div>
          <ul className="mt-8 space-y-4">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-400" />
                <span className="text-sm text-white/70">{feature}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/funnel/uploadPhoto"
            className="mt-8 block w-full rounded-2xl bg-[#ffd976] py-4 text-center text-base font-black text-[#0b1220]"
          >
            {isCheckoutEnabled() ? "Create your image" : "Start with a photo"}
          </Link>
          {!isCheckoutEnabled() ? (
            <p className="mt-4 text-center text-sm text-white/50">
              {productTruth.copy.checkoutUnavailable}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
};
