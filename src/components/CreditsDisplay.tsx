import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Plus } from "lucide-react";

interface Props {
  onBuyCredits?: () => void;
}

export function CreditsDisplay({ onBuyCredits }: Props) {
  const credits = useQuery(api.credits.getUserCredits);

  if (credits === undefined) {
    return (
      <div className="rounded-full px-3 py-2 text-sm border border-white/20 bg-white/10">
        <span className="text-white/60">Loading...</span>
      </div>
    );
  }

  return (
    <button
      className="rounded-full flex items-center gap-2 px-3 py-2 text-sm border border-white/20 bg-white/10 text-white/90"
      onClick={onBuyCredits}
    >
      <Plus size={20} />
      <span className="hidden sm:inline text-white/90">Credits:</span>{" "}
      <span className="font-bold text-[#ffd976]">{credits}</span>
    </button>
  );
}
