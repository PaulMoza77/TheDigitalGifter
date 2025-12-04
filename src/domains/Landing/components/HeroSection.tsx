import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { occasions } from "@/constants/occasions";

export const HeroSection = () => {
  const [currentMockup, setCurrentMockup] = useState(0);
  // Hero rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMockup((prev) => (prev + 1) % occasions.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);
  const navigate = useNavigate();

  return (
    <section className="relative w-full flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, delay: 1.5 }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            className="text-center lg:text-left space-y-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs uppercase tracking-wide"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              THE DIGITAL GIFTER
            </motion.div>

            <motion.h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight text-white"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Turn your photos into instant{" "}
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                AI cards & videos
              </span>
            </motion.h1>

            <motion.p
              className="text-xl text-white max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              Pick a style, upload one photo, and let AI craft a high-end,
              share-ready card or video in seconds, perfect for every occasion.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Link
                to="/generator"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-blue-500/50 transition-all hover:scale-105"
              >
                Start Creating
                <ArrowRight className="w-5 h-5" />
              </Link>
              <button className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-slate-700 hover:border-blue-500/50 hover:bg-slate-900/50 rounded-2xl text-white font-semibold text-lg transition-all">
                Browse All Occasions
              </button>
            </motion.div>

            <motion.div
              className="flex flex-wrap items-center gap-6 justify-center lg:justify-start text-sm text-white pt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 border-2 border-slate-950"
                    />
                  ))}
                </div>
                <span>50,000+ happy creators</span>
              </div>
              <div>⭐ 4.9/5 average rating</div>
            </motion.div>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/30 to-orange-500/30 rounded-3xl blur-3xl" />

              <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/20">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentMockup}
                    className="relative cursor-pointer"
                    onClick={() =>
                      void navigate(
                        `/generator?occasion=${occasions[currentMockup].id}`
                      )
                    }
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.5 }}
                  >
                    <img
                      src={occasions[currentMockup].image}
                      alt={occasions[currentMockup].title}
                      className="w-full h-[430px] object-cover"
                    />

                    <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 text-xs text-white">
                      {occasions[currentMockup].title}
                    </div>

                    <div className="absolute bottom-4 right-4 px-4 py-2 rounded-xl bg-white/90 backdrop-blur-sm text-slate-900 text-sm font-semibold flex items-center gap-2 hover:bg-white transition-all">
                      Use this category
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
