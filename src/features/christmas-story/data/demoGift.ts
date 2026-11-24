import type { StoryGiftContent } from "../types";

/** Fictional sample — never present as a real customer testimonial. */
export const DEMO_RECIPIENT_TOKEN = "demo-emma-christmas-story";

const STILL = "/assets/christmas-story-demo/stills";

export const DEMO_GIFT: StoryGiftContent = {
  welcomeTitle: "Emma, this Christmas is all about you.",
  fromName: "Jordan",
  dedication:
    "Emma — for the way you turn ordinary evenings into something we both remember. This is our story, set to music.",
  storyParagraphs: [
    "This sample gift was created with fictional details to show the experience. It is not a real customer order.",
    "The memory film below uses licensed stock photography arranged as a fictional Christmas sequence — not Emma’s private photos.",
    "In a real gift, every photograph comes from what the buyer actually uploads. We never invent biographical facts.",
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
    status: "pending",
    commercialRightsNote:
      "Demo song unavailable — no authorized commercial master is attached yet. Lyrics only.",
  },
  film: {
    id: "demo-film-emma",
    title: "Memories for Emma",
    frames: [
      // Captions stay atmospheric and honest — stock stills, not Emma's private moments.
      { src: `${STILL}/01-tree.jpg`, caption: "Evergreen light" },
      { src: `${STILL}/02-gifts.jpg`, caption: "Wrapped and waiting" },
      { src: `${STILL}/03-ornaments.jpg`, caption: "Glass and gold" },
      { src: `${STILL}/04-cocoa.jpg`, caption: "Something warm" },
      { src: `${STILL}/05-lights.jpg`, caption: "A glow in the dark" },
      { src: `${STILL}/06-snow.jpg`, caption: "Winter outside" },
      { src: `${STILL}/07-fireplace.jpg`, caption: "Firelight" },
      // 08-table omitted from gallery: stock framing read as non-gift context in QA.
    ],
    videoUrl: "/assets/christmas-story-demo/emma-memory-film.mp4",
    isExample: true,
    status: "ready",
  },
  surpriseLabel: "Open when you miss me",
  surpriseReveal:
    "If you ever miss me this winter, play this song again. I am closer than the miles between us.",
  finalMessage:
    "Merry Christmas, Emma. One story. One gift made only for you.",
};
