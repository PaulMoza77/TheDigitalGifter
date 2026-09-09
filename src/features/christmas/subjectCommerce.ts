/**
 * Resolve commerce product + style catalog from hub subject choice.
 */

import type { ChristmasStyleDef } from "./styles";
import {
  CHRISTMAS_COUPLE_STYLES,
  CHRISTMAS_FAMILY_STYLES,
  CHRISTMAS_PET_STYLES,
  CHRISTMAS_PHOTO_STYLES,
} from "./portraitStyles";
import type { ChristmasPortraitSubjectChoice } from "./portraitTypes";
import type { PortraitSubject } from "./portraitVerticals";

export type SubjectCommerce = {
  productKey: "christmas_photo" | "christmas_family" | "christmas_couple" | "christmas_pet";
  portraitType: PortraitSubject;
  styles: ChristmasStyleDef[];
  species: "dog" | "cat" | "any" | null;
};

export function commerceForSubjectChoice(
  choice: ChristmasPortraitSubjectChoice | null | undefined,
): SubjectCommerce {
  switch (choice) {
    case "family":
      return {
        productKey: "christmas_family",
        portraitType: "family",
        styles: CHRISTMAS_FAMILY_STYLES,
        species: null,
      };
    case "couple":
      return {
        productKey: "christmas_couple",
        portraitType: "couple",
        styles: CHRISTMAS_COUPLE_STYLES,
        species: null,
      };
    case "pet":
      return {
        productKey: "christmas_pet",
        portraitType: "pet",
        styles: CHRISTMAS_PET_STYLES,
        species: "any",
      };
    case "person_pet":
      return {
        productKey: "christmas_photo",
        portraitType: "person",
        styles: CHRISTMAS_PHOTO_STYLES,
        species: null,
      };
    case "person":
    default:
      return {
        productKey: "christmas_photo",
        portraitType: "person",
        styles: CHRISTMAS_PHOTO_STYLES,
        species: null,
      };
  }
}
