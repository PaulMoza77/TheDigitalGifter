import { Brain, Zap, Image, Video, Shield, Palette } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Brain,
    title: "AI Face Matching",
    description: "Advanced AI automatically detects and perfectly positions faces in your chosen template",
    gradient: "from-blue-500 to-cyan-500"
  },
  {
    icon: Video,
    title: "Cinematic Video Generation",
    description: "Create stunning AI videos with Google VEO3 technology - turn cards into animated stories",
    gradient: "from-purple-500 to-pink-500"
  },
  {
    icon: Image,
    title: "Print-Quality Resolution",
    description: "Download high-resolution cards (300 DPI) ready for professional printing",
    gradient: "from-orange-500 to-amber-500"
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Generate your personalized card in ~30 seconds. Videos in under 2 minutes",
    gradient: "from-green-500 to-emerald-500"
  },
  {
    icon: Palette,
    title: "100+ Premium Templates",
    description: "Professionally designed templates for every occasion - Christmas, birthdays, weddings & more",
    gradient: "from-red-500 to-rose-500"
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your photos are processed securely and automatically deleted after generation",
    gradient: "from-indigo-500 to-violet-500"
  }
];

export const FeaturesHighlight = () => {
  return (
    <section className="w-full py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div 
          className="text-center mb-20 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-block px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm mb-4">
            Powered by Advanced AI
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white">
            Everything You Need to Create{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              Perfect Cards
            </span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Professional-grade AI technology meets simple, intuitive design
          </p>
        </motion.div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              className="group relative bg-slate-900/50 border border-slate-800 rounded-2xl p-8 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
            >
              {/* Glow effect */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`} />

              {/* Icon */}
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} p-0.5 mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <div className="w-full h-full rounded-xl bg-slate-950 flex items-center justify-center">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold mb-3 text-white group-hover:text-blue-400 transition-colors">
                {feature.title}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
