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

function unique(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

export function CreditsDisplay({ onBuyCredits }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [credits, setCredits] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCredits() {
      if (authLoading) return;

      setLoading(true);

      const email = user?.email?.trim().toLowerCase() ?? "";
      const authUserId = user?.id ? String(user.id) : "";

      if (!email && !authUserId) {
        if (!cancelled) {
          setCredits(0);
          setLoading(false);
        }
        return;
      }

      try {
        const keys: string[] = [];

        if (email) keys.push(email);
        if (authUserId) keys.push(authUserId);

        if (email) {
          const { data: appUser, error: appUserError } = await supabase
            .from("app_users")
            .select("id, convex_id, email")
            .ilike("email", email)
            .maybeSingle<AppUserRow>();

          if (appUserError) {
            console.error("[CreditsDisplay] app_users error:", appUserError);
          }

          if (appUser?.id !== null && appUser?.id !== undefined) {
            keys.push(String(appUser.id));
          }

          if (appUser?.convex_id !== null && appUser?.convex_id !== undefined) {
            keys.push(String(appUser.convex_id));
          }
        }

        const userKeys = unique(keys);

        if (userKeys.length === 0) {
          if (!cancelled) {
            setCredits(0);
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("credits_ledger")
          .select("direction, credits")
          .in("user_convex_id", userKeys);

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

    const channel = supabase
      .channel(`credits-display-${user?.id ?? user?.email ?? "guest"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "credits_ledger",
        },
        () => {
          void loadCredits();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user?.id, user?.email, authLoading]);

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