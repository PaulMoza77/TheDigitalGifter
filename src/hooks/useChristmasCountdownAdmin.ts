import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ChristmasDatePreset, ChristmasDateRange } from "@/features/christmas-countdown/dateRange";
import { rangeForChristmasPreset } from "@/features/christmas-countdown/dateRange";
import type { ChristmasCountdownPublicConfig } from "@/features/christmas-countdown/defaults";
import { publicConfigFromUnknown } from "@/features/christmas-countdown/defaults";

export type ChristmasGa4State = {
  configured: boolean;
  propertyId: string | null;
  measurementId: string | null;
  missing: string[];
  report: {
    totals: {
      pageViews: number;
      totalUsers: number;
      sessions: number;
      engagedSessions: number | null;
      engagementRate: number | null;
      averageEngagementTimeSec: number | null;
      returningUsers: number | null;
      newUsers: number | null;
    };
    daily: Array<{ date: string; views: number; users: number }>;
    countries: Array<{ key: string; users: number; views: number }>;
    cities: Array<{ key: string; users: number; views: number }>;
    devices: Array<{ key: string; users: number; views: number }>;
    sources: Array<{ key: string; users: number; views: number }>;
    sourceMedium: Array<{ key: string; users: number; views: number }>;
    campaigns: Array<{ key: string; users: number; views: number }>;
    referrers: Array<{ key: string; users: number; views: number }>;
    eventCounts: Record<string, number> | null;
    eventMetricsAvailable: boolean;
  } | null;
  error: string | null;
  realtime: { activeUsers: number; viewsLast30m: number | null; countries: Array<{ key: string; users: number }> } | null;
  realtimeError: string | null;
};

export type ChristmasFirstPartyKpis = {
  signups_total: number;
  signups_email: number;
  signups_google: number;
  signups_returning: number;
  first_party_page_view_sessions: number;
  join_started_sessions: number;
  join_completed_sessions: number;
  google_auth_started_sessions: number;
  google_auth_completed_sessions: number;
  return_visit_sessions: number;
};

export type ChristmasSignupRow = {
  id: string;
  email: string;
  signup_method: "email" | "google" | string;
  created_at: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  referrer: string | null;
  user_id: string | null;
  last_seen_at: string | null;
  marketing_opt_in: boolean | null;
};

async function invokeAdmin<T>(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("christmas-admin", {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}

export function useChristmasCountdownAdmin(preset: ChristmasDatePreset, custom?: { from: string; to: string }) {
  const range = useMemo(() => rangeForChristmasPreset(preset, new Date(), custom), [preset, custom?.from, custom?.to]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ga4, setGa4] = useState<ChristmasGa4State | null>(null);
  const [firstParty, setFirstParty] = useState<ChristmasFirstPartyKpis | null>(null);
  const [firstPartyError, setFirstPartyError] = useState<string | null>(null);
  const [instrumentationNote, setInstrumentationNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invokeAdmin<{
        ga4: ChristmasGa4State;
        firstParty: ChristmasFirstPartyKpis | null;
        firstPartyError: string | null;
        instrumentationNote?: string;
      }>("dashboard", { from: range.from, to: range.to });
      setGa4(data.ga4);
      setFirstParty(data.firstParty);
      setFirstPartyError(data.firstPartyError);
      setInstrumentationNote(data.instrumentationNote || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Christmas analytics");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, ga4, firstParty, firstPartyError, instrumentationNote, refresh, range };
}

export function useChristmasSignups(range: ChristmasDateRange, filters: {
  search: string;
  method: string;
  source: string;
  campaign: string;
  page: number;
  pageSize?: number;
}) {
  const pageSize = filters.pageSize ?? 25;
  const [rows, setRows] = useState<ChristmasSignupRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = (filters.page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase
        .from("christmas_countdown_signups")
        .select(
          "id,email,signup_method,created_at,source,medium,campaign,referrer,user_id,last_seen_at,marketing_opt_in",
          { count: "exact" },
        )
        .gte("created_at", `${range.from}T00:00:00.000Z`)
        .lte("created_at", `${range.to}T23:59:59.999Z`)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (filters.method === "email" || filters.method === "google") query = query.eq("signup_method", filters.method);
      if (filters.search.trim()) query = query.ilike("email", `%${filters.search.trim()}%`);
      if (filters.source.trim()) query = query.eq("source", filters.source.trim());
      if (filters.campaign.trim()) query = query.eq("campaign", filters.campaign.trim());
      const { data, error: queryError, count } = await query;
      if (queryError) throw queryError;
      setRows((data || []) as ChristmasSignupRow[]);
      setTotal(count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load signups");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, filters.search, filters.method, filters.source, filters.campaign, filters.page, pageSize]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, total, loading, error, refresh, pageSize };
}

export function useChristmasCountdownSettings() {
  const [settings, setSettings] = useState<ChristmasCountdownPublicConfig>(publicConfigFromUnknown(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from("christmas_countdown_settings")
        .select("*")
        .eq("id", "default")
        .maybeSingle();
      if (queryError) throw queryError;
      setSettings(publicConfigFromUnknown(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
      setSettings(publicConfigFromUnknown(null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (next: ChristmasCountdownPublicConfig) => {
    setSaving(true);
    setError(null);
    try {
      const data = await invokeAdmin<{ settings: unknown }>("updateSettings", {
        countdown_target_at: next.countdownTargetAt,
        page_active: next.pageActive,
        signup_active: next.signupActive,
        headline: next.headline,
        supporting_copy: next.supportingCopy,
        cta_text: next.ctaText,
        success_message: next.successMessage,
        reached_message: next.reachedMessage,
      });
      setSettings(publicConfigFromUnknown(data.settings));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, setSettings, loading, saving, error, refresh, save };
}

export async function exportChristmasSignupsCsv(input: {
  from: string;
  to: string;
  search: string;
  method: string;
  source: string;
  campaign: string;
}) {
  const data = await invokeAdmin<{ csv: string; filename: string }>("exportCsv", {
    from: input.from,
    to: input.to,
    search: input.search,
    signup_method: input.method,
    source: input.source,
    campaign: input.campaign,
  });
  return data;
}
