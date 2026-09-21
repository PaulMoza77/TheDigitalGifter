import { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, ChevronRight } from "lucide-react";
import type { ModuleCardModel } from "./homeStats";

export function PlannerModuleCard({
  card,
  priority,
  onUnlock,
}: {
  card: ModuleCardModel;
  priority?: boolean;
  onUnlock?: (card: ModuleCardModel) => void;
}) {
  const [broken, setBroken] = useState(false);
  const photo = card.photo;
  const locked = card.locked;

  const body = (
    <>
      <div className="tdg-planner-module-photo" style={photo && (broken || !photo.src) ? { background: photo.fallback } : undefined}>
        {photo && !broken ? (
          <img
            src={photo.src}
            alt=""
            width={photo.width}
            height={photo.height}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            sizes="(max-width: 719px) 46vw, (max-width: 1199px) 30vw, 280px"
            onError={() => setBroken(true)}
          />
        ) : null}
        {locked ? <PlannerLockedOverlay title={card.title} /> : null}
      </div>
      <div className="tdg-planner-module-copy">
        <div className="tdg-planner-module-copy-text">
          <strong>{card.title}</strong>
          <span>{card.tagline}</span>
          {card.progress ? <em>{card.progress}</em> : null}
        </div>
        <span className="tdg-planner-module-go" aria-hidden>
          <ChevronRight size={18} strokeWidth={1.7} />
        </span>
      </div>
    </>
  );

  if (locked) {
    return (
      <button type="button" className="tdg-planner-module-card is-locked" onClick={() => onUnlock?.(card)}>
        {body}
      </button>
    );
  }

  return (
    <Link className="tdg-planner-module-card" to={card.href}>
      {body}
    </Link>
  );
}

export function PlannerLockedOverlay({ title }: { title: string }) {
  return (
    <span className="tdg-planner-locked-overlay">
      <span className="tdg-planner-lock-pill">
        <Lock size={12} strokeWidth={2} aria-hidden />
        Unlock {title}
      </span>
    </span>
  );
}

export function PlannerModuleGrid({
  cards,
  onUnlock,
}: {
  cards: ModuleCardModel[];
  onUnlock?: (card: ModuleCardModel) => void;
}) {
  return (
    <div className="tdg-planner-module-grid">
      {cards.map((card, index) => (
        <PlannerModuleCard key={card.id} card={card} priority={index < 4} onUnlock={onUnlock} />
      ))}
    </div>
  );
}
