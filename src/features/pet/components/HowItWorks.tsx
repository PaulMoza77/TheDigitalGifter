import { PET_HOW_IT_WORKS } from "../catalog";

export function HowItWorks() {
  return (
    <section aria-labelledby="pet-how-heading">
      <h2 id="pet-how-heading" className="text-2xl font-semibold tracking-tight text-[#f6efe4] sm:text-3xl">
        How it works
      </h2>
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {PET_HOW_IT_WORKS.map((item) => (
          <li key={item.step} className="rounded-2xl border border-[#f6efe4]/10 px-4 py-4">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#d4a84b]">
              {String(item.step).padStart(2, "0")}
            </span>
            <h3 className="mt-2 text-lg font-semibold text-[#f6efe4]">{item.title}</h3>
            <p className="mt-1 text-sm leading-6 text-[#f6efe4]/65">{item.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
