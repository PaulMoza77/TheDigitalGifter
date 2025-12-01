import { Upload, Wand2, Sparkles, Download } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    icon: Wand2,
    title: "Choose Your Style",
    description:
      "Browse 100+ premium templates across Christmas, birthdays, weddings, and more special occasions.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Upload,
    title: "Upload Your Photos",
    description:
      "Add 1-4 photos. Our AI will intelligently match faces and compose the perfect card layout.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Sparkles,
    title: "AI Generates Magic",
    description:
      "In ~30 seconds, our AI creates a stunning personalized card or cinematic video with VEO3 technology.",
    color: "from-orange-500 to-amber-500",
  },
  {
    icon: Download,
    title: "Download & Share",
    description:
      "Get high-resolution cards ready for print or digital sharing. Unlimited downloads included.",
    color: "from-green-500 to-emerald-500",
  },
];

export const HowItWorks = () => {
  return (
    <section className="w-full py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-950/50 to-transparent">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-20 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white">
            How It Works
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Create professional AI cards in 4 simple steps. No design skills
            required.
          </p>
        </motion.div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              className="relative group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
            >
              {/* Connector line (desktop only) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-slate-700 to-transparent z-0" />
              )}

              <div className="relative bg-slate-900/50 border border-slate-800 rounded-2xl p-8 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 h-full">
                {/* Step number */}
                <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700 flex items-center justify-center text-xl font-bold text-blue-400">
                  {index + 1}
                </div>

                {/* Icon */}
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} p-0.5 mb-6 group-hover:scale-110 transition-transform duration-300`}
                >
                  <div className="w-full h-full rounded-2xl bg-slate-950 flex items-center justify-center">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold mb-3 text-white">
                  {step.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA below steps */}
        <div
          className="text-center mt-16 animate-fade-in"
          style={{ animationDelay: "0.6s" }}
        >
          <p className="text-slate-400 mb-4">
            Ready to create your first card?
          </p>
          <a
            href="/generator"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/50 transition-all hover:scale-105"
          >
            Start Creating Free
          </a>
        </div>
      </div>
    </section>
  );
};
