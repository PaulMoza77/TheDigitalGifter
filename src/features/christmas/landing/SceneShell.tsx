import type { ReactNode } from "react";
import { useInViewOnce } from "./useInViewOnce";

export function SceneShell({
  id,
  kicker,
  title,
  lede,
  children,
  visual,
  reverse,
  className = "",
}: {
  id: string;
  kicker: string;
  title: string;
  lede: string;
  children?: ReactNode;
  visual: ReactNode;
  reverse?: boolean;
  className?: string;
}) {
  const { ref, inView } = useInViewOnce<HTMLElement>();

  return (
    <section
      id={id}
      ref={ref}
      className={`xmas-scene ${className}`.trim()}
      aria-labelledby={`${id}-title`}
    >
      <div
        className={`xmas-scene__inner ${reverse ? "xmas-scene__inner--split-rev" : "xmas-scene__inner--split"}`}
      >
        <div className={`xmas-copy xmas-reveal ${inView ? "is-in" : ""}`}>
          <p className="xmas-kicker">{kicker}</p>
          <h2 id={`${id}-title`}>{title}</h2>
          <p className="xmas-lede">{lede}</p>
          {children}
        </div>
        <div className={`xmas-reveal ${inView ? "is-in" : ""}`}>{visual}</div>
      </div>
    </section>
  );
}
