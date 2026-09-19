import { useCallback, useState } from "react";
import {
  filterObviousDuplicates,
  runGiftFinder,
} from "./service";
import type { GiftFinderRunInput, GiftIdea } from "./logic";

export type GiftFinderPhase = "idle" | "loading" | "results" | "error";

export function useGiftFinder() {
  const [phase, setPhase] = useState<GiftFinderPhase>("idle");
  const [ideas, setIdeas] = useState<GiftIdea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<GiftFinderRunInput | null>(null);

  const generate = useCallback(async (input: GiftFinderRunInput, excludeTitles: string[] = []) => {
    setPhase("loading");
    setError(null);
    setLastInput(input);
    try {
      const result = await runGiftFinder(input);
      const ideasNext = filterObviousDuplicates(result.ideas, excludeTitles);
      setIdeas(ideasNext);
      setSessionId(result.sessionId);
      setProvider(result.provider);
      setPhase("results");
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "finder_failed";
      setError(msg);
      setPhase("error");
      throw e;
    }
  }, []);

  const dismissIdea = useCallback((idea: GiftIdea) => {
    const key = idea.id || idea.result_key || idea.title;
    setIdeas((prev) => prev.filter((row) => (row.id || row.result_key || row.title) !== key));
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setIdeas([]);
    setError(null);
    setSessionId(null);
    setProvider(null);
  }, []);

  return {
    phase,
    ideas,
    error,
    sessionId,
    provider,
    lastInput,
    generate,
    dismissIdea,
    reset,
    setIdeas,
  };
}
