import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { occasions } from "@/constants/occasions";
import { toast } from "sonner";
import { TrendingNowRow } from "@/components/website/TrendingNowRow";

export const HeroSection = () => {
  const [currentMockup, setCurrentMockup] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!occasions.length) return;

    const interval = window.setInterval(() => {
      setCurrentMockup((prev) => (prev + 1) % occasions.length);
    }, 3500);

    return () => window.clearInterval(interval);
  }, []);

  const currentOccasion = occasions[currentMockup];

  const handleOccasionClick = useCallback(() => {
    if (!currentOccasion) return;

    void navigate(`/funnel/homepage/${currentOccasion.id}`);
  }, [currentOccasion, navigate]);

  if (!currentOccasion) return null;

  return (
    <>
      <section className="relative w-full overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }}
            transition={{ duration: 4, repeat: Infinity, delay: 1.5 }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div
              className="space-y-8 text-center lg:text-left"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.div
                className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs uppercase tracking-wide text-blue-300"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                THE DIGITAL GIFTER
              </motion.div>

              <motion.h1
                className="text-5xl font-bold leading-tight text-white sm:text-6xl lg:text-7xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Create something they will{" "}
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  feel forever
                </span>
              </motion.h1>

              <motion.p
                className="mx-auto max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl lg:mx-0"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Turn one meaningful photo into a beautiful card or video made
                for birthdays, love, family moments, faith, pets, and every
                message that deserves to be remembered.
              </motion.p>

              <motion.div
                className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Link
                  to="/generator"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/50 transition-all hover:scale-105 hover:from-blue-700 hover:to-cyan-700"
                >
                  Start Creating
                  <ArrowRight className="h-5 w-5" />
                </Link>

                <Link
                  to="/templates"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-700 px-8 py-4 text-lg font-semibold text-white transition-all hover:border-blue-500/50 hover:bg-slate-900/50"
                >
                  Browse Templates
                </Link>
              </motion.div>

              <motion.div
                className="flex flex-wrap items-center justify-center gap-6 pt-4 text-sm text-white/85 lg:justify-start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((item) => (
                      <div
                        key={item}
                        className="h-8 w-8 rounded-full border-2 border-slate-950 bg-gradient-to-br from-blue-500 to-cyan-500"
                      />
                    ))}
                  </div>
                  <span>50,000+ heartfelt creations</span>
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
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-blue-500/30 to-orange-500/30 blur-3xl" />

                <div className="relative overflow-hidden rounded-3xl shadow-2xl shadow-blue-500/20">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentOccasion.id}
                      className="relative cursor-pointer"
                      onClick={handleOccasionClick}
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.5 }}
                    >
                      <img
                        src={currentOccasion.image}
                        alt={currentOccasion.title}
                        className="h-[360px] w-full object-cover sm:h-[430px]"
                      />

                      <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-xs text-white backdrop-blur-sm">
                        {currentOccasion.title}
                      </div>

                      <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 backdrop-blur-sm transition-all hover:bg-white">
                        Use this template
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <TrendingNowRow />
    </>
  );
};