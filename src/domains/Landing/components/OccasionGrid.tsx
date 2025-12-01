import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { occasions } from "@/constants/occasions";
import { cn } from "@/lib/utils";

export const OccasionGrid = () => {
  return (
    <section id="categories" className="w-full py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-16 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white">
            Choose Your Perfect{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              Occasion
            </span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            From festive holidays to milestone celebrations, find the perfect
            style for every special moment
          </p>
        </motion.div>

        {/* Category grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {occasions.map((occasion, index) => (
            <motion.div
              key={occasion.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ scale: 1.03 }}
            >
              <Card className="group relative overflow-hidden bg-slate-900/50 border-slate-800 hover:border-blue-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 cursor-pointer">
                <CardContent className="p-0 relative isolate">
                  {occasion.id === "christmas" && (
                    <Link
                      to={`/${occasion.id}`}
                      className="absolute inset-0 z-11"
                    ></Link>
                  )}
                  {/* Image with gradient overlay */}

                  <div className="relative h-64 overflow-hidden">
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${occasion.gradientFrom} ${occasion.gradientTo} opacity-80 z-10`}
                    />
                    <img
                      src={occasion.image}
                      alt={occasion.title}
                      className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${
                        occasion.id !== "christmas" ? "opacity-50" : ""
                      }`}
                      loading="lazy"
                    />

                    {/* Coming Soon Label */}
                    {occasion.id !== "christmas" && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center">
                        <div className="px-6 py-2 rounded-2xl bg-orange-500/90 backdrop-blur-sm border-2 border-orange-400 text-white text-lg font-bold shadow-lg">
                          Coming Soon
                        </div>
                      </div>
                    )}

                    {/* Occasion label */}
                    {occasion.id === "christmas" && (
                      <div className="absolute top-4 left-4 z-20 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 text-xs text-white">
                        {occasion.label}
                      </div>
                    )}

                    {/* Glow effect */}
                    <div className="absolute inset-0 z-20 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-4">
                    <div>
                      <h3 className="text-2xl font-bold mb-2 text-white group-hover:text-blue-400 transition-colors">
                        {occasion.title}
                      </h3>
                      <p className="text-slate-400 text-sm mb-2">
                        {occasion.description}
                      </p>
                    </div>
                    {occasion.id === "christmas" && (
                      <div className="flex gap-2 items-center relative z-20">
                        <Link to={`/${occasion.id}`} className="w-full">
                          <Button
                            className={cn(
                              "w-full text-white rounded-xl group/btn ",
                              "bg-gray-800 hover:bg-gray-700"
                            )}
                            variant={"ghost"}
                          >
                            See More
                            <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                          </Button>
                        </Link>
                        <Link
                          to={`/templates?occasion=${occasion.id}`}
                          className="w-full"
                        >
                          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl group/btn">
                            Explore Templates
                            <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
