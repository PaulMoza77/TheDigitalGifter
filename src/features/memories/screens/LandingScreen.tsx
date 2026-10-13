import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Lock, Play, Shield, Sparkles } from "lucide-react";
import {
  MEMORIES_CREATE_ROUTE,
  MEMORIES_FAQ,
  MEMORIES_PLANS,
} from "../config";
import { trackMemoriesEvent } from "../analytics";
import {
  MEMORIES_DEMO_DISCLAIMER,
  MEMORIES_GALLERY_DEMOS,
  MEMORIES_HERO_DEMO,
} from "../demoAssets";

function BeforeAfterDemo({ className = "" }: { className?: string }) {
  const [pos, setPos] = useState(48);
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reduce) {
      video.pause();
      return;
    }
    void video.play().catch(() => undefined);
  }, [reduce]);

  return (
    <div className={`relative aspect-[4/3] w-full overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src={MEMORIES_HERO_DEMO.afterVideo}
        poster={MEMORIES_HERO_DEMO.afterPoster}
        muted
        loop
        playsInline
        autoPlay={!reduce}
        aria-label={MEMORIES_HERO_DEMO.afterAlt}
      />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img
          src={MEMORIES_HERO_DEMO.before}
          alt={MEMORIES_HERO_DEMO.beforeAlt}
          className="h-full max-w-none object-cover"
          style={{ width: "100vw", maxWidth: "72rem", height: "100%" }}
          draggable={false}
        />
      </div>
      <input
        type="range"
        min={8}
        max={92}
        value={pos}
        aria-label="Compare still photograph and short animated preview"
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute bottom-4 left-1/2 z-10 w-[70%] -translate-x-1/2 accent-[#D4AF7A]"
      />
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
        <p className="rounded bg-black/60 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-[#F4EDE3]">
          {MEMORIES_DEMO_DISCLAIMER}
        </p>
        <div className="flex gap-2 text-[10px] font-semibold uppercase tracking-wider">
          <span className="rounded bg-[#F4EDE3]/90 px-2 py-0.5 text-[#1a1510]">Before · still</span>
          <span className="rounded bg-[#D4AF7A]/95 px-2 py-0.5 text-[#1a1510]">After · short clip</span>
        </div>
      </div>
      {!reduce && (
        <motion.div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-[#F4EDE3]/85"
          style={{ left: `${pos}%` }}
          layout
        />
      )}
    </div>
  );
}

function GalleryCard({
  label,
  still,
  alt,
}: {
  label: string;
  still: string;
  alt: string;
}) {
  return (
    <figure className="group overflow-hidden">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#2a221a]">
        <img
          src={still}
          alt={alt}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>
      <figcaption className="mt-2 text-sm text-[#F4EDE3]/65">{label}</figcaption>
    </figure>
  );
}

export function MemoriesLandingScreen() {
  const howRef = useRef<HTMLElement>(null);
  const compareRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    trackMemoriesEvent({ eventName: "memories_page_view", pathname: "/memories" });
    const id = "memories-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,650;9..144,700&family=Nunito+Sans:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  const fade = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay },
        };

  return (
    <div className="memories-root bg-[#1a1510] text-[#F4EDE3]">
      <style>{`
        .memories-root { font-family: "Nunito Sans", system-ui, sans-serif; }
        .memories-display { font-family: Fraunces, Georgia, serif; }
        .memories-sticky-cta {
          position: sticky; bottom: 0; z-index: 40;
          background: linear-gradient(180deg, transparent, rgba(26,21,16,.92) 28%, #1a1510);
          padding: 1rem 0 1.25rem;
        }
      `}</style>

      <header className="relative min-h-[100svh] overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 70% 20%, rgba(212,175,122,.22), transparent 55%), radial-gradient(ellipse 60% 50% at 20% 80%, rgba(90,60,40,.45), transparent 50%), linear-gradient(165deg,#1a1510 0%,#2a221a 55%,#1a1510 100%)",
          }}
        />
        <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col px-5 pb-28 pt-8 sm:px-8">
          <p className="memories-display text-sm font-semibold tracking-[0.2em] text-[#D4AF7A] sm:text-base">
            Memories by The Digital Gifter
          </p>
          <div className="mt-8 grid flex-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <motion.p
                {...fade(0)}
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF7A]/90"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Early Access — Product in Development
              </motion.p>
              <motion.h1
                {...fade(0.06)}
                className="memories-display max-w-xl text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-[#F7F0E4] sm:text-5xl lg:text-[3.35rem]"
              >
                Bring Their Memories to Life
              </motion.h1>
              <motion.p
                {...fade(0.12)}
                className="max-w-md text-base leading-7 text-[#F4EDE3]/78 sm:text-lg"
              >
                Preserve meaningful moments, rediscover cherished photographs, and explore a new
                way to keep your family&apos;s stories close.
              </motion.p>
              <motion.div {...fade(0.18)} className="flex flex-wrap gap-3">
                <Link
                  to={MEMORIES_CREATE_ROUTE}
                  onClick={() => trackMemoriesEvent({ eventName: "memories_hero_cta" })}
                  className="inline-flex items-center gap-2 rounded-full bg-[#D4AF7A] px-6 py-3.5 text-sm font-semibold text-[#1a1510] transition hover:bg-[#e0c08a]"
                >
                  Create Your Memory
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <button
                  type="button"
                  onClick={() => howRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex items-center gap-2 rounded-full border border-[#F4EDE3]/25 px-6 py-3.5 text-sm font-semibold text-[#F4EDE3] transition hover:border-[#D4AF7A]/55"
                >
                  See How It Works
                </button>
              </motion.div>
            </div>
            <motion.div {...fade(0.2)} className="relative">
              <BeforeAfterDemo className="rounded-none sm:rounded-[1.25rem]" />
            </motion.div>
          </div>
        </div>
        <div className="memories-sticky-cta px-5 sm:hidden">
          <Link
            to={MEMORIES_CREATE_ROUTE}
            onClick={() => trackMemoriesEvent({ eventName: "memories_hero_cta" })}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#D4AF7A] px-6 py-3.5 text-sm font-semibold text-[#1a1510]"
          >
            Create Your Memory
          </Link>
        </div>
      </header>

      <section ref={howRef} className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <h2 className="memories-display text-3xl font-semibold text-[#F7F0E4] sm:text-4xl">
          How it works
        </h2>
        <p className="mt-3 max-w-xl text-[#F4EDE3]/7">
          Three simple steps to join early access. Generation launches later — after we validate
          demand and rights carefully.
        </p>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {[
            { n: "01", t: "Upload photos", d: "Add meaningful photographs. Private storage by default." },
            { n: "02", t: "Choose a plan", d: "Pick a monthly membership that matches your future library needs." },
            { n: "03", t: "Join early access", d: "Get confirmed on the list. We notify you when Memories is ready." },
          ].map((step) => (
            <li key={step.n} className="space-y-2 border-t border-[#D4AF7A]/25 pt-5">
              <p className="text-xs font-semibold tracking-[0.2em] text-[#D4AF7A]">{step.n}</p>
              <h3 className="memories-display text-xl font-semibold">{step.t}</h3>
              <p className="text-sm leading-6 text-[#F4EDE3]/7">{step.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section ref={compareRef} className="border-y border-[#F4EDE3]/08 bg-[#221b15] py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF7A]">
                Interactive comparison
              </p>
              <h2 className="memories-display mt-3 text-3xl font-semibold sm:text-4xl">
                Still photograph → short clip
              </h2>
              <p className="mt-4 max-w-md text-base leading-7 text-[#F4EDE3]/75">
                Drag the slider to compare a fictional still with a short animated preview. This is a
                demonstration of the experience we are validating — not a live customer product yet,
                and not a real recording.
              </p>
              <button
                type="button"
                onClick={() => compareRef.current?.querySelector("input")?.focus()}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#D4AF7A]"
              >
                <Play className="h-4 w-4" aria-hidden />
                Drag to compare
              </button>
            </div>
            <BeforeAfterDemo className="rounded-none sm:rounded-[1rem]" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <h2 className="memories-display text-3xl font-semibold sm:text-4xl">Example moments</h2>
        <p className="mt-3 max-w-xl text-[#F4EDE3]/7">
          Fictional demonstration stills created for this landing page — not customer photographs
          and not claimed as recordings of real private memories.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {MEMORIES_GALLERY_DEMOS.map((item) => (
            <GalleryCard key={item.id} label={item.label} still={item.still} alt={item.alt} />
          ))}
        </div>
      </section>

      <section className="border-y border-[#F4EDE3]/08 bg-[#221b15] py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <h2 className="memories-display text-3xl font-semibold sm:text-4xl">Subscription benefits</h2>
          <p className="mt-3 max-w-xl text-[#F4EDE3]/7">
            Planned membership benefits for when the product ships. Limits are provisional.
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {Object.values(MEMORIES_PLANS).map((plan) => (
              <div
                key={plan.key}
                className={`space-y-4 border p-6 ${
                  plan.badge ? "border-[#D4AF7A]/55 bg-[#2a221a]" : "border-[#F4EDE3]/12"
                }`}
              >
                {plan.badge ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF7A]">
                    {plan.badge}
                  </p>
                ) : (
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-transparent">·</p>
                )}
                <h3 className="memories-display text-2xl font-semibold">{plan.name}</h3>
                <p className="text-lg text-[#D4AF7A]">{plan.priceDisplay}</p>
                <ul className="space-y-2 text-sm text-[#F4EDE3]/75">
                  {plan.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <p className="text-xs text-[#F4EDE3]/45">{plan.provisionalNote}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8">
        <h2 className="memories-display text-3xl font-semibold sm:text-4xl">
          Transparent early access
        </h2>
        <p className="mt-4 text-base leading-7 text-[#F4EDE3]/75">
          You are joining a validation funnel for a product still in development. We do not
          advertise unfinished AI features as currently usable. Recurring charges only begin under
          an approved commercial mode after informed checkout. Cancel anytime once subscribed.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
        <h2 className="memories-display text-3xl font-semibold sm:text-4xl">FAQ</h2>
        <div className="mt-8 space-y-4">
          {MEMORIES_FAQ.map((item) => (
            <details key={item.q} className="group border-b border-[#F4EDE3]/12 pb-4">
              <summary className="cursor-pointer list-none py-2 text-left text-lg font-semibold text-[#F7F0E4] marker:content-none">
                {item.q}
              </summary>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#F4EDE3]/7">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { icon: Lock, t: "Private by default", d: "Uploads are not publicly listed. Access uses signed URLs where required." },
            { icon: Shield, t: "Your authority matters", d: "You confirm you have authority to upload materials. That acknowledgment alone does not establish every legal right." },
            { icon: Sparkles, t: "No AI impersonation in V1", d: "Voice cloning and conversational AI with deceased persons are not enabled in this release." },
          ].map((item) => (
            <div key={item.t} className="space-y-2">
              <item.icon className="h-5 w-5 text-[#D4AF7A]" aria-hidden />
              <h3 className="font-semibold">{item.t}</h3>
              <p className="text-sm leading-6 text-[#F4EDE3]/65">{item.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[#F4EDE3]/08 bg-[#2a221a] py-16">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 sm:flex-row sm:items-center sm:px-8">
          <div>
            <p className="memories-display text-sm font-semibold tracking-[0.18em] text-[#D4AF7A]">
              Memories by The Digital Gifter
            </p>
            <h2 className="memories-display mt-2 text-3xl font-semibold">Ready to begin?</h2>
          </div>
          <Link
            to={MEMORIES_CREATE_ROUTE}
            onClick={() => trackMemoriesEvent({ eventName: "memories_hero_cta" })}
            className="inline-flex items-center gap-2 rounded-full bg-[#D4AF7A] px-7 py-3.5 text-sm font-semibold text-[#1a1510]"
          >
            Create Your Memory
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
