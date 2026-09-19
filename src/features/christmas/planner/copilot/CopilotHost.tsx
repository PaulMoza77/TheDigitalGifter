import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CopilotLaunchButton, CopilotSheet } from "./CopilotSheet";
import { copilotEnabled } from "./ask";
import { usePlannerBundle } from "../Onboarding";

type CopilotUi = {
  openCopilot: (seed?: string, module?: string) => void;
};

const CopilotUiContext = createContext<CopilotUi | null>(null);

export function useCopilotUi() {
  return useContext(CopilotUiContext);
}

export function CopilotHost({ children }: { children: ReactNode }) {
  const { profile } = usePlannerBundle();
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  const [module, setModule] = useState("planner");

  const openCopilot = useCallback((nextSeed?: string, nextModule?: string) => {
    if (!copilotEnabled()) return;
    setModule(nextModule || "planner");
    setSeed(nextSeed || null);
    setOpen(true);
  }, []);

  return (
    <CopilotUiContext.Provider value={{ openCopilot }}>
      {children}
      {copilotEnabled() && profile ? (
        <>
          <CopilotLaunchButton compact onClick={() => openCopilot(undefined, "fab")} />
          <CopilotSheet
            open={open}
            seed={seed}
            module={module}
            onClose={() => setOpen(false)}
            onSeedConsumed={() => setSeed(null)}
          />
        </>
      ) : null}
    </CopilotUiContext.Provider>
  );
}
