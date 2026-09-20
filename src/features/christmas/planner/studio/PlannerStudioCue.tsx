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
      reason: "A portrait gift for this person",
    },
  ];
  const rel = String(input.relationship || "").toLowerCase();
  if (input.hasChildren || rel.includes("child") || rel.includes("kid") || rel.includes("son") || rel.includes("daughter")) {
    cues.push({ href: "/christmas/santa-video", label: "Santa video", reason: "A personalised video they can keep" });
  }
  return cues.slice(0, 2);
}

export function cardsStudioCues(): Cue[] {
  return [
    { href: "/christmas/cards", label: "Create Card", reason: "Open the card maker for this task" },
    { href: "/christmas/messages", label: "Write a message", reason: "A greeting to copy into the card" },
  ];
}

export function memoriesStudioCues(): Cue[] {
  return [{ href: "/christmas/photo-generator", label: "Christmas Portrait", reason: "Turn a favourite photo into a seasonal portrait" }];
}
