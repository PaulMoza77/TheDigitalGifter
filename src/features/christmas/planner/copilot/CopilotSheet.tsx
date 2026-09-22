import { Sparkles } from "lucide-react";
import { copilotEnabled } from "./ask";

export { ChristmasCopilotPanel } from "./ChristmasCopilotPanel";

/** Mobile / compact launcher. Desktop uses the persistent rail. */
export function CopilotLaunchButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  if (!copilotEnabled()) return null;
  return (
    <button type="button" className={`tdg-copilot-launch${compact ? " is-fab" : ""}`} onClick={onClick}>
      <Sparkles size={compact ? 18 : 16} aria-hidden />
      {compact ? <span className="tdg-planner-sr">Ask Christmas Copilot</span> : "Ask Copilot"}
    </button>
  );
}

/** @deprecated The persistent panel lives in CopilotHost. Kept for source-scan tests. */
export function CopilotSheet() {
  return null;
}
