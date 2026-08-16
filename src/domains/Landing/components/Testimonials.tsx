import { Gift, Heart, Image, Sparkles } from "lucide-react";
import { productTruth } from "@/config/productTruth";

const useCases = [
  {
    icon: Gift,
    title: "Birthdays and celebrations",
    description:
      "Turn a favorite photo into a still image for a birthday, anniversary, or holiday.",
  },
  {
    icon: Heart,
    title: "Love notes and family moments",
    description:
      "Create a personalized image from a couple, family, or newborn photo.",
  },
  {
    icon: Image,
    title: "Apologies and thank-you notes",
    description:
      "Add a photo and a style when a simple message needs a visual keepsake.",
  },
  {
    icon: Sparkles,
    title: "Faith, pets, and names",
    description:
      "Browse spiritual, pet, and personal templates, then generate a still image from your upload.",
  },
];

export const Testimonials = () => {
  return (
    <section className="w-full bg-gradient-to-b from-black via-slate-950/70 to-black px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-pink-400/25 bg-pink-400/10 px-4 py-2 text-sm font-bold text-pink-200">
            <Heart className="h-4 w-4" />
            What you can create
          </div>

          <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Made for gifts that feel personal.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/60">
            {productTruth.brandName} turns one photo and a selected style into a
            personalized still image. Choose the occasion, then follow the
            steps.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {useCases.map((useCase) => (
            <div
              key={useCase.title}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-xl"
            >
              <useCase.icon className="mb-5 h-8 w-8 text-yellow-300" />
              <h3 className="mb-3 text-xl font-black text-white">
                {useCase.title}
              </h3>
              <p className="text-base leading-7 text-white/75">
                {useCase.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
