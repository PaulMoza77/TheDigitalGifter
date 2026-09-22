export type PlannerMarkKind =
  | "plan"
  | "gift"
  | "budget"
  | "calendar"
  | "food"
  | "home"
  | "travel"
  | "star"
  | "memory"
  | "settings"
  | "list"
  | "shopping";

export function PlannerMark({ kind }: { kind: PlannerMarkKind }) {
  const common = {
    viewBox: "0 0 64 64",
    width: 56,
    height: 56,
    fill: "none",
    "aria-hidden": true as const,
  };
  const stroke = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "gift":
      return (
        <svg {...common} className="tdg-planner-mark">
          <rect x="12" y="26" width="40" height="26" rx="3" {...stroke} />
          <path d="M12 34h40M32 26v26M24 14c4 0 8 5 8 12M40 14c-4 0-8 5-8 12M20 14h24" {...stroke} />
        </svg>
      );
    case "budget":
      return (
        <svg {...common} className="tdg-planner-mark">
          <rect x="10" y="18" width="44" height="28" rx="4" {...stroke} />
          <path d="M10 28h44M22 40h8" {...stroke} />
          <circle cx="44" cy="40" r="4" {...stroke} />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common} className="tdg-planner-mark">
          <rect x="12" y="16" width="40" height="36" rx="4" {...stroke} />
          <path d="M12 26h40M22 12v8M42 12v8M22 36h4M32 36h4M42 36h4M22 44h4M32 44h4" {...stroke} />
        </svg>
      );
    case "food":
      return (
        <svg {...common} className="tdg-planner-mark">
          <ellipse cx="32" cy="42" rx="18" ry="6" {...stroke} />
          <path d="M14 42c0-12 8-22 18-22s18 10 18 22M32 12v8M26 16h12" {...stroke} />
        </svg>
      );
    case "home":
      return (
        <svg {...common} className="tdg-planner-mark">
          <path d="M12 32 32 14l20 18" {...stroke} />
          <path d="M18 30v18h28V30" {...stroke} />
          <path d="M28 48V36h8v12" {...stroke} />
        </svg>
      );
    case "travel":
      return (
        <svg {...common} className="tdg-planner-mark">
          <path d="M10 40h44M16 40 28 18h8l12 22" {...stroke} />
          <path d="M24 28h16M20 40v6M44 40v6" {...stroke} />
        </svg>
      );
    case "star":
      return (
        <svg {...common} className="tdg-planner-mark">
          <path d="M32 12l4.6 12.4H50l-10.8 7.8 4.2 12.8L32 38.8 20.6 45l4.2-12.8L14 24.4h13.4z" {...stroke} />
        </svg>
      );
    case "memory":
      return (
        <svg {...common} className="tdg-planner-mark">
          <rect x="14" y="16" width="36" height="32" rx="3" {...stroke} />
          <circle cx="26" cy="30" r="4" {...stroke} />
          <path d="M16 42l12-10 8 7 14-12" {...stroke} />
        </svg>
      );
    case "settings":
      return (
        <svg {...common} className="tdg-planner-mark">
          <circle cx="32" cy="32" r="8" {...stroke} />
          <path d="M32 12v6M32 46v6M12 32h6M46 32h6M18 18l4 4M42 42l4 4M18 46l4-4M42 22l4-4" {...stroke} />
        </svg>
      );
    case "shopping":
      return (
        <svg {...common} className="tdg-planner-mark">
          <path d="M16 20h6l4 24h20l4-16H24" {...stroke} />
          <circle cx="30" cy="50" r="3" {...stroke} />
          <circle cx="44" cy="50" r="3" {...stroke} />
        </svg>
      );
    case "list":
      return (
        <svg {...common} className="tdg-planner-mark">
          <path d="M18 20h28M18 32h28M18 44h20" {...stroke} />
          <circle cx="12" cy="20" r="2" {...stroke} />
          <circle cx="12" cy="32" r="2" {...stroke} />
          <circle cx="12" cy="44" r="2" {...stroke} />
        </svg>
      );
    default:
      return (
        <svg {...common} className="tdg-planner-mark">
          <path d="M18 44V22l14-8 14 8v22H18z" {...stroke} />
          <path d="M26 44V32h12v12" {...stroke} />
        </svg>
      );
  }
}

/** Filled Christmas gift mark for planner branding. Not an emoji. */
export function PlannerGiftMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      className="tdg-planner-gift-mark"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <rect x="8" y="20" width="32" height="22" rx="4" fill="#B5232E" />
      <rect x="8" y="20" width="32" height="6" fill="#8E1B24" />
      <rect x="22" y="20" width="4" height="22" fill="#F4D7A1" />
      <path d="M24 20c-6-8-13-8-13-2 0 4 5 6 13 8 8-2 13-4 13-8 0-6-7-6-13 2z" fill="#C4A574" />
      <path d="M24 20c-4-5-9-6-9-2 0 3 4 5 9 6 5-1 9-3 9-6 0-4-5-3-9 2z" fill="#B5232E" />
    </svg>
  );
}

export function PlannerTreeMark({ size = 16 }: { size?: number }) {
  return (
    <svg className="tdg-planner-tree-mark" viewBox="0 0 18 18" width={size} height={size} aria-hidden="true">
      <path d="M9 1.8 3.2 8.8h3.1L3 14h12l-3.3-5.2h3.1L9 1.8z" fill="#2a4d3e" />
      <rect x="8.1" y="14" width="1.8" height="2.4" rx="0.4" fill="#6d4c2f" />
    </svg>
  );
}
