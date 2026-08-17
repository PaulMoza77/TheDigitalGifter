import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Camera, Heart, MessageCircleHeart, Pause, Play, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { petLossPhotos } from "@/assets/pet-loss";

const CREATE_HREF = "/generator?category=pets&occasion=pet-loss";
const TEMPLATES_HREF = "/templates?category=pets&occasion=pet-loss";

const gallery = [
  {
    src: petLossPhotos.heroDog,
    alt: "Golden retriever holding a flower",
    label: "In memory",
    caption: "A keepsake for the ones we still talk about.",
  },
  {
    src: petLossPhotos.catWindow,
    alt: "Black and white cat looking toward the camera",
    label: "Still here",
    caption: "Their face, their name, a quiet light.",
  },
  {
    src: petLossPhotos.sleepingCat,
    alt: "Ginger cat sleeping peacefully",
    label: "At rest",
    caption: "A gentle goodbye, made to be kept.",
  },
  {
    src: petLossPhotos.field,
    alt: "A cat and a dog resting together",
    label: "Together",
    caption: "For the companions who made a house a home.",
  },
] as const;

const styles = [
  {
    title: "Remembrance portrait",
    description:
      "A quiet, beautiful portrait of the pet you miss — their face, their name, soft light.",
    image: petLossPhotos.heroDog,
    galleryIndex: 0,
  },
  {
    title: "A gentle goodbye",
    description:
      "A sympathy card you can send to someone who lost a companion they loved.",
    image: petLossPhotos.sleepingCat,
    galleryIndex: 2,
  },
  {
    title: "Forever in our home",
    description:
      "A keepsake with a short message, a date, or the words you still want to say.",
    image: petLossPhotos.field,
    galleryIndex: 3,
  },
] as const;

const steps = [
  {
    icon: Camera,
    title: "Start with a photo you love",
    description: "A clear face is enough. The one that still feels like them.",
    image: petLossPhotos.portrait,
  },
  {
    icon: Heart,
    title: "Add their name",
    description: "A name, a few words, or nothing extra. Keep it as simple as you need.",
    image: petLossPhotos.catWindow,
  },
  {
    icon: Sparkles,
    title: "Receive a gentle tribute",
    description: "A personal card or portrait made to honor a memory, not to entertain.",
    image: petLossPhotos.heroDog,
  },
] as const;

const faqs = [
  {
    question: "Is this the same as the dog and cat portrait pages?",
    answer:
      "No. Those pages create playful secret-life portraits. This page is only for remembrance and sympathy.",
  },
  {
    question: "Who is this for?",
    answer:
      "For you, if you want a keepsake. Or for someone you care about who just lost a pet.",
  },
  {
    question: "What photo works best?",
    answer:
      "A photo where their face is clear and looking toward the camera. Older photos are welcome.",
  },
  {
    question: "Can I include a message?",
    answer:
      "Yes. Add their name and a short line if you want — or leave the words out and let the portrait speak.",
  },
] as const;

