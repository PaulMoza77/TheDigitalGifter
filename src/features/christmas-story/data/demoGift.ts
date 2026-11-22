import type { StoryGiftContent } from "../types";

/** Fictional sample — never present as a real customer testimonial. */
export const DEMO_RECIPIENT_TOKEN = "demo-emma-christmas-story";

export const DEMO_GIFT: StoryGiftContent = {
  welcomeTitle: "Emma, this Christmas is all about you.",
  fromName: "Jordan",
  dedication:
    "Emma — for the way you turn ordinary evenings into something we both remember. This is our story, set to music.",
  storyParagraphs: [
    "This sample gift was created with fictional details to show the experience. It is not a real customer order.",
    "Jordan wanted Emma to hear her name in a song, see a short film of shared memories, and find one quiet surprise waiting at the end.",
    "In a real gift, every line comes from what the buyer actually shares — we never invent biographical facts.",
  ],
  song: {
    id: "demo-song-emma",
    title: "For Emma",
    audioUrl: null,
    coverLabel: "Emma",
    lyrics: [
      { timeMs: 0, text: "Emma, this night belongs to you" },
      { timeMs: 4000, text: "For every quiet kindness, every truth" },
      { timeMs: 8000, text: "The way you light up ordinary days" },
      { timeMs: 12000, text: "I wrote this song so you would know" },
      { timeMs: 16000, text: "How deeply you are loved when winter falls like snow" },
    ],
    isExample: true,
    provider: "mock",
    status: "ready",
    commercialRightsNote: "Example demonstration tone — not a commercial master.",
  },
  film: {
    id: "demo-film-emma",
    title: "Memories for Emma",
    frames: [
      {
        src: "",
        caption: "Soft morning light — the kitchen table where you always sit.",
      },
      {
        src: "",
        caption: "That train ride home when the city looked like gold.",
      },
      {
        src: "",
        caption: "Laughter we still hear when December gets quiet.",
      },
      {
        src: "",
        caption: "A promise kept: we show up for each other.",
      },
    ],
    videoUrl: null,
    isExample: true,
    status: "ready",
  },
  surpriseLabel: "Open when you miss me",
  surpriseReveal:
    "If you ever miss me this winter, play this song again. I am closer than the miles between us.",
  finalMessage:
    "Merry Christmas, Emma. One story. One gift made only for you.",
};
