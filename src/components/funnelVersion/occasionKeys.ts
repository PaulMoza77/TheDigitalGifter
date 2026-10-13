/** Occasion strings stored on templates are not consistent (hyphen vs underscore). */
export function occasionLookupKeys(...raws: Array<string | null | undefined>): string[] {
  const keys = new Set<string>();

  for (const raw of raws) {
    const value = String(raw ?? "").trim().toLowerCase();
    if (!value) continue;
    keys.add(value);
    keys.add(value.replace(/-/g, "_"));
    keys.add(value.replace(/_/g, "-"));
  }

  const blob = ` ${[...keys].join(" ")} `;
  if (blob.includes(" newborn ") || blob.includes(" new-born ") || blob.includes(" new_born ")) {
    keys.add("newborn");
    keys.add("new-born");
    keys.add("new_born");
  }
  if (blob.includes(" thankyou ") || blob.includes(" thank-you ") || blob.includes(" thank_you ")) {
    keys.add("thankyou");
    keys.add("thank-you");
    keys.add("thank_you");
  }

  return [...keys];
}
