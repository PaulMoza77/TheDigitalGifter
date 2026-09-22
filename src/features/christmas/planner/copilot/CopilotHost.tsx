import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { trackPlannerEvent } from "../analytics";
import {
  executePlannerAction,
  loadDismissedInsightIds,
  loadPlannerWorkspace,
  runPlannerIntelligence,
} from "../intelligence";
import type { PlannerIntelligence } from "../intelligence/types";
import { usePlannerBundle } from "../Onboarding";
import { bumpPlannerWorkspace, onPlannerWorkspaceBump } from "../workspaceSync";
import { askCopilot, copilotEnabled, tryApplyCopilotPlan } from "./ask";
import {
  buildCopilotNextWin,
  buildCopilotSuggestions,
  copilotModuleFromPath,
} from "./context";
import { ChristmasCopilotPanel, type CopilotTurn } from "./ChristmasCopilotPanel";

type CopilotUi = {
  openCopilot: (seed?: string, module?: string) => void;
  closeCopilot: () => void;
  isDrawerOpen: boolean;
  desktop: boolean;
  enabled: boolean;
  panel: {
    intel: PlannerIntelligence | null;
    suggestions: ReturnType<typeof buildCopilotSuggestions>;
    nextWin: ReturnType<typeof buildCopilotNextWin>;
    turns: CopilotTurn[];
    question: string;
    applyNote: string | null;
    busy: boolean;
    onQuestionChange: (value: string) => void;
    onAsk: (prompt?: string) => void;
    onApply: (turn: CopilotTurn) => void;
  } | null;
};

const CopilotUiContext = createContext<CopilotUi | null>(null);

export function useCopilotUi() {
  return useContext(CopilotUiContext);
}

/** Docked right-rail panel for the shared planner shell (desktop only). */
export function ChristmasCopilotRail() {
  const ui = useCopilotUi();
  if (!ui?.enabled || !ui.desktop || !ui.panel) return null;
  return (
    <aside className="tdg-planner-copilot-rail" aria-label="Christmas Copilot">
      <ChristmasCopilotPanel mode="docked" {...ui.panel} />
    </aside>
  );
}

function useDesktopCopilot() {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1440px)").matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1440px)");
    const onChange = () => setDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return desktop;
}

export function CopilotHost({ children }: { children: ReactNode }) {
  const { profile, access } = usePlannerBundle();
  const location = useLocation();
  const desktop = useDesktopCopilot();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  const [seedModule, setSeedModule] = useState<string | null>(null);
  const [intel, setIntel] = useState<PlannerIntelligence | null>(null);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<CopilotTurn[]>([]);
  const [applyNote, setApplyNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const routeModule = useMemo(() => copilotModuleFromPath(location.pathname), [location.pathname]);
  const analyticsModule = seedModule || routeModule;

  const openCopilot = useCallback((nextSeed?: string, nextModule?: string) => {
    if (!copilotEnabled()) return;
    setSeedModule(nextModule || null);
    setSeed(nextSeed || null);
    if (nextSeed) setQuestion(nextSeed);
    setDrawerOpen(true);
  }, []);

  const closeCopilot = useCallback(() => {
    setDrawerOpen(false);
    setSeed(null);
    setSeedModule(null);
  }, []);

  useEffect(() => {
    if (!profile || !copilotEnabled()) {
      setIntel(null);
      return;
    }
    let cancelled = false;
    async function load() {
      const snapshot = await loadPlannerWorkspace(profile!);
      if (cancelled) return;
      const dismissed = loadDismissedInsightIds(profile!.id, profile!.season_year);
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

  const ask = useCallback(
    (prompt?: string) => {
      if (!intel || !copilotEnabled()) return;
      const q = (prompt ?? question).trim().slice(0, 240);
      if (!q) return;
      setBusy(true);
      const response = askCopilot(q, intel);
      setTurns((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}`,
          question: q,
          reply: response,
        },
      ]);
      setApplyNote(null);
      trackPlannerEvent("copilot_turn", {
        module: analyticsModule,
        metadata: { intent: response.modelPath, count_bucket: String(response.cards.length) },
      });
      setQuestion("");
      setBusy(false);
      if (!desktop) setDrawerOpen(true);
    },
    [intel, question, analyticsModule, desktop],
  );

  useEffect(() => {
    if (!seed || !intel) return;
    const q = seed;
    setSeed(null);
    trackPlannerEvent("copilot_opened", { module: analyticsModule });
    const response = askCopilot(q, intel);
    setTurns((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        question: q,
        reply: response,
      },
    ]);
    setApplyNote(null);
    setQuestion("");
    trackPlannerEvent("copilot_turn", {
      module: analyticsModule,
      metadata: { intent: response.modelPath, count_bucket: String(response.cards.length) },
    });
    if (!desktop) setDrawerOpen(true);
  }, [seed, intel, analyticsModule, desktop]);

  useEffect(() => {
    if (!drawerOpen || desktop || seed) return;
    trackPlannerEvent("copilot_opened", { module: analyticsModule });
  }, [drawerOpen, desktop, analyticsModule, seed]);

  const suggestions = useMemo(() => buildCopilotSuggestions(routeModule, intel), [routeModule, intel]);
  const nextWin = useMemo(() => buildCopilotNextWin(routeModule, intel), [routeModule, intel]);

  const onApply = useCallback(
    (turn: CopilotTurn) => {
      if (!profile || !intel || !turn.reply.actionPlan) return;
      void (async () => {
        const result = await tryApplyCopilotPlan({
          plan: turn.reply.actionPlan,
          confirm: true,
          snapshotVersion: turn.reply.snapshotVersion,
          execute: (request) =>
            executePlannerAction({ userId: profile.user_id, access, profile }, request),
        });
        setApplyNote(
          result.ok
            ? `Saved ${result.applied} change${result.applied === 1 ? "" : "s"} to your planner.`
            : result.message,
        );
        if (result.ok) bumpPlannerWorkspace();
      })();
    },
    [profile, access, intel],
  );

  const enabled = Boolean(copilotEnabled() && profile);
  const panelProps = enabled
    ? {
        intel,
        suggestions,
        nextWin,
        turns,
        question,
        applyNote,
        busy,
        onQuestionChange: setQuestion,
        onAsk: ask,
        onApply,
      }
    : null;

  return (
    <CopilotUiContext.Provider
      value={{
        openCopilot,
        closeCopilot,
        isDrawerOpen: drawerOpen,
        desktop,
        enabled,
        panel: panelProps,
      }}
    >
      {children}
      {enabled && !desktop && drawerOpen && panelProps ? (
        <div className="tdg-xmas-copilot-drawer-root" role="dialog" aria-modal="true" aria-label="Christmas Copilot">
          <button
            type="button"
            className="tdg-xmas-copilot-drawer-backdrop"
            aria-label="Close Christmas Copilot"
            onClick={closeCopilot}
          />
          <ChristmasCopilotPanel mode="drawer" {...panelProps} onClose={closeCopilot} />
        </div>
      ) : null}
    </CopilotUiContext.Provider>
  );
}
