import React, { useMemo, useState, useEffect, memo } from "react";
import { ChevronRight, Star } from "lucide-react";
import VideoModal from "./VideoModal";
import TemplateCard from "./TemplateCard";
import { TemplateSummary } from "@/types/templates";
import { useTemplatesQuery } from "@/data";

interface TheDigitalGifterMainPageProps {
  onStartCreating: () => void;
  onViewTemplates: () => void;
  createHref?: string; // Used for href links if needed
}

export default function TheDigitalGifterMainPage({
  onStartCreating,
  onViewTemplates,
  createHref: _createHref = "/generator",
}: TheDigitalGifterMainPageProps) {
  const stats = [
    { value: "50,000+", label: "Cards Created" },
    { value: "98%", label: "Happy Customers" },
    { value: "< 60s", label: "Average Creation Time" },
    { value: "4.9/5", label: "Customer Rating" },
  ];

  const features = [
    {
      title: "AI-Powered Design",
      desc: "Smart algorithms create stunning layouts automatically",
      icon: "✨",
    },
    {
      title: "High Quality",
      desc: "Professional-grade outputs ready for print or digital sharing",
      icon: "🛡️",
    },
    {
      title: "Personal Touch",
      desc: "Customize every detail to match your unique style",
      icon: "🎁",
    },
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Mom of 3",
      text: "TheDigitalGifter made our family Christmas cards absolutely beautiful! The AI understood exactly what I wanted.",
    },
    {
      name: "Michael Chen",
      role: "Small Business Owner",
      text: "Perfect for creating professional holiday cards for my clients. The quality is outstanding and it's so fast!",
    },
    {
      name: "Emma Williams",
      role: "Grandmother",
      text: "I'm not tech-savvy, but this was so easy to use. My grandchildren loved the personalized cards I made!",
    },
  ];

  return (
    <div
      className="relative min-h-screen text-[#f8fafc] overflow-x-hidden overflow-y-visible"
      style={{
        background: `radial-gradient(1400px 600px at 50% -10%, rgba(255,210,140,.12), transparent 60%),
                    radial-gradient(900px 500px at 85% 10%, rgba(255,90,90,.12), transparent 60%),
                    radial-gradient(900px 500px at 15% 20%, rgba(46,230,162,.10), transparent 60%),
                    linear-gradient(180deg,#060a12 0%, #0b1220 100%)`,
      }}
    >
      {/* Skip-to-content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded"
      >
        Skip to main content
      </a>

      {/* Static Snow Layer (subtle) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden z-[1]"
      >
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute bg-white rounded-full opacity-70 animate-snowDrift"
            style={{
              width: `${Math.random() * 3 + 2}px`,
              height: `${Math.random() * 3 + 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 12}s`,
              willChange: "transform",
            }}
          />
        ))}
      </div>

      {/* MAIN CONTENT WRAPPER */}
      <main id="main-content">
        {/* HERO */}
        <section className="relative z-[2] max-w-4xl mx-auto text-center py-12 px-4">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-white/20 bg-[linear-gradient(90deg,rgba(46,230,162,.18),rgba(255,90,90,.18))] font-semibold">
            ❄️ Christmas Special – Limited Time
          </div>
          <h1 className="mt-6 text-5xl md:text-6xl font-extrabold leading-[1.05] text-[#fffef5]">
            Create Magical{" "}
            <span className="bg-clip-text text-transparent bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] animate-gradientShift">
              Christmas Cards
            </span>{" "}
            with AI
          </h1>
          <p className="mt-4 text-[#dfe6f1] max-w-2xl mx-auto">
            Transform your holiday memories into stunning, personalized
            Christmas cards in seconds. No design skills needed — just upload,
            customize, and let our AI work its magic.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={onStartCreating}
              aria-label="Start creating your AI Christmas card"
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-4 font-extrabold text-[#1a1a1a] border border-white/60 bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] bg-[length:250%_250%] animate-gradientShift shadow-[0_12px_30px_rgba(255,170,90,.45),_0_0_0_2px_rgba(255,210,150,.45)_inset] hover:scale-[1.04] transition"
            >
              Start Creating <ChevronRight size={18} />
            </button>
            <button
              onClick={onViewTemplates}
              aria-label="View available templates"
              className="rounded-2xl px-8 py-4 font-semibold bg-white/10 border border-white/20 hover:bg-white/15 transition"
            >
              View Templates
            </button>
          </div>
        </section>

        {/* CAROUSEL */}
        <TemplatesCarousel />

        {/* STATS */}
        <section className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 text-center py-8 gap-8 relative z-[2]">
          {stats.map((s, i) => (
            <div key={i}>
              <h3 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)]">
                {s.value}
              </h3>
              <p className="mt-2 text-[#cfd6e3] text-sm md:text-base">
                {s.label}
              </p>
            </div>
          ))}
        </section>

        {/* HOW IT WORKS */}
        <section className="max-w-4xl mx-auto text-center py-12 px-4">
          <h2 className="text-3xl font-extrabold mb-8 text-[#fffef5]">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              "Choose Template",
              "Add Your Touch",
              "AI Magic",
              "Download & Share",
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div
                  className="w-16 h-16 flex items-center justify-center rounded-full text-2xl font-bold text-[#1a1a1a] bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] mb-4"
                  aria-label={`Step ${i + 1}: ${step}`}
                >
                  {i + 1}
                </div>
                <p className="font-bold text-white mb-1">{step}</p>
                <p className="text-sm text-[#cfd6e3] max-w-[150px]">
                  {i === 0 && "Pick from our festive collection"}
                  {i === 1 && "Upload photos and customize text"}
                  {i === 2 && "Our AI perfects the design"}
                  {i === 3 && "Get your beautiful Christmas card"}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA CUSTOM DESIGN */}
        <section className="text-center py-10 px-6">
          <p className="text-[#dfe6f1] mb-4">
            Don't see what you're looking for? Our AI can create custom designs
            based on your description!
          </p>
          <button
            onClick={onStartCreating}
            aria-label="Create a custom design for your Christmas card"
            className="inline-block rounded-2xl px-8 py-4 font-extrabold text-[#1a1a1a] border border-white/60 bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] bg-[length:250%_250%] animate-gradientShift shadow-[0_12px_30px_rgba(255,170,90,.45)] hover:scale-[1.04] transition"
          >
            Create Custom Design
          </button>
        </section>

        {/* WHY CHOOSE */}
        <section className="max-w-5xl mx-auto py-12 px-4">
          <h2 className="text-3xl font-extrabold text-center mb-10 text-[#fffef5]">
            Why Choose TheDigitalGifter?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-white/10 border border-white/20 rounded-2xl p-6 text-center shadow-[0_6px_12px_rgba(0,0,0,.2)]"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold mb-2 text-white">{f.title}</h3>
                <p className="text-sm text-[#cfd6e3]">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="max-w-4xl mx-auto py-12 px-4">
          <h2 className="text-3xl font-extrabold text-center mb-10 text-[#fffef5]">
            What Our Customers Say
          </h2>
          <div className="grid grid-cols-1 gap-6">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="bg-white/10 border border-white/20 rounded-2xl p-6 shadow-[0_6px_12px_rgba(0,0,0,.2)]"
                itemScope
                itemType="https://schema.org/Review"
              >
                <div
                  className="flex items-center mb-3"
                  aria-label="5 out of 5 stars"
                >
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star
                      key={j}
                      size={18}
                      className="text-yellow-400 fill-yellow-400"
                    />
                  ))}
                </div>
                <p className="text-[#e9ecf3] mb-3 italic" itemProp="reviewBody">
                  "{t.text}"
                </p>
                <h4 className="font-bold text-white" itemProp="author">
                  {t.name}
                </h4>
                <p className="text-sm text-[#b8c2d1]">{t.role}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="text-center py-16 px-6">
          <div className="max-w-2xl mx-auto bg-white/10 border border-white/20 rounded-2xl p-10">
            <h2 className="text-3xl font-extrabold mb-4 text-[#fffef5]">
              Ready to Create Magic?
            </h2>
            <p className="text-[#dfe6f1] mb-6">
              Join thousands of families creating beautiful Christmas memories
              with AI
            </p>
            <button
              onClick={onStartCreating}
              aria-label="Start creating your Christmas cards now"
              className="inline-block rounded-2xl px-8 py-4 font-extrabold text-[#1a1a1a] border border-white/60 bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] bg-[length:250%_250%] animate-gradientShift shadow-[0_12px_30px_rgba(255,170,90,.45)] hover:scale-[1.04] transition"
            >
              Start Your Christmas Cards
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ===== Carousel Component (4 per page + badges) ===== */
const TemplatesCarousel = memo(function TemplatesCarousel() {
  const categories = ["All", "Classic", "Cozy", "Snowy", "Romantic"];

  const { data: templates = [] } = useTemplatesQuery();
  const templatesArr = useMemo(
    () => (templates ?? []) as TemplateSummary[],
    [templates]
  );

  const [active, setActive] = useState("All");
  const filtered = useMemo(
    () =>
      active === "All"
        ? templatesArr
        : templatesArr.filter((t) => t.category === active),
    [active, templatesArr]
  );

  const [page, setPage] = useState(0);
  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const goPrev = () => setPage((p) => (p - 1 + totalPages) % totalPages);
  const goNext = () => setPage((p) => (p + 1) % totalPages);

  const [modal, setModal] = useState<{
    open: boolean;
    src: string;
    title?: string;
  }>({
    open: false,
    src: "",
    title: "",
  });

  useEffect(() => setPage(0), [active, templatesArr.length]);

  return (
    <section
      id="templates"
      className="relative z-[2] px-4 md:px-8 lg:px-12 py-10"
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex gap-3 mb-6">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${active === c ? "bg-white/10" : "bg-white/5"}`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {pageItems.map((item) => (
            <TemplateCard
              key={(item as any)._id}
              template={item as any}
              aspectClass="aspect-[4/3]"
              onOpenModal={(src, title) => setModal({ open: true, src, title })}
            />
          ))}
        </div>

        {/* Arrows */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={goPrev}
            aria-label="Previous"
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-white/10 border border-white/20 hover:bg-white/15 transition"
          >
            Prev
          </button>
          <div className="text-[#cfd6e3] text-sm">
            Page {page + 1} / {totalPages}
          </div>
          <button
            onClick={goNext}
            aria-label="Next"
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-white/10 border border-white/20 hover:bg-white/15 transition"
          >
            Next
          </button>
        </div>

        {modal.open && (
          <VideoModal
            src={modal.src}
            title={modal.title}
            onClose={() => setModal({ open: false, src: "", title: "" })}
          />
        )}
      </div>
    </section>
  );
});
