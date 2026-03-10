import * as React from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onBuyCredits?: () => void;
}

export function CreditsDisplay({ onBuyCredits }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [credits, setCredits] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCredits() {
      if (authLoading) return;

      if (!user?.id) {
        if (!cancelled) {
          setCredits(0);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_credits_balance_view")
          .select("credits_balance")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error("[CreditsDisplay] credits error:", error);
          setCredits(0);
        } else {
          setCredits(Number(data?.credits_balance ?? 0));
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
  }, [user?.id, authLoading]);

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