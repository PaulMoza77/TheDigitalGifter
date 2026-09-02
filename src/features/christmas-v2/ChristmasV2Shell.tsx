import type { ReactNode } from "react";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChristmasSnowfall } from "./ChristmasSnowfall";
import { CHRISTMAS_V2_ROUTE } from "./config";

const TDG_LOGO_SRC = "/TheDigitalGifter.png";

export function ChristmasV2Shell({
  children,
  showBack,
  onBack,
  padForSticky,
  footer,
}: {
  children: ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  padForSticky?: boolean;
  footer?: string;
}) {
  useEffect(() => {
    const existing = document.querySelector('link[data-cv2-preload="logo"]');
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = TDG_LOGO_SRC;
    link.setAttribute("data-cv2-preload", "logo");
    document.head.appendChild(link);
  }, []);

  return (
    <div className="christmas-v2 relative min-h-screen overflow-x-hidden text-[#F7F0E4]">
      <ChristmasSnowfall />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_top,_rgba(201,162,39,0.18),_transparent_55%),linear-gradient(160deg,#3b0610_0%,#5c0a14_42%,#2a0810_100%)]" />
      <div className="pointer-events-none absolute inset-0 z-[2] opacity-[0.35] [background-image:radial-gradient(circle_at_12%_18%,rgba(255,220,140,0.55)_0_1.5px,transparent_2px),radial-gradient(circle_at_78%_12%,rgba(255,230,170,0.4)_0_1px,transparent_2px),radial-gradient(circle_at_88%_40%,rgba(255,210,120,0.45)_0_1.5px,transparent_2px),radial-gradient(circle_at_22%_72%,rgba(255,225,150,0.35)_0_1px,transparent_2px)] [background-size:100%_100%]" />
      <div className="pointer-events-none absolute -left-10 top-24 z-[2] h-40 w-40 rounded-full bg-[#1B4332]/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-8 bottom-32 z-[2] h-48 w-48 rounded-full bg-[#C9A227]/15 blur-3xl" />

      <div
        className={cn(
          "relative z-[3] mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pt-4 sm:px-6",
          padForSticky ? "pb-28" : "pb-10",
        )}
      >
        <header className="flex items-center py-2">
          <a
            href={CHRISTMAS_V2_ROUTE}
            className="flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          >
            <img
              src={TDG_LOGO_SRC}
              alt="The Digital Gifter"
              width={36}
              height={36}
              decoding="async"
              fetchPriority="high"
              className="h-9 w-9 rounded-full object-cover shadow-[0_0_20px_rgba(201,162,39,0.35)] ring-1 ring-[#C9A227]/40"
            />
            <span className="font-[family-name:var(--cv2-display)] text-lg font-semibold tracking-tight text-[#F7F0E4]">
              The Digital Gifter
            </span>
          </a>
        </header>

        {showBack ? (
          <div className="mt-1">
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-0 text-[#F7F0E4]/70 hover:bg-transparent hover:text-[#F7F0E4]"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          </div>
        ) : null}

        <main className="flex-1 py-5">{children}</main>
        <footer className="mt-8 border-t border-[#F7F0E4]/10 pt-5 text-xs text-[#F7F0E4]/45">
          <p>
            {footer ??
              "Premium AI Christmas portraits by The Digital Gifter. One-time purchase — no subscription."}
          </p>
          <p className="mt-2">
            <a className="underline-offset-2 hover:underline" href="/christmas">
              Explore more Christmas styles
            </a>
            {" · "}
            <a className="underline-offset-2 hover:underline" href="/generator?occasion=christmas">
              Full Christmas generator
            </a>
          </p>
        </footer>
      </div>

      <style>{`
        .christmas-v2 {
          --cv2-display: "Cormorant Garamond", "Times New Roman", serif;
          --cv2-body: "Source Sans 3", "Segoe UI", sans-serif;
          font-family: var(--cv2-body);
        }
        .christmas-v2 h1, .christmas-v2 h2, .christmas-v2 .cv2-display {
          font-family: var(--cv2-display);
        }
      `}</style>
    </div>
  );
}
