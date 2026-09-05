import { useCallback, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { ChristmasLocale } from "../catalog";
import {
  CHRISTMAS_LOCALE_QUERY,
  persistChristmasLocale,
  resolveChristmasLocale,
  t as translate,
} from "./index";
import type { ChristmasEnKey } from "./en";

/**
 * Christmas locale for SPA pages.
 * Initial value resolves from ?lang= / storage / navigator synchronously
 * to avoid untranslated flash when possible.
 */
export function useChristmasLocale() {
  const [params, setParams] = useSearchParams();
  const [locale, setLocaleState] = useState<ChristmasLocale>(() =>
    resolveChristmasLocale({ search: typeof window !== "undefined" ? window.location.search : "" }),
  );

  useEffect(() => {
    const fromQuery = params.get(CHRISTMAS_LOCALE_QUERY);
    const next = resolveChristmasLocale({
      search: fromQuery ? `?${CHRISTMAS_LOCALE_QUERY}=${fromQuery}` : window.location.search,
    });
    setLocaleState(next);
  }, [params]);

  const setLocale = useCallback(
    (next: ChristmasLocale) => {
      persistChristmasLocale(next);
      setLocaleState(next);
      const nextParams = new URLSearchParams(params);
      nextParams.set(CHRISTMAS_LOCALE_QUERY, next);
      setParams(nextParams, { replace: true });
    },
    [params, setParams],
  );

  const t = useCallback(
    (key: ChristmasEnKey | string, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale],
  );

  return useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
}
