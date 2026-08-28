/** Client gate: customer must affirm the preview looks like their pet before unlock. */

export type IdentityConfirmKind = "dog" | "cat" | "pet";

export function identityConfirmLabel(kind: IdentityConfirmKind): string {
  if (kind === "cat") return "Yes — this looks like my cat (same face, fur, and markings).";
  if (kind === "pet") return "Yes — this looks like my pet (same face, fur, and markings).";
  return "Yes — this looks like my dog (same face, fur, and markings).";
}

export function identityConfirmRequiredError(kind: IdentityConfirmKind): string {
  if (kind === "cat") {
    return "If this does not look like your cat, tap Try another preview or upload a clearer photo before unlocking.";
  }
  if (kind === "pet") {
    return "If this does not look like your pet, tap Try another preview or upload a clearer photo before unlocking.";
  }
  return "If this does not look like your dog, tap Try another preview or upload a clearer photo before unlocking.";
}

export function canUnlockWithIdentityConfirm(input: {
  confirmed: boolean;
  kind: IdentityConfirmKind;
}): { ok: true } | { ok: false; message: string } {
  if (!input.confirmed) {
    return { ok: false, message: identityConfirmRequiredError(input.kind) };
  }
  return { ok: true };
}
