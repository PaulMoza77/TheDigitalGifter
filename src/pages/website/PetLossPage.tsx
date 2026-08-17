import { ArrowRight, Camera, Heart, MessageCircleHeart, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { occasions } from "@/constants/occasions";

const CREATE_HREF = "/generator?category=pets&occasion=pet-loss";
const TEMPLATES_HREF = "/templates?category=pets&occasion=pet-loss";
const HERO_IMAGE =
  occasions.find((item) => item.id === "pet-loss")?.image ||
  "https://images.unsplash.com/photo-1544568100-847a948890b0?w=800&h=1000&fit=crop";

const styles = [
  {
    title: "Remembrance portrait",
    description:
      "A quiet, beautiful portrait of the pet you miss — their face, their name, soft light.",
  },
  {
    title: "A gentle goodbye",
    description:
      "A sympathy card you can send to someone who lost a companion they loved.",
  },
  {
    title: "Forever in our home",
    description:
      "A keepsake with a short message, a date, or the words you still want to say.",
  },
] as const;

const steps = [
  {
    icon: Camera,
    title: "Start with a photo you love",
    description: "A clear face is enough. The one that still feels like them.",
  },
  {
    icon: Heart,
    title: "Add their name",
    description: "A name, a few words, or nothing extra. Keep it as simple as you need.",
  },
  {
    icon: Sparkles,
    title: "Receive a gentle tribute",
    description: "A personal card or portrait made to honor a memory, not to entertain.",
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
  return (
    <>
      <PageHead
        title="Pet Loss Remembrance Cards"
        description="Honor a beloved pet with a gentle remembrance portrait or sympathy card. Made from one photo, with their name, in a quiet and meaningful style."
        image={HERO_IMAGE}
      />

      <main className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-black text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,122,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(100,116,139,0.18),transparent_32%)]" />

        <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div>
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
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl">
              <img
                src={HERO_IMAGE}
                alt="A gentle portrait of a beloved dog"
                className="h-[420px] w-full object-cover sm:h-[520px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/80">
                  In memory
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  A keepsake for the ones we still talk about.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <MessageCircleHeart className="mb-4 h-6 w-6 text-amber-200" />
              <h2 className="text-xl font-bold">For you</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Keep a portrait that feels like them. A quiet reminder of a
                companion who made the house feel like home.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <Heart className="mb-4 h-6 w-6 text-stone-200" />
              <h2 className="text-xl font-bold">For someone grieving</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Send a sympathy card when words are hard. Soft, personal, and
                made from a photo of the pet they loved.
              </p>
            </div>
          </div>

          <div className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              How it works
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
                        0{index + 1}
                      </span>
                      <Icon className="h-5 w-5 text-amber-200/90" />
                    </div>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/65">
                      {step.description}
                    </p>
                  </div>
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
                className="hidden text-sm font-semibold text-amber-100/90 hover:text-amber-50 sm:inline-flex"
              >
                Start with a photo
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {styles.map((item) => (
                <Link
                  key={item.title}
                  to={CREATE_HREF}
                  className="group rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-amber-100/30 hover:bg-white/[0.07]"
                >
                  <h3 className="text-lg font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    {item.description}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-100">
                    Create this
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-16 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <h2 className="text-2xl font-bold">A few quiet answers</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {faqs.map((item) => (
                <div key={item.question}>
                  <h3 className="font-semibold text-white">{item.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
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
