import { Link } from "react-router-dom";

type Cue = {
  href: string;
  label: string;
  reason: string;
};

export function PlannerStudioCue({ cues }: { cues: Cue[] }) {
  if (!cues.length) return null;
  return (
    <aside className="tdg-studio-cue" aria-label="Christmas Studio">
      {cues.map((cue) => (
        <Link key={cue.href} className="tdg-studio-cue-link" to={cue.href}>
          <strong>{cue.label}</strong>
          <span>{cue.reason}</span>
        </Link>
      ))}
    </aside>
  );
}

export function recipientStudioCues(input: { hasChildren?: boolean; relationship?: string }): Cue[] {
  const cues: Cue[] = [
    {
      href: "/christmas/photo-generator",
      label: "Personalized photo",
      reason: "Separate photo credit, not part of the $17 planner",
    },
  ];
  const rel = String(input.relationship || "").toLowerCase();
  if (input.hasChildren || rel.includes("child") || rel.includes("kid") || rel.includes("son") || rel.includes("daughter")) {
    cues.push({ href: "/christmas/santa-video", label: "Santa video", reason: "Separate video credit, not part of the $17 planner" });
  }
  return cues.slice(0, 2);
}

export function cardsStudioCues(): Cue[] {
  return [
    { href: "/christmas/cards", label: "Create Card", reason: "Separate card credit, not part of the $17 planner" },
    { href: "/christmas/messages", label: "Write a message", reason: "A greeting to copy into the card" },
  ];
}

export function memoriesStudioCues(): Cue[] {
  return [{ href: "/christmas/photo-generator", label: "Christmas Portrait", reason: "Separate photo credit, not part of the $17 planner" }];
}
