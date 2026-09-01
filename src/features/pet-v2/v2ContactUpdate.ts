import { PetApiError, type PetFunnelApi } from "../pet/api";
import { validatePetName } from "../pet/croGuards";
import { v2BootstrapContact } from "./v2CheckoutHold";
import { getPetV2SessionId } from "./session";
import type { PetV2Species } from "./types";

export const V2_CONTACT_UPDATE_ERROR = "Could not save your details. Try again.";

/**
 * Optional V2 gallery fields. Empty form skips the network call.
 * Pet-name-only still sends the bootstrap pending+ email; the Edge function
 * treats that as "keep existing order email" so Apple Pay / Express is not blocked.
 */
export async function validateAndUpdateV2OrderContact(input: {
  api: PetFunnelApi;
  orderId: string;
  publicToken: string;
  petName?: string;
  email?: string;
  species?: PetV2Species;
  funnelSessionId?: string;
}): Promise<
  | { ok: true; petName: string; email: string; stripeSessionSynced?: boolean }
  | { ok: false; error: string; focusId?: string }
> {
  const species = input.species ?? "dog";
  const bootstrap = v2BootstrapContact(input.funnelSessionId ?? getPetV2SessionId(), species);
  let petName = bootstrap.petName;
  let email = bootstrap.email;
  const hasPetName = Boolean(input.petName?.trim());
  const hasEmail = Boolean(input.email?.trim());

  // Both optional — empty form keeps bootstrap placeholders and skips the network call.
  if (!hasPetName && !hasEmail) {
    return { ok: true, petName, email };
  }

  if (hasPetName) {
    const named = validatePetName(input.petName);
    if (!named.ok) {
      return { ok: false, error: named.message, focusId: "v2-pet-name" };
    }
    petName = named.name;
  }

  if (hasEmail) {
    const trimmed = input.email!.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { ok: false, error: "Enter a valid email address.", focusId: "v2-email" };
    }
    email = trimmed;
  }

  try {
    // Pet-name-only still sends the bootstrap pending+ email; the Edge function treats that
    // as "keep existing order email" so Apple Pay is not blocked by optional fields.
    const updated = await input.api.updateOrderContact({
      orderId: input.orderId,
      publicToken: input.publicToken,
      email,
      petName,
    });
    if (!updated?.updated) {
      // Fail open for pet-name-only: never block Apple Pay / Express on optional name save.
      if (hasPetName && !hasEmail) {
        console.info("[v2-contact-update]", { ok: false, failOpen: true, petNameOnly: true });
        return { ok: true, petName, email };
      }
      return {
        ok: false,
        error: V2_CONTACT_UPDATE_ERROR,
        focusId: hasEmail ? "v2-email" : "v2-pet-name",
      };
    }
    if (updated.stripeSessionSynced === false) {
      console.info("[v2-contact-update]", {
        ok: true,
        stripeSessionSynced: false,
        fulfillmentUsesInternalEmail: true,
        petNameOnly: hasPetName && !hasEmail,
      });
    }
    return {
      ok: true,
      petName,
      email: updated.email || email,
      stripeSessionSynced: updated.stripeSessionSynced,
    };
  } catch (caught) {
    // Pet-name-only must not block wallets if Edge is temporarily rejecting placeholders.
    if (hasPetName && !hasEmail) {
      console.info("[v2-contact-update]", {
        ok: false,
        failOpen: true,
        petNameOnly: true,
        reason: caught instanceof Error ? caught.name : "error",
      });
      return { ok: true, petName, email };
    }
    if (caught instanceof PetApiError) {
      const apiMessage = caught.message.trim();
      if (/valid email/i.test(apiMessage)) {
        return { ok: false, error: "Enter a valid email address.", focusId: "v2-email" };
      }
      return {
        ok: false,
        error: V2_CONTACT_UPDATE_ERROR,
        focusId: "v2-email",
      };
    }
    return {
      ok: false,
      error: V2_CONTACT_UPDATE_ERROR,
      focusId: "v2-email",
    };
  }
}
