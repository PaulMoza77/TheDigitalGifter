import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Name" },
  { id: 2, label: "Photo" },
  { id: 3, label: "Review" },
  { id: 4, label: "Payment" },
] as const;

export function FunnelProgress({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Order steps">
      {STEPS.map((step) => {
        const complete = step.id < current;
        const active = step.id === current;
        return (
          <li
            key={step.id}
            aria-current={active ? "step" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              complete && "bg-[#d4a84b]/20 text-[#d4a84b]",
              active && "bg-[#d4a84b] text-[#1a140e]",
              !complete && !active && "bg-[#f6efe4]/8 text-[#f6efe4]/50",
            )}
          >
            {step.id} {step.label}
            {complete ? " — complete" : active ? " — current" : ""}
          </li>
        );
      })}
    </ol>
  );
}
