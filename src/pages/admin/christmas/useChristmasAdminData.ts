import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  sinceIso,
  type ChristmasClubSignupRow,
  type ChristmasCostRow,
  type ChristmasEmailRow,
  type ChristmasEventRow,
  type ChristmasOrderRow,
  type ChristmasSantaCostRow,
  type RangeDays,
} from "./christmasAdminTypes";

function emptyOnError<T>(error: { message: string } | null, data: T[] | null): T[] {
  if (error) return [];
  return data || [];
}

export function useChristmasAdminData(days: RangeDays) {
  const [events, setEvents] = useState<ChristmasEventRow[]>([]);
  const [orders, setOrders] = useState<ChristmasOrderRow[]>([]);
  const [emails, setEmails] = useState<ChristmasEmailRow[]>([]);
  const [legacyEmails, setLegacyEmails] = useState<ChristmasEmailRow[]>([]);
  const [costs, setCosts] = useState<ChristmasCostRow[]>([]);
  const [santaCosts, setSantaCosts] = useState<ChristmasSantaCostRow[]>([]);
  const [clubSignups, setClubSignups] = useState<ChristmasClubSignupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [softWarnings, setSoftWarnings] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const since = sinceIso(days);

    let eventQuery = supabase
      .from("christmas_funnel_events")
      .select("id,event_name,funnel_session_id,product_key,package_key,order_id,locale,pathname,device_type,amount_cents,utm_source,utm_campaign,is_test,environment,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(10000);
    let orderQuery = supabase
      .from("christmas_orders")
      .select("id,product_key,package_key,amount_cents,currency,payment_status,fulfillment_status,last_error,source_route,landing_path,metadata,created_at,paid_at,delivery_email_sent_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    let emailQuery = supabase
      .from("christmas_email_deliveries")
      .select("id,order_id,kind,status,last_error,created_at,sent_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    let legacyEmailQuery = supabase
      .from("christmas_v2_email_deliveries")
      .select("id,order_id,kind,status,created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    let costQuery = supabase
      .from("ai_cost_ledger")
      .select("cost_usd,product_family,model_name,is_mock,occurred_at,started_at")
      .like("product_family", "christmas%")
      .limit(8000);
    let santaQuery = supabase
      .from("christmas_santa_video_jobs")
      .select("cost_total_usd,created_at")
      .order("created_at", { ascending: false })
      .limit(3000);
    let clubQuery = supabase
      .from("christmas_club_signups")
      .select("id,created_at,source,status")
      .order("created_at", { ascending: false })
      .limit(5000);
    let v2Query = supabase
      .from("christmas_v2_funnel_events")
      .select("id,event_name,funnel_session_id,pathname,amount_cents,product,utm_source,utm_campaign,device_type,created_at")
      .order("created_at", { ascending: false })
      .limit(8000);

    if (since) {
      eventQuery = eventQuery.gte("created_at", since);
      orderQuery = orderQuery.gte("created_at", since);
      emailQuery = emailQuery.gte("created_at", since);
      legacyEmailQuery = legacyEmailQuery.gte("created_at", since);
      costQuery = costQuery.gte("started_at", since);
      santaQuery = santaQuery.gte("created_at", since);
      clubQuery = clubQuery.gte("created_at", since);
      v2Query = v2Query.gte("created_at", since);
    }

    const [
      eventResult,
      orderResult,
      emailResult,
      legacyResult,
      costResult,
      santaResult,
      clubResult,
      v2Result,
    ] = await Promise.all([
      eventQuery,
      orderQuery,
      emailQuery,
      legacyEmailQuery,
      costQuery,
      santaQuery,
      clubQuery,
      v2Query,
    ]);

    const critical = eventResult.error || orderResult.error;
    if (critical) {
      setError(critical.message);
      setLoading(false);
      return;
    }

    const v2Events: ChristmasEventRow[] = emptyOnError(v2Result.error, v2Result.data).map((row: Record<string, unknown>) => ({
      id: String(row.id || ""),
      event_name: String(row.event_name || ""),
      funnel_session_id: String(row.funnel_session_id || ""),
      product_key: row.product ? String(row.product) : "christmas_v2",
      package_key: null,
      order_id: null,
      locale: null,
      pathname: row.pathname ? String(row.pathname) : null,
      device_type: row.device_type ? String(row.device_type) : null,
      amount_cents: typeof row.amount_cents === "number" ? row.amount_cents : null,
      utm_source: row.utm_source ? String(row.utm_source) : null,
      utm_campaign: row.utm_campaign ? String(row.utm_campaign) : null,
      is_test: false,
      environment: null,
      metadata: null,
      created_at: String(row.created_at || ""),
    }));

    const warnings: string[] = [];
    if (costResult.error) warnings.push("AI cost ledger unavailable for this range.");
    if (santaResult.error) warnings.push("Santa job costs unavailable.");
    if (clubResult.error) warnings.push("Club signups table unavailable.");
    if (v2Result.error) warnings.push("Photos V2 events unavailable.");

    const mergedEvents = [...((eventResult.data || []) as ChristmasEventRow[]), ...v2Events].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
    );
    setEvents(mergedEvents);
    setOrders((orderResult.data || []) as ChristmasOrderRow[]);
    setEmails(emptyOnError(emailResult.error, emailResult.data) as ChristmasEmailRow[]);
    setLegacyEmails(emptyOnError(legacyResult.error, legacyResult.data) as ChristmasEmailRow[]);
    setCosts(emptyOnError(costResult.error, costResult.data) as ChristmasCostRow[]);
    setSantaCosts(emptyOnError(santaResult.error, santaResult.data) as ChristmasSantaCostRow[]);
    setClubSignups(emptyOnError(clubResult.error, clubResult.data) as ChristmasClubSignupRow[]);
    setSoftWarnings(warnings);
    setLoadedAt(new Date());
    setLoading(false);
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    events,
    orders,
    emails,
    legacyEmails,
    costs,
    santaCosts,
    clubSignups,
    loading,
    error,
    loadedAt,
    softWarnings,
    load,
  };
}
