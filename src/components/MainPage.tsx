import React, { useMemo, useState, useEffect } from "react";
import { ChevronRight, Star, Coins } from "lucide-react";

interface TheDigitalGifterMainPageProps {
  onStartCreating: () => void;
  onViewTemplates: () => void;
  createHref?: string;
}

export default function TheDigitalGifterMainPage({
  onStartCreating,
  onViewTemplates,
  createHref = "/generator",
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
            }}
          />
        ))}
      </div>

      {/* MAIN CONTENT WRAPPER */}
      <main>
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
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-4 font-extrabold text-[#1a1a1a] border border-white/60 bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] bg-[length:250%_250%] animate-gradientShift shadow-[0_12px_30px_rgba(255,170,90,.45),_0_0_0_2px_rgba(255,210,150,.45)_inset] hover:scale-[1.04] transition"
            >
              Start Creating <ChevronRight size={18} />
            </button>
            <button
              onClick={onViewTemplates}
              className="rounded-2xl px-8 py-4 font-semibold bg-white/10 border border-white/20 hover:bg-white/15 transition"
            >
              View Templates
            </button>
          </div>
        </section>

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

        {/* CAROUSEL */}
        <TemplatesCarousel />

        {/* CTA CUSTOM DESIGN */}
        <section className="text-center py-10 px-6">
          <p className="text-[#dfe6f1] mb-4">
            Don't see what you're looking for? Our AI can create custom designs
            based on your description!
          </p>
          <button
            onClick={onStartCreating}
            className="inline-block rounded-2xl px-8 py-4 font-extrabold text-[#1a1a1a] border border-white/60 bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] bg-[length:250%_250%] animate-gradientShift shadow-[0_12px_30px_rgba(255,170,90,.45)] hover:scale-[1.04] transition"
          >
            Create Custom Design
          </button>
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
                <div className="w-16 h-16 flex items-center justify-center rounded-full text-2xl font-bold text-[#1a1a1a] bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] mb-4">
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
              >
                <div className="flex items-center mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star
                      key={j}
                      size={18}
                      className="text-yellow-400 fill-yellow-400"
                    />
                  ))}
                </div>
                <p className="text-[#e9ecf3] mb-3 italic">"{t.text}"</p>
                <h4 className="font-bold text-white">{t.name}</h4>
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
              className="inline-block rounded-2xl px-8 py-4 font-extrabold text-[#1a1a1a] border border-white/60 bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] bg-[length:250%_250%] animate-gradientShift shadow-[0_12px_30px_rgba(255,170,90,.45)] hover:scale-[1.04] transition"
            >
              Start Your Christmas Cards
            </button>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="text-center py-6 text-[#dfe6f1] text-sm border-t border-white/10">
        <div className="flex justify-center items-center gap-2 mb-2 font-extrabold text-white">
          🎁 TheDigitalGifter
        </div>
        <p>© 2024 TheDigitalGifter. Spreading Christmas joy with AI.</p>
      </footer>
    </div>
  );
}

/* ===== Carousel Component (4 per page + badges) ===== */
function TemplatesCarousel() {
  const categories = [
    "All",
    "Classic",
    "Cozy",
    "Snowy",
    "Romantic",
    "Religious",
    "Minimalist",
    "Homey",
    "Foodie",
  ];

  const items = useMemo(
    () => [
      { id: "c1", title: "Gold Ribbon Classic", price: 8, category: "Classic" },
      { id: "c2", title: "Midnight Ornaments", price: 12, category: "Classic" },
      { id: "z1", title: "Fireplace Family", price: 10, category: "Cozy" },
      { id: "z2", title: "Decorating Tree", price: 14, category: "Cozy" },
      { id: "s1", title: "Snowman Builders", price: 9, category: "Snowy" },
      {
        id: "r1",
        title: "Warm Lights Couple",
        price: 16,
        category: "Romantic",
      },
      { id: "g1", title: "Nativity Glow", price: 18, category: "Religious" },
      { id: "m1", title: "Scandi Calm", price: 6, category: "Minimalist" },
      { id: "h1", title: "Kitchen Cookies", price: 7, category: "Homey" },
      { id: "f1", title: "Festive Dinner", price: 11, category: "Foodie" },
    ],
    []
  );

  const [active, setActive] = useState("All");
  const filtered = useMemo(
    () =>
      active === "All" ? items : items.filter((i) => i.category === active),
    [active, items]
  );

  const [page, setPage] = useState(0);
  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const goPrev = () => setPage((p) => (p - 1 + totalPages) % totalPages);
  const goNext = () => setPage((p) => (p + 1) % totalPages);

  useEffect(() => setPage(0), [active]);

  return (
    <section
      id="templates"
      className="relative z-[2] px-4 md:px-8 lg:px-12 py-10"
    >
      <div className="max-w-7xl mx-auto">
        {/* Filter pills */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-6">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`px-4 py-2 rounded-full text-sm border transition will-change-transform hover:scale-[1.03] ${
                active === c
                  ? "text-[#1a1a1a] bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] border-white/50"
                  : "text-white bg-white/10 border-white/20 hover:bg-white/15"
              }`}
              aria-pressed={active === c}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Carousel body */}
        <div className="relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {pageItems.map((item) => (
              <div
                key={item.id}
                className="relative rounded-2xl bg-white/10 border border-white/20 overflow-hidden"
              >
                {/* price badge */}
                <div className="absolute top-2 right-2 flex items-center gap-2 bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] text-[#1a1a1a] text-xs font-extrabold px-2 py-1 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.3)]">
                  <Coins size={14} className="text-[#1a1a1a]" />{" "}
                  <span>{item.price}</span>
                </div>

                <div className="aspect-[4/3] bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)]" />
                <div className="p-4">
                  <div className="font-extrabold text-lg">{item.title}</div>
                  <div className="text-[#dfe6f1] text-sm mt-1">
                    {item.category}
                  </div>
                </div>
              </div>
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
        </div>
      </div>
    </section>
  );
}
