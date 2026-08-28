/** Client-side species confirmation before free preview generation. */

export type SpeciesConfirmKind = "dog" | "cat";

export function speciesConfirmLabel(kind: SpeciesConfirmKind): string {
  return kind === "cat"
    ? "I confirm this photo shows my cat (not a dog or other animal)."
    : "I confirm this photo shows my dog (not a cat or other animal).";
}

export function speciesConfirmRequiredError(kind: SpeciesConfirmKind): string {
  return kind === "cat"
    ? "This experience is designed for cats. Please confirm the photo shows your cat, or upload a clear cat photo."
    : "This experience is designed for dogs. Please confirm the photo shows your dog, or upload a clear dog photo.";
}

export function canGenerateWithSpeciesConfirm(input: {
  hasPhoto: boolean;
  confirmed: boolean;
  kind: SpeciesConfirmKind | null;
}): { ok: true } | { ok: false; message: string } {
  if (!input.hasPhoto) {
    return { ok: false, message: "Choose a photo first." };
  }
  if (input.kind && !input.confirmed) {
    return { ok: false, message: speciesConfirmRequiredError(input.kind) };
  }
  return { ok: true };
}
