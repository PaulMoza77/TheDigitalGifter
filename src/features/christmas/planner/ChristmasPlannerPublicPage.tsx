import { Link } from "react-router-dom";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";

export default function ChristmasPlannerPublicPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 text-zinc-100">
      <ChristmasPageHead path="/christmas/planner" />
      <p className="text-xs uppercase tracking-[0.18em] text-amber-200/80">Christmas Planner</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight">A personal Christmas command center</h1>
      <p className="mt-4 text-lg text-zinc-300">
        Know how many days are left, how ready you are, what to do next, whether you’re on budget, and which gifts are
        still open — without a spreadsheet or a 20-form dashboard.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/account/christmas"
          className="inline-flex min-h-12 items-center rounded-full bg-amber-200 px-5 font-semibold text-zinc-900"
        >
          Start free planner
        </Link>
        <Link to="/christmas/gift-finder" className="inline-flex min-h-12 items-center rounded-full border border-white/20 px-5">
          Gift Finder
        </Link>
      </div>

      <section className="mt-12 space-y-4">
        <h2 className="text-2xl">What is a Christmas planner?</h2>
        <p className="text-zinc-300">
          It’s a private plan for the season you’re in. In September you get a longer runway. In November it compresses.
          In late December it becomes a rescue plan. After Christmas it helps you capture notes for next year.
        </p>
      </section>
      <section className="mt-10 space-y-4">
        <h2 className="text-2xl">Christmas gift planner</h2>
        <p className="text-zinc-300">
          Track people you’re buying for — idea, ordered, wrapped, given — separate from your public wishlist. Need an
          idea? Jump into the existing Gift Finder and add a result back to that person.
        </p>
      </section>
      <section className="mt-10 space-y-4">
        <h2 className="text-2xl">Christmas budget planner</h2>
        <p className="text-zinc-300">
          One season budget with simple categories. Gift prices roll in. Remaining is visible without accounting software.
        </p>
      </section>
      <section className="mt-10 space-y-4">
        <h2 className="text-2xl">Christmas meal & hosting planner</h2>
        <p className="text-zinc-300">
          Build Christmas Eve and Day menus, roll a grocery list, and keep a guest list with dietary notes. Original TDG
          recipes can be included in a tier, sold as an add-on, or offered as free teasers.
        </p>
      </section>
      <section className="mt-10 space-y-4" id="pricing">
        <h2 className="text-2xl">Start free, unlock packs</h2>
        <p className="text-zinc-300">
          Free includes countdown, onboarding, a basic dashboard, a short task list, and up to three gift people. Core
          unlocks gifts, budget, and rescue mode. Food, recipes, hosting, and travel are separate add-ons so packages can
          change without rewriting the product. Checkout uses the same Christmas commerce system as portraits and Santa —
          no second store.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-zinc-300">
          <li>Core — €14.99 season</li>
          <li>Complete — €24.99 season</li>
          <li>Food / recipes / hosting / travel add-ons</li>
        </ul>
      </section>
      <section className="mt-10 space-y-4">
        <h2 className="text-2xl">Christmas planning timeline</h2>
        <p className="text-zinc-300">
          Your checklist is generated from today’s date plus hosting, travel, children, and gift count. You can complete,
          skip, reschedule, or add your own tasks.
        </p>
      </section>
      <p className="mt-12 text-sm text-zinc-400">
        Also explore{" "}
        <Link className="underline" to="/christmas">
          Christmas Club
        </Link>
        ,{" "}
        <Link className="underline" to="/christmas/wishlist">
          Wishlist
        </Link>
        , and{" "}
        <Link className="underline" to="/christmas/messages">
          Christmas messages
        </Link>
        .
      </p>
    </div>
  );
}
