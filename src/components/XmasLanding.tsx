import React from "react";

type Props = {
  onGetStarted: () => void;
  onViewTemplates: () => void;
  onSignIn: () => void;
  onBuyCredits: () => void;
};

export default function XmasLanding({
  onGetStarted,
  onViewTemplates,
  onSignIn,
  onBuyCredits,
}: Props) {
  return (
    <div className="min-h-screen festive-bg text-light">
      {/* Top bar */}
<header className="sticky top-0 z-20 h-16 px-6 flex items-center justify-between">
  {/* LEFT: brand */}
  <div className="text-white font-semibold tracking-tight">TheDigitalGifter</div>

  {/* CENTER: optional nav */}
  <nav className="hidden md:flex gap-8 text-sm text-light-muted">
    <a href="#templates" className="hover:text-white">Templates</a>
    <a href="#how" className="hover:text-white">How it works</a>
    <a href="#why" className="hover:text-white">Why us</a>
  </nav>

  {/* RIGHT: actions */}
  <div className="flex items-center gap-3">
    <button onClick={onSignIn} className="btn-ghost h-9 px-4">Sign In</button>
    <button onClick={onBuyCredits} className="btn-festive h-9 px-4">Buy Credits</button>
  </div>
</header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto pt-10 pb-14 px-6 text-center">
        <div className="inline-flex items-center gap-2 badge-festive text-xs md:text-sm mb-6">
          <span>🎄 Christmas Special</span>
          <span className="font-normal">• Limited time</span>
        </div>

        <h1 className="text-center font-extrabold leading-tight tracking-tight">
          <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white">
            Create Magical
          </span>

          {/* Gradient pe text, nu pe un pătrat */}
          <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl bg-clip-text text-transparent bg-festive-gradient">
            Christmas Cards
          </span>

          <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white">
            with AI
          </span>
        </h1>

        <p className="mt-6 text-base md:text-lg text-light-muted max-w-3xl mx-auto">
          Transform your holiday memories into stunning, personalized Christmas cards in seconds.
          No design skills needed — just upload, customize, and let our AI work its magic.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4">
          <button onClick={onGetStarted} className="btn-festive px-6 py-3">
            Start Creating
          </button>
          <button onClick={onViewTemplates} className="btn-ghost px-6 py-3">
            View Templates
          </button>
        </div>

        {/* tiny indicators (subtle) */}
        <div className="mt-8 hr-garland" />

        {/* Feature ticks line */}
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs md:text-sm text-light-muted">
          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-400" /> No subscription required</li>
          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-yellow-400" /> High-resolution downloads</li>
          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-orange-400" /> Ready in under 60 seconds</li>
        </ul>

        {/* Stats row identic */}
        <section className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-8 text-left md:text-center">
          <div>
            <div className="text-3xl font-extrabold">
              <span className="text-festive-red">50,000+</span>
            </div>
            <div className="text-sm text-light-muted">Cards Created</div>
          </div>
          <div>
            <div className="text-3xl font-extrabold">
              <span className="text-festive-green">98%</span>
            </div>
            <div className="text-sm text-light-muted">Happy Customers</div>
          </div>
          <div>
            <div className="text-3xl font-extrabold">
              <span className="text-festive-green">&lt; 60s</span>
            </div>
            <div className="text-sm text-light-muted">Average Creation Time</div>
          </div>
          <div>
            <div className="text-3xl font-extrabold">
              <span className="text-festive-red">4.9/5</span>
            </div>
            <div className="text-sm text-light-muted">Customer Rating</div>
          </div>
        </section>
      </main>
    </div>
  );
}
<h1 className="text-5xl md:text-6xl font-extrabold leading-tight text-center">
  <span className="text-white">Create Magical </span>
  <span className="bg-clip-text text-transparent bg-festive-gradient">Christmas</span>
  <span className="text-white"> with AI</span>
</h1>
