import { Download, Heart, Image, Lock, Palette, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Heart,
    title: "Made to Feel Personal",
    description:
      "Add names, faces, messages, dates, and small details that make every creation feel made only for one person.",
    gradient: "from-pink-400 to-rose-500",
  },
  {
    icon: Sparkles,
    title: "Styles for Every Emotion",
    description:
      "Romantic, funny, elegant, emotional, luxury, playful, spiritual, family-focused, or deeply personal.",
    gradient: "from-yellow-300 to-orange-400",
  },
  {
    icon: Image,
    title: "Beautiful Keepsakes",
    description:
      "Create polished visual gifts for birthdays, love notes, apologies, weddings, pets, family memories, and more.",
    gradient: "from-orange-400 to-amber-500",
  },
  {
    icon: Download,
    title: "Ready to Share",
    description:
      "Download your finished creation and send it as a message, post it, print it, or keep it as a memory.",
    gradient: "from-cyan-400 to-blue-500",
  },
  {
    icon: Palette,
    title: "Premium Templates",
    description:
      "Choose from carefully designed templates made to look emotional, modern, elegant, and gift-worthy.",
    gradient: "from-purple-400 to-pink-500",
  },
  {
    icon: Lock,
    title: "Private by Design",
    description:
      "Your personal photos and memories are handled with care, so you can create with confidence.",
    gradient: "from-indigo-400 to-violet-500",
  },
];

export const FeaturesHighlight = () => {
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
          <div className="mb-5 inline-flex rounded-full border border-yellow-400/25 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-200">
            Thoughtful by design
          </div>

          <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Everything you need to create{" "}
            <span className="bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-400 bg-clip-text text-transparent">
              unforgettable gifts.
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/60">
            Create something emotional, personal, and beautiful without spending
            hours designing from scratch.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-xl transition duration-300 hover:-translate-y-1 hover:border-yellow-300/35 hover:shadow-yellow-500/10"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.45 }}
            >
              <div
                className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-10`}
              />

              <div
                className={`relative mb-7 h-16 w-16 rounded-2xl bg-gradient-to-br ${feature.gradient} p-0.5 transition duration-300 group-hover:scale-110`}
              >
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-black">
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
              </div>

              <h3 className="relative mb-3 text-xl font-black text-white">
                {feature.title}
              </h3>

              <p className="relative text-sm leading-7 text-white/55">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};