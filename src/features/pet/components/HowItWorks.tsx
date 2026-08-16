import { PET_HOW_IT_WORKS } from "../catalog";

export function HowItWorks() {
  return (
    <section aria-labelledby="pet-how-heading" className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.22em] text-[#d4a84b]">How it works</p>
        <h2 id="pet-how-heading" className="mt-2 text-3xl font-semibold tracking-tight text-[#f6efe4]">
          Three steps. Twelve portraits.
        </h2>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {PET_HOW_IT_WORKS.map((item) => (
          <li
            key={item.step}
            className="rounded-3xl border border-[#f6efe4]/10 bg-[#1f1712]/80 p-5"
          >
            <span className="text-xs uppercase tracking-[0.2em] text-[#d4a84b]">
              Step {item.step}
            </span>
            <h3 className="mt-3 text-xl font-semibold text-[#f6efe4]">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#f6efe4]/70">{item.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
