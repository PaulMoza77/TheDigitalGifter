import { Download, Gift, Heart, Upload } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    icon: Gift,
    title: "Choose the Moment",
    description:
      "Pick the occasion that matters — birthday, love, apology, family memory, pets, names, or something deeply personal.",
    color: "from-yellow-300 to-orange-400",
  },
  {
    icon: Upload,
    title: "Add Your Photo",
    description:
      "Upload the photo that carries the emotion. A smile, a memory, a face, a place, or someone you never want to forget.",
    color: "from-pink-400 to-rose-500",
  },
  {
    icon: Heart,
    title: "Make It Personal",
    description:
      "Add a name, message, date, or small detail that turns a simple image into something made only for them.",
    color: "from-purple-400 to-pink-500",
  },
  {
    icon: Download,
    title: "Send the Feeling",
    description:
      "Download your finished creation and share it as a gift, message, keepsake, or beautiful surprise.",
    color: "from-cyan-400 to-blue-500",
  },
];

export const HowItWorks = () => {
  return (
    <section className="w-full bg-gradient-to-b from-black via-slate-950/70 to-black px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="mx-auto mb-20 max-w-3xl text-center"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.25em] text-yellow-200">
            Simple to create
          </p>

          <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            From a small idea to a meaningful gift.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/60">
            Create something personal in just a few steps — no design skills,
            no stress, just a beautiful moment made for someone special.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              className="group relative"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.12, duration: 0.45 }}
            >
              {index < steps.length - 1 && (
                <div className="absolute left-full top-16 z-0 hidden h-px w-full bg-gradient-to-r from-white/20 to-transparent lg:block" />
              )}

              <div className="relative h-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-xl transition duration-300 hover:-translate-y-1 hover:border-yellow-300/35 hover:shadow-yellow-500/10">
                <div className="absolute -left-4 -top-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black text-lg font-black text-yellow-200 shadow-lg">
                  {index + 1}
                </div>

                <div
                  className={`mb-7 h-16 w-16 rounded-2xl bg-gradient-to-br ${step.color} p-0.5 transition duration-300 group-hover:scale-110`}
                >
                  <div className="flex h-full w-full items-center justify-center rounded-2xl bg-black">
                    <step.icon className="h-8 w-8 text-white" />
                  </div>
                </div>

                <h3 className="mb-3 text-xl font-black text-white">
                  {step.title}
                </h3>

                <p className="text-sm leading-7 text-white/55">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="mb-4 text-white/55">
            Ready to make someone smile?
          </p>

          <a
            href="/generator"
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-400 px-8 py-4 font-black text-black shadow-2xl shadow-yellow-500/20 transition hover:scale-[1.02]"
          >
            Start Creating
          </a>
        </div>
      </div>
    </section>
  );
};