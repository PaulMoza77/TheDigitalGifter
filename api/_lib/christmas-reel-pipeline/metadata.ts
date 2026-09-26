import type { PlatformMetadata } from "./types";

function pickHashtags(tags: string[]): string {
  const pool = [
    "#Christmas",
    "#ChristmasTime",
    "#ChristmasMagic",
    "#Winter",
    "#Snow",
    "#SantaClaus",
    "#ChristmasDecor",
    "#CozyChristmas",
    "#ChristmasTrain",
    "#HolidaySeason",
    "#Christmas2026",
    "#TheDigitalGifter",
  ];
  const chosen = new Set<string>();
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (key.includes("train")) chosen.add("#ChristmasTrain");
    if (key.includes("snow") || key.includes("winter")) chosen.add("#Winter");
    if (key.includes("santa")) chosen.add("#SantaClaus");
    if (key.includes("cozy") || key.includes("fireplace")) chosen.add("#CozyChristmas");
    if (key.includes("decor") || key.includes("tree")) chosen.add("#ChristmasDecor");
    if (key.includes("luxury") || key.includes("cinematic")) chosen.add("#ChristmasMagic");
  }
  chosen.add("#Christmas");
  chosen.add("#TheDigitalGifter");
  for (const tag of pool) {
    if (chosen.size >= 8) break;
    if (!chosen.has(tag)) chosen.add(tag);
  }
  return [...chosen].slice(0, 8).join(" ");
}

function hookForTags(tags: string[], title: string): string {
  if (tags.includes("train")) return "Would you ride this Christmas train?";
  if (tags.includes("fireplace") || tags.includes("cozy")) return "Would you spend Christmas here?";
  if (tags.includes("santa") || tags.includes("magical")) return "Who would you take to this Christmas moment?";
  if (tags.includes("snow")) return "Which snowy Christmas scene feels most like home?";
  if (tags.includes("luxury")) return "Would you unwrap Christmas in a place like this?";
  return `Which Christmas scene from ${title.trim() || "this reel"} speaks to you?`;
}

export function buildPlatformMetadata(input: {
  title: string;
  contentTags: string[];
}): PlatformMetadata {
  const hook = hookForTags(input.contentTags, input.title);
  const hashtags = pickHashtags(input.contentTags);
  const captionBody = `${hook} 🎄`;
  const instagramCaption = `${captionBody}\n\n${hashtags}`;
  const facebookCaption = instagramCaption;
  const ytTitle = `${input.title.replace(/\s+/g, " ").trim().slice(0, 70) || "Christmas Short"} | The Digital Gifter`.slice(
    0,
    100,
  );
  const ytDescription = `${captionBody}\n\n${hashtags}\n\n#Shorts`.slice(0, 5000);
  return {
    hook,
    cta: hook,
    contentTags: input.contentTags,
    instagram: { caption: instagramCaption, hashtags },
    facebook: { caption: facebookCaption, hashtags },
    youtube: {
      title: ytTitle,
      description: ytDescription,
      hashtags,
      tags: input.contentTags.slice(0, 12),
    },
  };
}

export function autopilotCaption(metadata: PlatformMetadata, fallbackTitle: string): string {
  return metadata.instagram?.caption || metadata.facebook?.caption || fallbackTitle;
}
