// FILE: src/hooks/useAccountOverview.ts
import * as React from "react";
import { supabase } from "@/lib/supabase";

type LedgerBalanceRow = {
  direction: "in" | "out" | null;
  credits: number | string | null;
};

type AffiliateProfileRow = {
  user_id: string;
  available_earnings: number | string | null;
};

type AffiliateEarningRow = {
  amount: number | string | null;
};

type AffiliateConversionRow = {
  commission_amount: number | string | null;
};

type AppUserRow = {
  id: string | number | null;
  convex_id: string | number | null;
  email: string | null;
};

export type AccountOverview = {
  loading: boolean;
  isAdmin: boolean;
  creditsRemaining: number;
  creditsUsed: number;
  affiliateEarnings: number;
  refresh: () => Promise<void>;
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function resolveCreditKey(input: {
  email: string;
  authUserId: string;
}): Promise<string> {
  const email = input.email.trim().toLowerCase();
  const authUserId = input.authUserId.trim();

  if (email) {
    const { data: appUser } = await supabase
      .from("app_users")
      .select("id, convex_id, email")
      .ilike("email", email)
      .maybeSingle<AppUserRow>();

    if (appUser?.convex_id !== null && appUser?.convex_id !== undefined) {
      return String(appUser.convex_id);
    }

    if (appUser?.id !== null && appUser?.id !== undefined) {
      return String(appUser.id);
    }
  }

  return authUserId || email;
}

async function loadAffiliateEarnings(userId: string): Promise<number> {
  const [
    { data: profile },
    { data: earningsRows, error: earningsError },
    { data: conversionRows, error: conversionError },
  ] = await Promise.all([
    supabase
      .from("affiliate_profiles")
      .select("user_id, available_earnings")
      .eq("user_id", userId)
      .maybeSingle<AffiliateProfileRow>(),

    supabase
      .from("affiliate_earnings")
      .select("amount")
      .eq("affiliate_user_id", userId)
      .eq("status", "pending"),

    supabase
      .from("affiliate_conversions")
      .select("commission_amount")
      .eq("affiliate_user_id", userId),
  ]);

  if (earningsError) {
    console.error("[useAccountOverview] affiliate earnings error:", earningsError);
  }

  if (conversionError) {
    console.error("[useAccountOverview] affiliate conversions error:", conversionError);
  }

  const earningsTotal = ((earningsRows ?? []) as AffiliateEarningRow[]).reduce(
    (sum, row) => sum + toNumber(row.amount),
    0,
  );

  const conversionsTotal = ((conversionRows ?? []) as AffiliateConversionRow[]).reduce(
    (sum, row) => sum + toNumber(row.commission_amount),
    0,
  );

  if (earningsTotal > 0) return earningsTotal;
  if (conversionsTotal > 0) return conversionsTotal;

  return toNumber(profile?.available_earnings);
}

export function useAccountOverview(): AccountOverview {
  const [loading, setLoading] = React.useState(true);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [creditsRemaining, setCreditsRemaining] = React.useState(0);
  const [creditsUsed, setCreditsUsed] = React.useState(0);
  const [affiliateEarnings, setAffiliateEarnings] = React.useState(0);

  const refresh = React.useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setIsAdmin(false);
        setCreditsRemaining(0);
        setCreditsUsed(0);
        setAffiliateEarnings(0);
        return;
      }

      const email = user.email?.trim().toLowerCase() ?? "";
      const authUserId = String(user.id ?? "");
      const creditKey = await resolveCreditKey({ email, authUserId });

      const [adminResult, ledgerResult, affiliateTotal] = await Promise.all([
        email
          ? supabase
              .from("admin_users")
              .select("email")
              .eq("email", email)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),

        creditKey
          ? supabase
              .from("credits_ledger")
              .select("direction, credits")
              .eq("user_convex_id", creditKey)
          : Promise.resolve({ data: [], error: null }),

        loadAffiliateEarnings(authUserId),
      ]);

      setIsAdmin(Boolean(adminResult.data?.email));

      if (ledgerResult.error) {
        console.error("[useAccountOverview] credits ledger error:", ledgerResult.error);
        setCreditsRemaining(0);
        setCreditsUsed(0);
      } else {
        const rows = (ledgerResult.data ?? []) as LedgerBalanceRow[];

        const remaining = rows.reduce((sum, row) => {
          const value = toNumber(row.credits);
          if (row.direction === "in") return sum + value;
          if (row.direction === "out") return sum - value;
          return sum;
        }, 0);

        const used = rows.reduce((sum, row) => {
          const value = toNumber(row.credits);
          return row.direction === "out" ? sum + value : sum;
        }, 0);

        setCreditsRemaining(Math.max(0, remaining));
        setCreditsUsed(Math.max(0, used));
      }

      setAffiliateEarnings(affiliateTotal);
    } catch (error) {
      console.error("[useAccountOverview] fatal:", error);
      setIsAdmin(false);
      setCreditsRemaining(0);
      setCreditsUsed(0);
      setAffiliateEarnings(0);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();

    const onRefresh = () => void refresh();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    window.addEventListener("focus", onRefresh);
    window.addEventListener("credits:refresh", onRefresh);
    window.addEventListener("affiliate:refresh", onRefresh);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const interval = window.setInterval(() => {
      void refresh();
    }, 30000);

    return () => {
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("credits:refresh", onRefresh);
      window.removeEventListener("affiliate:refresh", onRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return {
    loading,
    isAdmin,
    creditsRemaining,
    creditsUsed,
    affiliateEarnings,
    refresh,
  };
}