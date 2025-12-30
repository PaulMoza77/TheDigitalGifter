import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";

/**
 * TDG — AliveMoment-inspired landing (Canvas Preview)
 * Single-file React + TSX page
 * - Warm premium palette
 * - ONE CTA label reused
 * - Connectors between photo blocks (SVG)
 */

const CTA_LABEL = "Try now — Bring your photos to life";

type Point = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function useRafResize(callback: () => void, deps: any[] = []) {
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => callback());
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function getAnchor(
  el: HTMLElement | null,
  root: HTMLElement | null,
  side: "left" | "right" | "top" | "bottom" = "right"
): Point {
  if (!el || !root) return { x: 0, y: 0 };
  const r = el.getBoundingClientRect();
  const rr = root.getBoundingClientRect();
  const xMid = r.left + r.width / 2 - rr.left;
  const yMid = r.top + r.height / 2 - rr.top;
  if (side === "left") return { x: r.left - rr.left, y: yMid };
  if (side === "right") return { x: r.left + r.width - rr.left, y: yMid };
  if (side === "top") return { x: xMid, y: r.top - rr.top };
  return { x: xMid, y: r.top + r.height - rr.top };
}

function curvedPath(a: Point, b: Point, bend: number = 0.22) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const c1: Point = { x: a.x + dx * (0.35 + bend), y: a.y + dy * 0.05 };
  const c2: Point = { x: a.x + dx * (0.65 - bend), y: a.y + dy * 0.95 };
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
}

function ArrowMarkerDefs() {
  return (
    <defs>
      <linearGradient id="tdgLine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="rgba(6,78,59,0.18)" />
        <stop offset="50%" stopColor="rgba(6,78,59,0.40)" />
        <stop offset="100%" stopColor="rgba(6,78,59,0.22)" />
      </linearGradient>
      <marker
        id="arrowHead"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(6,78,59,0.6)" />
      </marker>
      <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.2" result="blur" />
        <feColorMatrix
          result="glow"
          type="matrix"
          values="0 0 0 0 0.02  0 0 0 0 0.35  0 0 0 0 0.24  0 0 0 0.35 0"
        />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

function LogoMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative grid h-9 w-9 place-items-center rounded-2xl bg-emerald-950 text-emerald-50 shadow-sm">
        <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_30%,rgba(253,224,71,0.25),transparent_55%)]" />
        <span className="relative text-sm font-semibold tracking-tight">TDG</span>
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight text-emerald-950">TheDigitalGifter</div>
        <div className="text-[11px] text-emerald-950/60">Moving gifts from your photos</div>
      </div>
    </div>
  );
}

