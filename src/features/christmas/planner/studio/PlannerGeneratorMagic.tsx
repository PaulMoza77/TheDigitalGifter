import { Link } from "react-router-dom";

/** Existing authenticated TDG image + video hub. Same account and credits. */
export const PLANNER_GENERATOR_HREF = "/generator?occasion=christmas";

const VISUAL = "/christmas/planner/gifts-editorial.webp";
const VISUAL_MORE = "/assets/christmas/library-stills/family_christmas_boardgame.jpg";

export function PlannerGeneratorMagicCard({ variant }: { variant: "sidebar" | "more" }) {
  if (variant === "sidebar") {
    return (
      <Link className="tdg-planner-magic tdg-planner-magic--side" to={PLANNER_GENERATOR_HREF}>
        <span className="tdg-planner-magic-visual" aria-hidden="true">
          <img src={VISUAL} alt="" width={188} height={92} decoding="async" />
        </span>
        <span className="tdg-planner-magic-copy">
          <span className="tdg-planner-magic-kicker">Create Christmas magic</span>
          <span className="tdg-planner-magic-lede">Turn your favorite moments into something magical.</span>
          <span className="tdg-planner-magic-cta">Create a memory →</span>
        </span>
      </Link>
    );
  }

  return (
    <Link className="tdg-planner-magic tdg-planner-magic--more" to={PLANNER_GENERATOR_HREF}>
      <span className="tdg-planner-magic-visual" aria-hidden="true">
        <img src={VISUAL_MORE} alt="" width={720} height={280} decoding="async" />
      </span>
      <span className="tdg-planner-magic-copy">
        <span className="tdg-planner-magic-kicker">Create Christmas magic</span>
        <strong>Your plans make Christmas happen. Now create something worth remembering.</strong>
        <span className="tdg-planner-magic-lede">Create Christmas images and videos from your favorite moments.</span>
        <span className="tdg-planner-magic-cta">Start creating →</span>
      </span>
    </Link>
  );
}
