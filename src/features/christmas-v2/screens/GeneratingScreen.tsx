import { motion } from "framer-motion";

export function ChristmasGeneratingScreen({ progressPercent = 12 }: { progressPercent?: number }) {
  const pct = Math.max(8, Math.min(99, Math.round(progressPercent || 12)));
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        className="grid h-20 w-20 place-items-center rounded-full bg-[#C9A227]/20 text-3xl"
        aria-hidden="true"
      >
        🎄
      </motion.div>
      <div>
        <h1 className="cv2-display text-3xl font-semibold text-[#F7F0E4] sm:text-4xl">
          Creating your Christmas magic…
        </h1>
        <p className="mt-2 text-sm text-[#F7F0E4]/65">
          Your portraits are being crafted. This page updates automatically — safe to refresh.
        </p>
      </div>
      <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-[#F7F0E4]/15">
        <motion.div
          className="h-full rounded-full bg-[#C9A227]"
          initial={{ width: "8%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
      <p className="text-xs text-[#F7F0E4]/45">{pct}% complete</p>
    </div>
  );
}
