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

export function CreditsDisplay({ onBuyCredits }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [credits, setCredits] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCredits() {
      if (authLoading) return;

      const email = user?.email?.trim().toLowerCase() ?? "";

      if (!email) {
        if (!cancelled) {
          setCredits(0);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("credits_ledger")
          .select("direction, credits")
          .eq("user_convex_id", email)
          .order("occurred_at", { ascending: false });

        if (cancelled) return;

        if (error) {
          console.error("[CreditsDisplay] credits ledger error:", error);
          setCredits(0);
        } else {
          const balance = ((data ?? []) as LedgerBalanceRow[]).reduce(
            (sum, row) => {
              const value = Number(row.credits ?? 0);

              if (!Number.isFinite(value)) return sum;
              if (row.direction === "in") return sum + value;
              if (row.direction === "out") return sum - value;
              return sum;
            },
            0
          );

          setCredits(balance);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("[CreditsDisplay] fatal:", e);
          setCredits(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCredits();

    return () => {
      cancelled = true;
    };
  }, [user?.email, authLoading]);

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
      <span className="font-bold text-[#ffd976]">
        {loading ? "0" : credits}
      </span>
    </button>
  );
}