function Pill({
  children,
  tone = "sun",
}: {
  children: React.ReactNode;
  tone?: "sun" | "mint" | "ink";
}) {
  const cls =
    tone === "sun"
      ? "bg-yellow-200 text-emerald-950 border-yellow-300/60"
      : tone === "mint"
        ? "bg-emerald-50 text-emerald-950 border-emerald-200"
        : "bg-emerald-950 text-emerald-50 border-emerald-950";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-[0_1px_0_rgba(0,0,0,0.03)] ${cls}`}
    >
      {children}
    </span>
  );
}

function CTAButton({ className = "" }: { className?: string }) {
    const navigate = useNavigate();
  return (
    <Button
        onClick={() => navigate('/funnel/uploadPhoto')}
      className={
        "rounded-full bg-emerald-950 px-6 py-6 text-base font-semibold text-emerald-50 shadow-[0_12px_30px_rgba(6,78,59,0.22)] hover:bg-emerald-900 active:translate-y-[1px] " +
        className
      }
    >
      {CTA_LABEL}
    </Button>
  );
}

function SoftBg() {
  return (
    <>
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(253,224,71,0.18),transparent_60%)] blur-2xl" />
      <div className="pointer-events-none absolute right-[-140px] top-20 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_40%_35%,rgba(16,185,129,0.12),transparent_65%)] blur-2xl" />
      <div className="pointer-events-none absolute left-[20%] bottom-[-220px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_45%_50%,rgba(6,78,59,0.08),transparent_65%)] blur-2xl" />
    </>
  );
}

function PhotoMock({
  variant = "warm",
  className = "",
  rounded = "rounded-3xl",
  label,
  labelTone,
  footer,
}: {
  variant?: "warm" | "vintage" | "winter" | "love" | "cinematic";
  className?: string;
  rounded?: string;
  label?: string;
  labelTone?: "sun" | "mint" | "ink";
  footer?: string;
}) {
  const bg =
    variant === "warm"
      ? "bg-[linear-gradient(135deg,rgba(253,224,71,0.25),rgba(16,185,129,0.10),rgba(6,78,59,0.12))]"
      : variant === "vintage"
        ? "bg-[linear-gradient(135deg,rgba(6,78,59,0.10),rgba(253,224,71,0.18),rgba(0,0,0,0.03))]"
        : variant === "winter"
          ? "bg-[linear-gradient(135deg,rgba(59,130,246,0.10),rgba(16,185,129,0.08),rgba(253,224,71,0.10))]"
          : variant === "love"
            ? "bg-[linear-gradient(135deg,rgba(244,63,94,0.10),rgba(253,224,71,0.12),rgba(6,78,59,0.10))]"
            : "bg-[linear-gradient(135deg,rgba(6,78,59,0.14),rgba(2,132,199,0.08),rgba(253,224,71,0.10))]";

  return (
    <div
      className={
        "group relative overflow-hidden border border-emerald-950/10 bg-white/55 shadow-[0_20px_60px_rgba(6,78,59,0.08)] transition-transform duration-300 hover:scale-[1.02] " +
        rounded +
        " " +
        className
      }
    >
      <div className={`absolute inset-0 ${bg}`} />
      <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,rgba(6,78,59,0.35)_1px,transparent_0)] [background-size:16px_16px]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.10),rgba(255,255,255,0.65))]" />

      {label ? (
        <div className="absolute left-4 top-4 z-10">
          <Pill tone={labelTone || "sun"}>{label}</Pill>
        </div>
      ) : null}

      <div className="relative aspect-[4/5] w-full" />

      {footer ? (
        <div className="relative border-t border-emerald-950/10 bg-emerald-950/90 px-4 py-2 text-center text-xs font-medium text-emerald-50">
          {footer}
        </div>
      ) : null}

      <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-300/70" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/70" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-950/40" />
      </div>
    </div>
  );
}

function ConnectorOverlay({
  rootRef,
  links,
  simplifiedOnMobile = true,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  links: Array<{
    from: React.RefObject<HTMLElement | null>;
    to: React.RefObject<HTMLElement | null>;
    fromSide?: any;
    toSide?: any;
    arrow?: boolean;
    bend?: number;
  }>;
  simplifiedOnMobile?: boolean;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [paths, setPaths] = useState<Array<{ d: string; arrow: boolean; dots: Point[] }>>(
    []
  );

  const recalc = () => {
    const root = rootRef.current;
    if (!root) return;
    const rr = root.getBoundingClientRect();
    setSize({ w: Math.max(1, rr.width), h: Math.max(1, rr.height) });

    const isMobile = window.innerWidth < 768;

    const out = links.map((l) => {
      const a = getAnchor(l.from.current, root, (l.fromSide || "right") as any);
      const b = getAnchor(l.to.current, root, (l.toSide || "left") as any);

      const d =
        isMobile && simplifiedOnMobile
          ? (() => {
              const aa: Point = {
                x: clamp(a.x, 16, rr.width - 16),
                y: a.y,
              };
              const bb: Point = {
                x: clamp(b.x, 16, rr.width - 16),
                y: b.y,
              };
              const midY = (aa.y + bb.y) / 2;
              return `M ${aa.x} ${aa.y} C ${aa.x} ${midY}, ${bb.x} ${midY}, ${bb.x} ${bb.y}`;
            })()
          : curvedPath(a, b, l.bend ?? 0.22);

      const dots: Point[] = [];
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        dots.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t + (i % 2 === 0 ? -10 : 10),
        });
      }

      return { d, arrow: !!l.arrow, dots };
    });

    setPaths(out);
  };

  useEffect(() => {
    recalc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRafResize(recalc, []);

  useEffect(() => {
    const t = window.setTimeout(recalc, 120);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links.length]);

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
      preserveAspectRatio="none"
    >
      <ArrowMarkerDefs />

      {paths.map((p, idx) => (
        <g key={idx}>
          <path
            d={p.d}
            fill="none"
            stroke="url(#tdgLine)"
            strokeWidth={3}
            strokeLinecap="round"
            filter="url(#softGlow)"
            markerEnd={p.arrow ? "url(#arrowHead)" : undefined}
          />
          {p.dots.map((d, i) => (
            <circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={i === 1 ? 3 : 2}
              fill={i === 1 ? "rgba(253,224,71,0.60)" : "rgba(16,185,129,0.35)"}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

function StarRow() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <div className="inline-flex items-center gap-2">
        <span className="text-emerald-950/70">Excellent</span>
        <div className="inline-flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="h-4 w-4 rounded-[6px] bg-emerald-600/90" />
          ))}
        </div>
      </div>
      <div className="text-emerald-950/70">
        <span className="font-semibold text-emerald-950">4.8/5</span> out of{" "}
        <span className="underline">2,700+ reviews</span>
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
  center = true,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow ? (
        <div className="mb-3 text-sm text-emerald-950/70">{eyebrow}</div>
      ) : null}
      <h2 className="text-balance font-serif text-3xl tracking-tight text-emerald-950 sm:text-4xl md:text-5xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 text-pretty text-base leading-relaxed text-emerald-950/70 sm:text-lg">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function Nav() {
  const items = [
    { label: "How it works", href: "#how" },
    { label: "Examples", href: "#examples" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <div className="sticky top-0 z-40 border-b border-emerald-950/10 bg-[#F6F2EA]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <a
          href="#top"
          className="rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
        >
          <LogoMark />
        </a>
        <div className="hidden items-center gap-6 md:flex">
          {items.map((it) => (
            <a
              key={it.label}
              href={it.href}
              className="text-sm font-medium text-emerald-950/70 hover:text-emerald-950"
            >
              {it.label}
            </a>
          ))}
          <a href="#" className="text-sm font-medium text-emerald-950/70 hover:text-emerald-950">
            Contact
          </a>
          <Button
            variant="outline"
            className="rounded-full border-emerald-950/15 bg-white/60 px-4 text-emerald-950 hover:bg-white"
          >
            Sign in
          </Button>
        </div>
        <div className="md:hidden">
          <Button
            variant="outline"
            className="rounded-full border-emerald-950/15 bg-white/60 px-4 text-emerald-950 hover:bg-white"
          >
            Sign in
          </Button>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const beforeRef = useRef<HTMLDivElement | null>(null);
  const afterRef = useRef<HTMLDivElement | null>(null);

  const links = useMemo(
    () => [
      {
        from: beforeRef as any,
        to: afterRef as any,
        fromSide: "right",
        toSide: "left",
        arrow: true,
        bend: 0.18,
      },
    ],
    []
  );

  return (
    <section id="top" className="relative overflow-hidden bg-[#F6F2EA]">
      <SoftBg />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
        <div className="flex flex-col justify-center">
          <div className="mb-5">
            <StarRow />
          </div>

          <h1 className="text-balance font-serif text-4xl tracking-tight text-emerald-950 sm:text-5xl md:text-6xl">
            Bring Your Photos to Life
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-emerald-950/70 sm:text-lg">
            Upload a photo and generate a moving memory in minutes. Perfect for winter surprises, birthdays, love
            messages, and family moments that deserve to feel real.
          </p>

          <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
            <CTAButton />
            <div className="flex items-center gap-2 text-sm text-emerald-950/70">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-950/10">
                ✓
              </span>
              100% private — your memories are yours
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3 text-xs text-emerald-950/60">
            <Pill tone="mint">Takes ~1 minute to start</Pill>
            <Pill tone="mint">No tech skills needed</Pill>
            <Pill tone="mint">Made for meaningful gifts</Pill>
          </div>
        </div>

        <div ref={rootRef} className="relative">
          <ConnectorOverlay rootRef={rootRef} links={links as any} />

          <Card className="mx-auto max-w-[560px] rounded-[32px] border-emerald-950/10 bg-white/55 shadow-[0_30px_90px_rgba(6,78,59,0.12)] backdrop-blur">
            <CardContent className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <Pill tone="sun">Before → After</Pill>
                <span className="text-xs text-emerald-950/60">a single photo, transformed</span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                <div ref={beforeRef as any} className="relative">
                  <PhotoMock variant="vintage" label="Your photo" labelTone="sun" rounded="rounded-[28px]" />
                </div>

                <div ref={afterRef as any} className="relative">
                  <PhotoMock
                    variant="winter"
                    label="TDG result ✨"
                    labelTone="ink"
                    rounded="rounded-[28px]"
                    footer="Brought beautifully to life ✨"
                    className="shadow-[0_40px_120px_rgba(6,78,59,0.16)]"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-emerald-950/60">Gentle motion, warm emotion — made to be shared.</div>
                <div className="flex items-center gap-2 text-xs text-emerald-950/60">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-300/70" />
                    subtle motion
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/40" />
                    premium styles
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="border-t border-emerald-950/10 bg-[#F6F2EA]">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="text-sm font-medium text-emerald-950/70">Trusted by creators & families</div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-950/40">
              <span>Creator Community</span>
              <span>Family Albums</span>
              <span>Holiday Makers</span>
              <span>Memory Lovers</span>
              <span>Gift Givers</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const s1 = useRef<HTMLDivElement | null>(null);
  const s2 = useRef<HTMLDivElement | null>(null);
  const s3 = useRef<HTMLDivElement | null>(null);

  const links = useMemo(
    () => [
      { from: s1 as any, to: s2 as any, fromSide: "right", toSide: "left", arrow: true, bend: 0.18 },
      { from: s2 as any, to: s3 as any, fromSide: "right", toSide: "left", arrow: true, bend: 0.18 },
    ],
    []
  );

  return (
    <section id="how" className="relative bg-[#F6F2EA] py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow={<span className="opacity-80">How it works</span>}
          title={<>Meaningful should never be complicated</>}
          subtitle={<>A simple flow: upload a photo, pick a style, and share a moving gift that feels personal.</>}
        />

        <div ref={rootRef} className="relative mt-10">
          <ConnectorOverlay rootRef={rootRef} links={links as any} />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            <Card
              ref={s1 as any}
              className="rounded-[28px] border-emerald-950/10 bg-white/60 shadow-[0_22px_70px_rgba(6,78,59,0.08)]"
            >
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <Badge className="rounded-full bg-yellow-200 text-emerald-950 hover:bg-yellow-200">STEP 1</Badge>
                  <span className="text-xs text-emerald-950/60">Upload</span>
                </div>
                <div className="text-xl font-semibold text-emerald-950">Upload a Photo</div>
                <p className="mt-2 text-sm leading-relaxed text-emerald-950/70">
                  Choose a memory — family, friends, love, or a special moment.
                </p>
                <div className="mt-5">
                  <PhotoMock variant="warm" label="Your photo" labelTone="sun" />
                </div>
              </CardContent>
            </Card>

            <Card
              ref={s2 as any}
              className="rounded-[28px] border-emerald-950/10 bg-white/60 shadow-[0_22px_70px_rgba(6,78,59,0.08)]"
            >
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <Badge className="rounded-full bg-yellow-200 text-emerald-950 hover:bg-yellow-200">STEP 2</Badge>
                  <span className="text-xs text-emerald-950/60">Style</span>
                </div>
                <div className="text-xl font-semibold text-emerald-950">Pick a Style</div>
                <p className="mt-2 text-sm leading-relaxed text-emerald-950/70">
                  Winter, Birthday, Love, Retro, Cinematic — choose the vibe.
                </p>
                <div className="mt-5">
                  <PhotoMock variant="cinematic" label="Style preview" labelTone="mint" />
                </div>
              </CardContent>
            </Card>

            <Card
              ref={s3 as any}
              className="rounded-[28px] border-emerald-950/10 bg-white/60 shadow-[0_22px_70px_rgba(6,78,59,0.08)]"
            >
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <Badge className="rounded-full bg-yellow-200 text-emerald-950 hover:bg-yellow-200">STEP 3</Badge>
                  <span className="text-xs text-emerald-950/60">Share</span>
                </div>
                <div className="text-xl font-semibold text-emerald-950">Download & Share</div>
                <p className="mt-2 text-sm leading-relaxed text-emerald-950/70">
                  Save your animated memory and send it to someone who matters.
                </p>
                <div className="mt-5">
                  <PhotoMock variant="winter" label="TDG result ✨" labelTone="ink" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-10 flex justify-center">
            <CTAButton />
          </div>
        </div>
      </div>
    </section>
  );
}

function Examples() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const a1 = useRef<HTMLDivElement | null>(null);
  const b1 = useRef<HTMLDivElement | null>(null);
  const a2 = useRef<HTMLDivElement | null>(null);
  const b2 = useRef<HTMLDivElement | null>(null);
  const a3 = useRef<HTMLDivElement | null>(null);
  const b3 = useRef<HTMLDivElement | null>(null);

  const links = useMemo(
    () => [
      { from: a1 as any, to: b1 as any, fromSide: "right", toSide: "left", arrow: true, bend: 0.22 },
      { from: a2 as any, to: b2 as any, fromSide: "right", toSide: "left", arrow: true, bend: 0.22 },
      { from: a3 as any, to: b3 as any, fromSide: "right", toSide: "left", arrow: true, bend: 0.22 },
    ],
    []
  );

  const items = [
    {
      name: "Emily R.",
      location: "Portland, OR",
      quote: "Watching our old photo feel alive again gave me chills — it was like stepping back into that day.",
      before: "vintage" as const,
      after: "winter" as const,
      refs: { a: a1, b: b1 },
    },
    {
      name: "Avery",
      location: "Cheyenne, WY",
      quote: "The motion is subtle and beautiful. I made a birthday surprise and everyone asked how I did it.",
      before: "warm" as const,
      after: "cinematic" as const,
      refs: { a: a2, b: b2 },
    },
    {
      name: "Anna K.",
      location: "Omaha, NE",
      quote: "Perfect for love notes and winter greetings. It feels personal, not like a template.",
      before: "love" as const,
      after: "warm" as const,
      refs: { a: a3, b: b3 },
    },
  ];

  return (
    <section id="examples" className="relative bg-[#F6F2EA] py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          title={<>See the magic of moving memories</>}
          subtitle={<>A “before → after” flow you can feel. Each example shows how a photo turns into a gift-worthy moment.</>}
        />

        <div ref={rootRef} className="relative mt-12">
          <ConnectorOverlay rootRef={rootRef} links={links as any} />

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {items.map((it) => (
              <div key={it.name} className="relative">
                <Card className="rounded-[28px] border-emerald-950/10 bg-white/60 shadow-[0_22px_70px_rgba(6,78,59,0.08)]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-emerald-950">{it.name}</div>
                        <div className="text-xs text-emerald-950/50">{it.location}</div>
                      </div>
                      <div className="inline-flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className="h-3.5 w-3.5 rounded-[6px] bg-emerald-600/90" />
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div ref={it.refs.a as any} className="relative">
                        <PhotoMock variant={it.before} label="Before" labelTone="sun" rounded="rounded-3xl" />
                      </div>
                      <div ref={it.refs.b as any} className="relative">
                        <PhotoMock
                          variant={it.after}
                          label="After"
                          labelTone="ink"
                          rounded="rounded-3xl"
                          footer="TDG result ✨"
                        />
                      </div>
                    </div>

                    <p className="mt-5 text-sm italic leading-relaxed text-emerald-950/70">“{it.quote}”</p>

                    <div className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-950/70">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-950/10">
                        ✓
                      </span>
                      <span className="text-sm font-medium">Verified</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Pill tone="sun">
              Trusted by more than <span className="font-semibold">120,000+</span> users
            </Pill>
          </div>
        </div>
      </div>
    </section>
  );
}

function ValueTrio() {
  const items = [
    {
      title: "Bring your family’s memories to life",
      desc: "Watch treasured photos gently move and tell the story behind every smile and moment.",
      variant: "warm" as const,
    },
    {
      title: "Celebrate the moments that shape us",
      desc: "Turn everyday snapshots into shareable keepsakes with cinematic warmth.",
      variant: "cinematic" as const,
    },
    {
      title: "Preserve your story for tomorrow",
      desc: "Create animated gifts from your photos — moving and vibrant for years to come.",
      variant: "vintage" as const,
    },
  ];

  return (
    <section className="bg-[#F6F2EA] py-10 md:py-14">
      <div className="mx-auto max-w-6xl px-4">
        {/* ONE button here, tight spacing to cards */}
        <div className="flex justify-center">
          <CTAButton />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {items.map((it) => (
            <div key={it.title} className="text-center">
              <div className="mx-auto mb-6 max-w-[320px]">
                <PhotoMock variant={it.variant} rounded="rounded-[34px]" />
              </div>
              <div className="font-serif text-xl tracking-tight text-emerald-950">{it.title}</div>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-emerald-950/70">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ResultsBand() {
  const cards = [
    {
      big: "Tens of thousands+",
      label: "Moments Created",
      desc: "Real people turning precious photos into moving memories.",
    },
    {
      big: "Daily creations",
      label: "Worldwide",
      desc: "Each one crafted with care and lifelike emotion.",
    },
    {
      big: "High satisfaction",
      label: "From recipients",
      desc: "Loved by families, friends, and gift-givers.",
    },
  ];

  return (
    <section className="bg-emerald-950 py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="max-w-2xl">
          <h3 className="font-serif text-4xl tracking-tight text-emerald-50 md:text-5xl">Results You Can Feel</h3>
          <p className="mt-3 text-base leading-relaxed text-emerald-100/80">
            Powerful reactions, heartfelt surprises, and help always within reach.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {cards.map((c) => (
            <Card
              key={c.label}
              className="rounded-[28px] border-emerald-50/20 bg-emerald-950/60 shadow-[0_30px_90px_rgba(0,0,0,0.25)]"
            >
              <CardContent className="p-7">
                <div className="text-4xl font-extrabold tracking-tight text-yellow-300 md:text-5xl">{c.big}</div>
                <div className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-yellow-200/90">
                  {c.label}
                </div>
                <div className="mt-5 rounded-2xl bg-emerald-900/35 px-4 py-3 text-sm leading-relaxed text-emerald-50/80">
                  {c.desc}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "Do I need any technical skills to use this?",
      a: "No. Upload a photo, pick a style, and generate. The flow is designed to feel simple and fast.",
    },
    {
      q: "How long does it take to create the animated result?",
      a: "Usually just a few moments depending on the style and current demand. You’ll see progress as it generates.",
    },
    {
      q: "Can I choose how the photo is animated?",
      a: "Yes. Pick from styles like Winter, Birthday, Love, Retro, or Cinematic to guide the look and motion.",
    },
    {
      q: "Is my photo safe and private?",
      a: "Your content stays private. Use TDG to create gifts for people you care about, without public sharing by default.",
    },
    {
      q: "What formats can I download?",
      a: "You can download and share your result in common formats suitable for social sharing and messaging.",
    },
  ];

  return (
    <section id="faq" className="bg-[#F6F2EA] py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          title={<>Common questions, simple answers</>}
          subtitle={
            <>If you’re unsure about anything, the flow is intentionally straightforward — and support is always within reach.</>
          }
        />

        <div className="mx-auto mt-10 max-w-3xl">
          <Card className="rounded-[26px] border-emerald-950/15 bg-white/60 shadow-[0_20px_80px_rgba(6,78,59,0.10)]">
            <CardContent className="p-3 sm:p-4">
              <Accordion type="single" collapsible>
                {faqs.map((f, i) => (
                  <AccordionItem key={i} value={`item-${i}`} className="border-emerald-950/10">
                    <AccordionTrigger className="px-2 text-left text-sm font-semibold text-emerald-950 hover:no-underline sm:px-3">
                      {f.q}
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pb-3 text-sm leading-relaxed text-emerald-950/70 sm:px-3">
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <div className="mt-10 flex justify-center">
            <CTAButton />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-emerald-950/10 bg-[#F6F2EA]">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <LogoMark />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-emerald-950/70">
              TDG helps you turn photos into moving gifts — warm, personal, and made to be shared.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="font-semibold text-emerald-950">Product</div>
              <a className="block text-emerald-950/70 hover:text-emerald-950" href="#how">
                How it works
              </a>
              <a className="block text-emerald-950/70 hover:text-emerald-950" href="#examples">
                Examples
              </a>
              <a className="block text-emerald-950/70 hover:text-emerald-950" href="#faq">
                FAQ
              </a>
            </div>
            <div className="space-y-2">
              <div className="font-semibold text-emerald-950">Company</div>
              <a className="block text-emerald-950/70 hover:text-emerald-950" href="#">
                Contact
              </a>
              <a className="block text-emerald-950/70 hover:text-emerald-950" href="#">
                Privacy
              </a>
              <a className="block text-emerald-950/70 hover:text-emerald-950" href="#">
                Terms
              </a>
            </div>
          </div>

          <div className="rounded-[28px] border border-emerald-950/10 bg-white/60 p-6 shadow-[0_22px_70px_rgba(6,78,59,0.08)]">
            <div className="font-serif text-xl tracking-tight text-emerald-950">Ready to create your first moving gift?</div>
            <p className="mt-2 text-sm leading-relaxed text-emerald-950/70">
              Start with one photo. Pick a style. Share something that feels personal.
            </p>
            <div className="mt-5">
              <CTAButton className="w-full" />
            </div>
          </div>
        </div>

        <Separator className="my-10 bg-emerald-950/10" />

        <div className="flex flex-col items-center justify-between gap-3 text-xs text-emerald-950/60 md:flex-row">
          <div>© {new Date().getFullYear()} TheDigitalGifter. All rights reserved.</div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-300/70" />
              Warm & premium design
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/40" />
              Connectors + motion
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Minimal runtime “self-test” (no test runner in Canvas).
// Helps catch accidental empty CTA label or missing browser APIs during development.
function runSmokeChecks() {
  try {
    if (!CTA_LABEL || CTA_LABEL.trim().length < 3) {
      // eslint-disable-next-line no-console
      console.warn("[TDG Landing] CTA_LABEL looks empty or too short.");
    }
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame !== "function") {
      // eslint-disable-next-line no-console
      console.warn("[TDG Landing] requestAnimationFrame unavailable.");
    }
  } catch {
    // ignore
  }
}

export default function Index() {
  useEffect(() => {
    runSmokeChecks();
  }, []);

  return (
    <div className="min-h-screen bg-[#F6F2EA] text-emerald-950">
      <Nav />
      <Hero />
      <HowItWorks />
      <Examples />
      <ValueTrio />
      <ResultsBand />
      <FAQ />
      <Footer />
    </div>
  );
}
