import { PET_TESTIMONIALS } from "../catalog";

export function SocialProof() {
  if (!PET_TESTIMONIALS.length) return null;

  return (
    <section aria-labelledby="pet-social-heading" className="space-y-4">
      <h2 id="pet-social-heading" className="text-2xl font-semibold tracking-tight text-[#f6efe4]">
        From pet parents
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {PET_TESTIMONIALS.map((item) => (
          <li key={`${item.customerFirstName}-${item.petName}`} className="rounded-2xl border border-[#f6efe4]/10 p-4">
            <p className="text-sm leading-6 text-[#f6efe4]/80">“{item.quote}”</p>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#f6efe4]/50">
              {item.customerFirstName} · {item.petName} · {item.species}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