export default function PetLossPage() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = gallery[active];

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActive((prev) => (prev + 1) % gallery.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <>
      <PageHead
        title="Pet Loss Remembrance Cards"
        description="Honor a beloved pet with a gentle remembrance portrait or sympathy card. Made from one photo, with their name, in a quiet and meaningful style."
        image={`https://www.thedigitalgifter.com${gallery[0].src}`}
      />

      <main className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-black text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,122,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(100,116,139,0.18),transparent_32%)]" />

        <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
                <Heart className="h-4 w-4 text-amber-200/90" />
                Forever remembered
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-[1.08]">
                Honor a pet memory
                <span className="mt-2 block bg-gradient-to-r from-amber-100 via-stone-200 to-slate-300 bg-clip-text text-transparent">
                  with something gentle.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-8 text-white/70 sm:text-lg">
                Create a quiet remembrance portrait or a sympathy card from one
                photo. Made for the ones who were family — not a joke, not a
                costume, just a lasting goodbye.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to={CREATE_HREF}
                  className="inline-flex items-center gap-2 rounded-2xl bg-amber-100 px-6 py-3.5 text-sm font-semibold text-black shadow-lg shadow-black/30 transition hover:brightness-105"
                >
                  Create a remembrance
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  to={TEMPLATES_HREF}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  Browse styles
                </Link>
              </div>

              <p className="mt-4 text-sm text-white/45">
                One photo. Their name. A tribute you can keep or send.
              </p>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900 shadow-2xl">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={current.src}
                    src={current.src}
                    alt={current.alt}
                    initial={{ opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.45 }}
                    className="h-[420px] w-full object-cover sm:h-[520px]"
                  />
                </AnimatePresence>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/80">
                    {current.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {current.caption}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaused((value) => !value)}
                  className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
                  aria-label={paused ? "Play gallery" : "Pause gallery"}
                >
                  {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {gallery.map((item, index) => (
                  <button
                    key={item.src}
                    type="button"
                    onClick={() => {
                      setActive(index);
                      setPaused(true);
                    }}
                    className={`overflow-hidden rounded-2xl border transition ${
                      index === active
                        ? "border-amber-100/80 ring-2 ring-amber-100/30"
                        : "border-white/10 opacity-70 hover:opacity-100"
                    }`}
                    aria-label={`Show ${item.alt}`}
                  >
                    <img
                      src={item.src}
                      alt=""
                      className="h-16 w-full object-cover sm:h-20"
                    />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-2">
            {[
              {
                title: "For you",
                description:
                  "Keep a portrait that feels like them. A quiet reminder of a companion who made the house feel like home.",
                image: petLossPhotos.softDog,
                icon: MessageCircleHeart,
              },
              {
                title: "For someone grieving",
                description:
                  "Send a sympathy card when words are hard. Soft, personal, and made from a photo of the pet they loved.",
                image: petLossPhotos.catWindow,
                icon: Heart,
              },
            ].map((card, index) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"
                >
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={card.image}
                      alt=""
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  </div>
                  <div className="p-6">
                    <Icon className="mb-4 h-6 w-6 text-amber-200" />
                    <h2 className="text-xl font-bold">{card.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/65">
                      {card.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              How it works
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.08 }}
                    className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"
                  >
                    <div className="relative h-40 overflow-hidden">
                      <img
                        src={step.image}
                        alt=""
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <span className="absolute left-4 bottom-3 text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                        0{index + 1}
                      </span>
                    </div>
                    <div className="p-6">
                      <Icon className="mb-3 h-5 w-5 text-amber-200/90" />
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/65">
                        {step.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="mt-16">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Memorial styles
              </h2>
              <Link
                to={CREATE_HREF}
                className="hidden items-center text-sm font-semibold text-amber-100/90 hover:text-amber-50 sm:inline-flex"
              >
                Start with a photo
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {styles.map((item, index) => (
                <motion.button
                  key={item.title}
                  type="button"
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  onClick={() => {
                    setActive(item.galleryIndex);
                    setPaused(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] text-left transition hover:-translate-y-1 hover:border-amber-100/30"
                >
                  <div className="relative h-56 overflow-hidden">
                    <img
                      src={item.image}
                      alt=""
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                    <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
                      Preview
                    </span>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-white/65">
                      {item.description}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-100">
                      See this style
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="mt-16 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <h2 className="text-2xl font-bold">A few quiet answers</h2>
            <Accordion type="single" collapsible className="mt-4">
              {faqs.map((item) => (
                <AccordionItem
                  key={item.question}
                  value={item.question}
                  className="border-white/10"
                >
                  <AccordionTrigger className="text-base text-white hover:no-underline hover:text-amber-100">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-6 text-white/65">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-3xl border border-amber-100/15 bg-amber-100/5 p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <p className="text-lg font-semibold text-white">
                Looking for playful portraits instead?
              </p>
              <p className="mt-1 text-sm text-white/60">
                Secret lives for dogs and cats live on a different page.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/pet/dog"
                className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
              >
                Dogs
              </Link>
              <Link
                to="/pet/cat"
                className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
              >
                Cats
              </Link>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              to={CREATE_HREF}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-black transition hover:scale-[1.02]"
            >
              Create a remembrance
              <ArrowRight className="h-5 w-5" />
            </Link>
            <p className="mt-4 text-sm text-white/45">
              Gentle. Personal. Made to be kept.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
