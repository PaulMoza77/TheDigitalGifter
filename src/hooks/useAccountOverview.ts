import * as React from "react";
import { supabase } from "@/lib/supabase";

type LedgerBalanceRow = {
  direction: "in" | "out" | null;
  credits: number | string | null;
};

type AffiliateEarningRow = {
  amount: number | string | null;
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

function toNumber(value: number | string | null | undefined) {
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
    const { data: appUser, error } = await supabase
      .from("app_users")
      .select("id, convex_id, email")
      .ilike("email", email)
      .maybeSingle<AppUserRow>();

    if (error) {
      console.error("[useAccountOverview] app_users error:", error);
    }

    if (appUser?.convex_id !== null && appUser?.convex_id !== undefined) {
      return String(appUser.convex_id);
    }

    if (appUser?.id !== null && appUser?.id !== undefined) {
      return String(appUser.id);
    }
  }

  return authUserId || email;
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
      const authUserId = user.id ? String(user.id) : "";
      const creditKey = await resolveCreditKey({ email, authUserId });

      const [adminResult, ledgerResult, earningsResult] = await Promise.all([
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

        supabase
          .from("affiliate_earnings")
          .select("amount")
          .eq("user_id", user.id),
      ]);

      if (adminResult.error) {
        console.error("[useAccountOverview] admin error:", adminResult.error);
        setIsAdmin(false);
      } else {
        setIsAdmin(Boolean(adminResult.data?.email));
      }

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

      if (earningsResult.error) {
        console.error("[useAccountOverview] affiliate error:", earningsResult.error);
        setAffiliateEarnings(0);
      } else {
        const total = ((earningsResult.data ?? []) as AffiliateEarningRow[]).reduce(
          (sum, row) => sum + toNumber(row.amount),
          0
        );

        setAffiliateEarnings(total);
      }
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

    const onFocus = () => void refresh();

    const onCreditsRefresh = () => void refresh();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("credits:refresh", onCreditsRefresh);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("credits:refresh", onCreditsRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
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