/** Visual mood presets for the Christmas Gift suite scene. */

export type GiftSceneMood = "alpine_suite" | "candlelit_lobby" | "frosted_lounge";

export type GiftCtaStyle = "champagne_gold" | "ember_rose" | "ivory_outline";

export type GiftBoxTheme = "mystery_velvet" | "heritage_foil" | "ivory_satin";

export type SceneMoodDef = {
  id: GiftSceneMood;
  label: string;
  roomWarmth: string;
  windowSky: string;
  carpet: string;
  wood: string;
  accentGlow: string;
};

export const SCENE_MOODS: Record<GiftSceneMood, SceneMoodDef> = {
  alpine_suite: {
    id: "alpine_suite",
    label: "Alpine Suite",
    roomWarmth: "#2a1c16",
    windowSky: "linear-gradient(180deg, #0b1524 0%, #1a2740 55%, #3a4a5c 100%)",
    carpet: "#3d2a22",
    wood: "#4a3226",
    accentGlow: "rgba(212, 175, 110, 0.28)",
  },
  candlelit_lobby: {
    id: "candlelit_lobby",
    label: "Candlelit Lobby",
    roomWarmth: "#241810",
    windowSky: "linear-gradient(180deg, #120c08 0%, #2a1a10 50%, #4a3020 100%)",
    carpet: "#3a2418",
    wood: "#3d281c",
    accentGlow: "rgba(255, 170, 90, 0.22)",
  },
  frosted_lounge: {
    id: "frosted_lounge",
    label: "Frosted Lounge",
    roomWarmth: "#1a2024",
    windowSky: "linear-gradient(180deg, #0a1218 0%, #152030 50%, #2a3a48 100%)",
    carpet: "#2a3038",
    wood: "#2e363c",
    accentGlow: "rgba(180, 210, 230, 0.18)",
  },
};

export const CTA_STYLES: Record<
  GiftCtaStyle,
  { label: string; className: string; subClassName: string }
> = {
  champagne_gold: {
    label: "Champagne Gold",
    className:
      "bg-gradient-to-b from-[#f3e2b5] via-[#e0c078] to-[#c9a35a] text-[#2a1c0e] shadow-[0_12px_40px_rgba(201,163,90,0.35)]",
    subClassName: "text-[#4a3820]/75",
  },
  ember_rose: {
    label: "Ember Rose",
    className:
      "bg-gradient-to-b from-[#f0b8a8] via-[#d4786a] to-[#b24a42] text-[#1a0c0a] shadow-[0_12px_40px_rgba(178,74,66,0.35)]",
    subClassName: "text-[#3a1814]/80",
  },
  ivory_outline: {
    label: "Ivory Outline",
    className:
      "bg-white/10 text-amber-50 border border-amber-100/35 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
    subClassName: "text-amber-100/70",
  },
};

export const BOX_THEMES: Record<
  GiftBoxTheme,
  { label: string; mysteryMark: boolean; lidSheen: string }
> = {
  mystery_velvet: {
    label: "Mystery Velvet",
    mysteryMark: true,
    lidSheen: "rgba(255,255,255,0.22)",
  },
  heritage_foil: {
    label: "Heritage Foil",
    mysteryMark: false,
    lidSheen: "rgba(255,230,170,0.28)",
  },
  ivory_satin: {
    label: "Ivory Satin",
    mysteryMark: false,
    lidSheen: "rgba(255,255,255,0.4)",
  },
};

/** Default production look — can be switched via UI for founder review. */
export const DEFAULT_SCENE_MOOD: GiftSceneMood = "alpine_suite";
export const DEFAULT_CTA_STYLE: GiftCtaStyle = "champagne_gold";
export const DEFAULT_BOX_THEME: GiftBoxTheme = "mystery_velvet";
