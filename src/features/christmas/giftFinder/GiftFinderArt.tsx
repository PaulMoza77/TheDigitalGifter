/** Illustrated gift motifs — SVG art keyed by idea category / title cues. */

import type { CSSProperties, ReactElement } from "react";

type ArtProps = { className?: string; style?: CSSProperties };

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function resolveGiftArtKey(idea: {
  title: string;
  category: string;
  tdg_product_key?: string | null;
}): GiftArtKey {
  if (idea.tdg_product_key) return "portrait";
  const t = `${idea.title} ${idea.category}`.toLowerCase();
  if (/herb|garden|plant|botanic|flower/.test(t)) return "garden";
  if (/coffee|mug|tea|pour/.test(t)) return "coffee";
  if (/pet|dog|cat|animal/.test(t)) return "pet";
  if (/cook|chef|spice|kitchen|skillet|knife/.test(t)) return "cooking";
  if (/music|headphone|earbud|audio/.test(t)) return "music";
  if (/book|read|photo book|museum|class|experience|membership|ticket/.test(t)) return "experience";
  if (/blanket|cozy|throw|candle|sock/.test(t)) return "cozy";
  if (/tech|wireless|phone|camera|gadget/.test(t)) return "tech";
  if (idea.category === "digital") return "digital";
  if (idea.category === "experience") return "experience";
  return "gift";
}

export type GiftArtKey =
  | "gift"
  | "garden"
  | "coffee"
  | "pet"
  | "cooking"
  | "music"
  | "experience"
  | "cozy"
  | "tech"
  | "digital"
  | "portrait";

const ART: Record<GiftArtKey, (p: ArtProps) => ReactElement> = {
  gift: GiftBoxArt,
  garden: GardenArt,
  coffee: CoffeeArt,
  pet: PetArt,
  cooking: CookingArt,
  music: MusicArt,
  experience: ExperienceArt,
  cozy: CozyArt,
  tech: TechArt,
  digital: DigitalArt,
  portrait: PortraitArt,
};

export function GiftIdeaArt({
  artKey,
  seed,
  className,
}: {
  artKey: GiftArtKey;
  seed: string;
  className?: string;
}) {
  const Comp = ART[artKey] || GiftBoxArt;
  const hueShift = hashHue(seed) % 18;
  return (
    <div
      className={className}
      style={{ filter: hueShift > 9 ? `hue-rotate(${hueShift}deg)` : undefined }}
      aria-hidden="true"
    >
      <Comp className="h-full w-full" />
    </div>
  );
}

function GiftBoxArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none">
      <rect width="120" height="120" rx="28" fill="url(#gfGiftBg)" />
      <defs>
        <linearGradient id="gfGiftBg" x1="20" y1="10" x2="100" y2="110">
          <stop stopColor="#1B4332" />
          <stop offset="1" stopColor="#0F2A20" />
        </linearGradient>
      </defs>
      <rect x="28" y="48" width="64" height="46" rx="6" fill="#C1121F" />
      <rect x="28" y="38" width="64" height="16" rx="4" fill="#E5383B" />
      <rect x="54" y="38" width="12" height="56" fill="#D4A017" />
      <rect x="28" y="52" width="64" height="10" fill="#D4A017" />
      <path d="M60 38c-8-14-18-14-18-6 0 8 12 12 18 18 6-6 18-10 18-18 0-8-10-8-18 6Z" fill="#F4D35E" />
    </svg>
  );
}

function GardenArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none">
      <rect width="120" height="120" rx="28" fill="#14281F" />
      <ellipse cx="60" cy="92" rx="28" ry="8" fill="#0B1A14" opacity=".5" />
      <path d="M60 88V42" stroke="#2D6A4F" strokeWidth="4" strokeLinecap="round" />
      <path d="M60 58c-16-4-22-18-18-28 12 4 18 14 18 28Z" fill="#40916C" />
      <path d="M60 52c16-2 24-14 20-26-12 6-18 14-20 26Z" fill="#52B788" />
      <path d="M60 70c-14 2-20 12-16 22 10-2 14-10 16-22Z" fill="#2D6A4F" />
      <circle cx="42" cy="34" r="5" fill="#E5383B" />
      <circle cx="82" cy="30" r="4" fill="#F4D35E" />
      <rect x="42" y="86" width="36" height="14" rx="3" fill="#B08968" />
    </svg>
  );
}

function CoffeeArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none">
      <rect width="120" height="120" rx="28" fill="#2A1A12" />
      <path d="M38 48h40c2 0 4 2 4 4v28c0 10-8 18-18 18H52c-10 0-18-8-18-18V52c0-2 2-4 4-4Z" fill="#F4EDE4" />
      <path d="M82 56h8c6 0 10 4 10 10s-4 10-10 10h-8" stroke="#D4A017" strokeWidth="4" />
      <path d="M44 56h32v8H44z" fill="#6F4E37" />
      <path d="M50 36c0 6 4 8 4 12M60 34c0 6 4 8 4 12M70 36c0 6 4 8 4 12" stroke="#E8D5B7" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      <ellipse cx="60" cy="98" rx="26" ry="5" fill="#1A100C" opacity=".35" />
    </svg>
  );
}

function PetArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none">
      <rect width="120" height="120" rx="28" fill="#1E2A24" />
      <ellipse cx="60" cy="72" rx="28" ry="24" fill="#C4A484" />
      <circle cx="42" cy="42" r="12" fill="#C4A484" />
      <circle cx="78" cy="42" r="12" fill="#C4A484" />
      <circle cx="48" cy="66" r="4" fill="#1A120B" />
      <circle cx="72" cy="66" r="4" fill="#1A120B" />
      <ellipse cx="60" cy="78" rx="6" ry="4" fill="#1A120B" />
      <path d="M52 86c4 4 12 4 16 0" stroke="#8B5E3C" strokeWidth="2" strokeLinecap="round" />
      <path d="M34 28l8 6M86 28l-8 6" stroke="#C1121F" strokeWidth="3" strokeLinecap="round" />
      <circle cx="92" cy="24" r="5" fill="#D4A017" />
    </svg>
  );
}

function CookingArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none">
      <rect width="120" height="120" rx="28" fill="#1A2218" />
      <ellipse cx="60" cy="78" rx="34" ry="10" fill="#2D3A2E" />
      <path d="M30 74c0-18 14-32 30-32s30 14 30 32" stroke="#8B9A7D" strokeWidth="5" />
      <rect x="54" y="28" width="12" height="18" rx="3" fill="#D4A017" />
      <circle cx="40" cy="58" r="4" fill="#E5383B" />
      <circle cx="78" cy="54" r="3" fill="#52B788" />
      <path d="M48 48c4-8 12-8 16 0" stroke="#F4EDE4" strokeWidth="2" opacity=".5" />
    </svg>
  );
}

function MusicArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none">
      <rect width="120" height="120" rx="28" fill="#161B2A" />
      <circle cx="44" cy="78" r="14" fill="#C1121F" />
      <circle cx="78" cy="66" r="12" fill="#D4A017" />
      <path d="M58 78V36l34-8v40" stroke="#F4EDE4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="58" cy="78" r="6" fill="#F4EDE4" />
      <circle cx="92" cy="68" r="5" fill="#F4EDE4" />
    </svg>
  );
}

function ExperienceArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none">
      <rect width="120" height="120" rx="28" fill="#1B2838" />
      <rect x="22" y="36" width="76" height="48" rx="8" fill="#F4EDE4" />
      <path d="M22 60h76" stroke="#C1121F" strokeWidth="3" strokeDasharray="4 4" />
      <circle cx="22" cy="60" r="7" fill="#1B2838" />
      <circle cx="98" cy="60" r="7" fill="#1B2838" />
      <rect x="34" y="44" width="28" height="6" rx="2" fill="#D4A017" />
      <rect x="34" y="70" width="40" height="4" rx="2" fill="#9CA3AF" />
      <text x="78" y="54" fill="#C1121F" fontSize="14" fontFamily="serif" fontWeight="700">
        ★
      </text>
    </svg>
  );
}

function CozyArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none">
      <rect width="120" height="120" rx="28" fill="#2A1F1A" />
      <path d="M24 78c8-24 24-36 36-36s28 12 36 36" fill="#C45C26" />
      <path d="M30 78c6-16 18-26 30-26s24 10 30 26" fill="#E07A3D" opacity=".85" />
      <rect x="28" y="76" width="64" height="14" rx="4" fill="#8B4513" />
      <circle cx="60" cy="42" r="8" fill="#F4D35E" opacity=".9" />
      <path d="M54 28c2 4 4 6 6 8 2-2 4-4 6-8" stroke="#F4EDE4" strokeWidth="2" opacity=".5" />
    </svg>
  );
}

function TechArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none">
      <rect width="120" height="120" rx="28" fill="#121820" />
      <rect x="34" y="30" width="52" height="60" rx="10" fill="#1E293B" stroke="#D4A017" strokeWidth="2" />
      <rect x="40" y="38" width="40" height="36" rx="4" fill="#0EA5E9" opacity=".35" />
      <circle cx="60" cy="82" r="3" fill="#F4EDE4" />
      <path d="M48 52h24M48 60h16" stroke="#F4EDE4" strokeWidth="2" opacity=".5" strokeLinecap="round" />
    </svg>
  );
}

function DigitalArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none">
      <rect width="120" height="120" rx="28" fill="#1A1024" />
      <rect x="30" y="34" width="60" height="44" rx="6" fill="#F4EDE4" />
      <rect x="36" y="40" width="48" height="28" rx="3" fill="#1B4332" />
      <path d="M50 54l8 8 14-16" stroke="#D4A017" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="48" y="82" width="24" height="6" rx="2" fill="#C1121F" />
      <circle cx="88" cy="30" r="6" fill="#D4A017" opacity=".8" />
    </svg>
  );
}

function PortraitArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none">
      <rect width="120" height="120" rx="28" fill="#3B0610" />
      <rect x="26" y="24" width="68" height="72" rx="6" fill="#D4A017" />
      <rect x="32" y="30" width="56" height="56" rx="3" fill="#1B4332" />
      <circle cx="60" cy="52" r="12" fill="#F4EDE4" opacity=".9" />
      <path d="M42 78c6-10 30-10 36 0v4H42v-4Z" fill="#F4EDE4" opacity=".85" />
      <path d="M38 22h8M74 22h8M36 92h48" stroke="#F4D35E" strokeWidth="2" opacity=".6" />
    </svg>
  );
}

export function PineCorner({ className, style }: ArtProps) {
  return (
    <svg viewBox="0 0 160 120" className={className} style={style} fill="none" aria-hidden="true">
      <path d="M20 110 L50 40 L80 110Z" fill="#1B4332" />
      <path d="M45 110 L75 28 L105 110Z" fill="#2D6A4F" />
      <path d="M70 110 L100 48 L130 110Z" fill="#40916C" />
      <circle cx="75" cy="55" r="3" fill="#C1121F" />
      <circle cx="58" cy="72" r="2.5" fill="#D4A017" />
      <circle cx="92" cy="68" r="2.5" fill="#F4EDE4" />
      <rect x="72" y="100" width="8" height="14" fill="#5C4033" />
    </svg>
  );
}

export function OrnamentSvg({ className, style }: ArtProps) {
  return (
    <svg viewBox="0 0 48 64" className={className} style={style} fill="none" aria-hidden="true">
      <rect x="18" y="4" width="12" height="8" rx="2" fill="#D4A017" />
      <circle cx="24" cy="36" r="20" fill="#C1121F" />
      <circle cx="24" cy="36" r="14" fill="none" stroke="#F4D35E" strokeWidth="2" opacity=".7" />
      <path d="M24 18v36M10 36h28" stroke="#F4D35E" strokeWidth="1.5" opacity=".55" />
    </svg>
  );
}

export function SnowflakeSvg({ className, style }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} style={style} fill="none" aria-hidden="true">
      <path
        d="M16 2v28M4.5 9l23 14M4.5 23l23-14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16 6l-3 3M16 6l3 3M16 26l-3-3M16 26l3-3M7 11l4 0M7 21l4 0M25 11l-4 0M25 21l-4 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
