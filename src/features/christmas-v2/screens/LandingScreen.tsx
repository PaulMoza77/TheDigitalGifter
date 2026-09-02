import { useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Sparkles, Upload } from "lucide-react";
import { CHRISTMAS_PACKS, CHRISTMAS_STARTER_SCENES } from "../config";

export function ChristmasLandingScreen({
  onFile,
  photoError,
  previewUrl,
}: {
  onFile: (files: FileList | null) => void;
  photoError?: string;
  previewUrl?: string | null;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const pack = CHRISTMAS_PACKS.starter;

  const openFilePicker = () => inputRef.current?.click();

  return (
    <div className="space-y-7">
      <section className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="inline-flex items-center gap-2 rounded-full border border-[#C9A227]/45 bg-[#C9A227]/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#F3D98A]"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          $3 Only
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="cv2-display max-w-xl text-[2.15rem] font-semibold leading-[1.08] tracking-tight text-[#F7F0E4] sm:text-5xl"
        >
          Turn Your Photo Into Christmas Magic
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="max-w-md text-base leading-7 text-[#F7F0E4]/78 sm:text-lg"
        >
          Get 3 AI Christmas portraits for just $3
        </motion.p>

        <p className="text-sm text-[#F7F0E4]/55">
          Upload 1 photo • Receive 3 portraits • Delivered in minutes
        </p>
      </section>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.18 }}
        role="button"
        tabIndex={0}
        aria-label="Upload your photo"
        onClick={openFilePicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openFilePicker();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFile(e.dataTransfer.files);
        }}
        className={`relative cursor-pointer overflow-hidden rounded-[1.6rem] border-2 border-dashed p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:ring-offset-2 focus-visible:ring-offset-[#3b0610] ${
          dragging
            ? "border-[#C9A227] bg-[#F7F0E4]/10"
            : "border-[#F7F0E4]/25 bg-[#F7F0E4]/06"
        }`}
      >
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[1.35rem] bg-gradient-to-b from-[#F7F0E4]/08 to-transparent px-6 py-10 text-center sm:min-h-[280px]">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Your uploaded portrait"
              className="max-h-56 w-auto rounded-2xl object-cover shadow-2xl shadow-black/40"
            />
          ) : (
            <>
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#1B4332] text-[#F7F0E4] shadow-lg shadow-black/30">
                <Upload className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="cv2-display text-2xl font-semibold text-[#F7F0E4]">Upload Your Photo</span>
              <span className="max-w-xs text-sm text-[#F7F0E4]/60">
                JPEG, PNG, or WebP · up to 15 MB · one clear portrait works best
              </span>
            </>
          )}
        </div>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          onChange={(e) => onFile(e.target.files)}
        />
      </motion.div>

      {photoError ? <p className="text-sm text-[#ffb4a8]">{photoError}</p> : null}

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#F7F0E4]/65">
        {[
          `${pack.imageCount} Christmas portraits`,
          `${pack.priceDisplay} one-time`,
          "No subscription",
          "Secure checkout",
        ].map((label) => (
          <li key={label} className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[#C9A227]" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>

      <section className="space-y-3 pt-2">
        <h2 className="cv2-display text-xl font-semibold text-[#F7F0E4]">Your 3 AI Christmas Portraits</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {CHRISTMAS_STARTER_SCENES.map((scene, index) => (
            <motion.article
              key={scene.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + index * 0.08 }}
              className="overflow-hidden rounded-2xl border border-[#F7F0E4]/12 bg-[#F7F0E4]/08"
            >
              <div className="aspect-[3/4] overflow-hidden bg-[#2a0810]">
                {scene.exampleImage ? (
                  <img
                    src={scene.exampleImage}
                    alt={scene.label}
                    className="h-full w-full object-cover"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                ) : null}
              </div>
              <div className="px-3 py-3">
                <p className="text-sm font-semibold text-[#F7F0E4]">{scene.label}</p>
                <p className="mt-0.5 text-xs text-[#F7F0E4]/55">{scene.category}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>
    </div>
  );
}
