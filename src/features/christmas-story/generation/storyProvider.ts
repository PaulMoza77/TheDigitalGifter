import type { StoryGiftDraft } from "../types";
import type { StoryProvider } from "./providers";

function relLabel(r: StoryGiftDraft["relationship"]): string {
  switch (r) {
    case "partner":
    case "spouse":
      return "the person who holds your heart";
    case "parent":
      return "a parent who shaped your world";
    case "child":
      return "someone you are endlessly proud of";
    case "sibling":
      return "family in the truest sense";
    case "friend":
      return "a friend who feels like home";
    case "family":
      return "family you cherish";
    default:
      return "someone who matters deeply";
  }
}

/** Deterministic, non-fabricating story from buyer inputs only. */
export const mockStoryProvider: StoryProvider = {
  id: "mock-story-v1",
  async generate(draft) {
    const name = draft.recipientName.trim() || "them";
    const special = draft.whatMakesThemSpecial.trim();
    const memories = draft.memories.map((m) => m.trim()).filter(Boolean);
    const places = draft.places.map((p) => p.trim()).filter(Boolean);
    const dedication =
      draft.dedication.trim() ||
      (special
        ? `${name}, this Christmas I wanted you to feel how much you mean to me — especially because ${special}.`
        : `${name}, this Christmas I wanted you to feel how much you mean to me.`);

    const paragraphs: string[] = [
      `This gift was made for ${name} — ${relLabel(draft.relationship)}.`,
    ];
    if (special) {
      paragraphs.push(`What makes them special to you: ${special}`);
    }
    if (memories.length) {
      paragraphs.push(`Memories you chose to keep close: ${memories.join("; ")}.`);
    } else {
      paragraphs.push(
        "You can add specific memories later — we will never invent biographical details you did not share.",
      );
    }
    if (places.length) {
      paragraphs.push(`Places that matter in your story: ${places.join(", ")}.`);
    }

    return {
      welcomeTitle: `${name}, this Christmas is all about you.`,
      dedication,
      storyParagraphs: paragraphs,
      finalMessage:
        draft.surpriseMessage.trim() ||
        `Wherever this season finds you, know that you are loved — and remembered — by someone who chose these words for you alone.`,
    };
  },
};
