import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useLocation } from "react-router-dom";
import { trackPlannerEvent } from "../analytics";
import { executePlannerAction, loadDismissedInsightIds, loadPlannerWorkspace, runPlannerIntelligence } from "../intelligence";
import type { PlannerIntelligence } from "../intelligence/types";
import { usePlannerBundle } from "../Onboarding";
import { bumpPlannerWorkspace, onPlannerWorkspaceBump } from "../workspaceSync";
import { askCopilot, copilotEnabled, tryApplyCopilotPlan } from "./ask";
import { ChristmasCopilotPanel, type CopilotTurn } from "./ChristmasCopilotPanel";
import { copilotModuleFromPath, copilotNextWin, copilotSuggestions } from "./context";

type CopilotUi = {
  openCopilot: (seed?: string, module?: string) => void;
  closeCopilot: () => void;
  desktop: boolean;
};

const CopilotUiContext = createContext<CopilotUi | null>(null);

export function useCopilotUi() {
  return useContext(CopilotUiContext);
}

function useDesktopCopilot() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1100px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return desktop;
}

type CopilotState = {
  desktop: boolean;
  sheetOpen: boolean;
  question: string;
  setQuestion: (value: string) => void;
  messages: CopilotTurn[];
  intel: PlannerIntelligence | null;
  applyNote: string | null;
  ask: (prompt?: string) => void;
  applyPlan: () => void;
  closeCopilot: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  pathname: string;
};

const CopilotStateContext = createContext<CopilotState | null>(null);

export function CopilotHost({ children }: { children: ReactNode }) {
  const { profile, access } = usePlannerBundle();
  const location = useLocation();
  const desktop = useDesktopCopilot();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<CopilotTurn[]>([]);
  const [intel, setIntel] = useState<PlannerIntelligence | null>(null);
  const [applyNote, setApplyNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const intelRef = useRef<PlannerIntelligence | null>(null);
  const questionRef = useRef("");
  const module = copilotModuleFromPath(location.pathname);

  useEffect(() => {
    intelRef.current = intel;
  }, [intel]);
  useEffect(() => {
    questionRef.current = question;
  }, [question]);

  useEffect(() => {
    if (!profile) return;
    const current = profile;
    let cancelled = false;
    async function load() {
      const snapshot = await loadPlannerWorkspace(current);
      if (cancelled) return;
      const dismissed = loadDismissedInsightIds(current.id, current.season_year);
      setIntel(runPlannerIntelligence(snapshot, dismissed));
    }
    void load();
    const stop = onPlannerWorkspaceBump(() => {
      void load();
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [profile, location.pathname]);

  const ask = useCallback((next?: string) => {
    const current = intelRef.current;
    if (!current) return;
    const q = (next ?? questionRef.current).trim().slice(0, 240);
    if (!q) return;
    const response = askCopilot(q, current);
    setQuestion("");
    setApplyNote(null);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}-${prev.length}`, role: "user", text: q },
      { id: `a-${Date.now()}-${prev.length}`, role: "assistant", text: response.message, response },
    ]);
    trackPlannerEvent("copilot_turn", {
      module: copilotModuleFromPath(window.location.pathname),
      metadata: { intent: response.modelPath, count_bucket: String(response.cards.length) },
    });
  }, []);

  const openCopilot = useCallback(
    (nextSeed?: string, nextModule?: string) => {
      if (!copilotEnabled()) return;
      trackPlannerEvent("copilot_opened", { module: nextModule || module });
      if (!desktop) setSheetOpen(true);
      if (nextSeed) {
        setQuestion(nextSeed);
        window.setTimeout(() => ask(nextSeed), 0);
      } else {
        window.setTimeout(() => inputRef.current?.focus(), 40);
      }
    },
    [desktop, module, ask],
  );

  const closeCopilot = useCallback(() => setSheetOpen(false), []);

  const applyPlan = useCallback(() => {
    const last = [...messages].reverse().find((m) => m.response?.actionPlan);
    if (!profile || !intel || !last?.response?.actionPlan) return;
    void (async () => {
      const result = await tryApplyCopilotPlan({
        plan: last.response!.actionPlan,
        confirm: true,
        snapshotVersion: last.response!.snapshotVersion,
        execute: (request) => executePlannerAction({ userId: profile.user_id, access, profile }, request),
      });
      setApplyNote(result.ok ? `Saved ${result.applied} change${result.applied === 1 ? "" : "s"} to your planner.` : result.message);
      if (result.ok) bumpPlannerWorkspace();
    })();
  }, [messages, profile, intel, access]);

  return (
    <CopilotUiContext.Provider value={{ openCopilot, closeCopilot, desktop }}>
      <CopilotStateContext.Provider
        value={{
          desktop,
          sheetOpen,
          question,
          setQuestion,
          messages,
          intel,
          applyNote,
          ask,
          applyPlan,
          closeCopilot,
          inputRef,
          pathname: location.pathname,
        }}
      >
        {children}
      </CopilotStateContext.Provider>
    </CopilotUiContext.Provider>
  );
}

export function CopilotSurface() {
  const { profile } = usePlannerBundle();
  const state = useContext(CopilotStateContext);
  if (!state || !copilotEnabled() || !profile) return null;
  const panelProps = {
    suggestions: copilotSuggestions(state.pathname, state.intel),
    nextWin: copilotNextWin(state.pathname, state.intel),
    messages: state.messages,
    question: state.question,
    onQuestion: state.setQuestion,
    onAsk: state.ask,
    applyNote: state.applyNote,
    onApply: state.applyPlan,
    busy: !state.intel,
    inputRef: state.inputRef,
  };
  return (
    <>
      <div className="tdg-copilot-rail" data-testid="christmas-copilot-rail">
        <ChristmasCopilotPanel variant="rail" {...panelProps} />
      </div>
      {state.sheetOpen && !state.desktop ? (
        <div className="tdg-copilot-root" role="dialog" aria-modal="true" aria-labelledby="tdg-copilot-title">
          <button type="button" className="tdg-copilot-backdrop" aria-label="Close Christmas Copilot" onClick={state.closeCopilot} />
          <ChristmasCopilotPanel variant="sheet" {...panelProps} onClose={state.closeCopilot} />
        </div>
      ) : null}
    </>
  );
}
