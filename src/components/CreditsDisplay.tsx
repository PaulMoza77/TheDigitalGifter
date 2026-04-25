import * as React from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onBuyCredits?: () => void;
}

type LedgerBalanceRow = {
  direction: "in" | "out" | null;
  credits: number | string | null;
};

type AppUserRow = {
  id: string | number | null;
  convex_id: string | number | null;
  email: string | null;
};

export function CreditsDisplay({ onBuyCredits }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [credits, setCredits] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  const loadCredits = React.useCallback(async () => {
    if (authLoading) return;

    const email = user?.email?.trim().toLowerCase() ?? "";

    if (!email) {
      setCredits(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: appUser, error: appUserError } = await supabase
        .from("app_users")
        .select("id, convex_id, email")
        .ilike("email", email)
        .maybeSingle<AppUserRow>();

      if (appUserError) {
        console.error("[CreditsDisplay] app_users error:", appUserError);
      }

      const creditKey =
        appUser?.convex_id !== null && appUser?.convex_id !== undefined
          ? String(appUser.convex_id)
          : appUser?.id !== null && appUser?.id !== undefined
          ? String(appUser.id)
          : email;

      const { data, error } = await supabase
        .from("credits_ledger")
        .select("direction, credits")
        .eq("user_convex_id", creditKey);

      if (error) {
        console.error("[CreditsDisplay] credits ledger error:", error);
        setCredits(0);
        return;
      }

      const balance = ((data ?? []) as LedgerBalanceRow[]).reduce((sum, row) => {
        const value = Number(row.credits ?? 0);

        if (!Number.isFinite(value)) return sum;
        if (row.direction === "in") return sum + value;
        if (row.direction === "out") return sum - value;
        return sum;
      }, 0);

      setCredits(balance);
    } catch (error) {
      console.error("[CreditsDisplay] fatal:", error);
      setCredits(0);
    } finally {
      setLoading(false);
    }
  }, [authLoading, user?.email]);

  React.useEffect(() => {
    void loadCredits();

    const handleCreditsRefresh = () => {
      void loadCredits();
    };

    const handleFocus = () => {
      void loadCredits();
    };

    window.addEventListener("credits:refresh", handleCreditsRefresh);
    window.addEventListener("focus", handleFocus);

    const interval = window.setInterval(() => {
      void loadCredits();
    }, 15000);

    return () => {
      window.removeEventListener("credits:refresh", handleCreditsRefresh);
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(interval);
    };
  }, [loadCredits]);

  if (authLoading) {
    return (
      <div className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/70">
        ...
      </div>
    );
  }

  if (!user) return null;

  return (
    <button
      type="button"
      onClick={onBuyCredits}
      className="rounded-full flex items-center gap-2 border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/90"
    >
      <Plus size={18} />
      <span className="hidden sm:inline">Credits:</span>
      <span className="font-bold text-[#ffd976]">{loading ? "0" : credits}</span>
    </button>
  );
}