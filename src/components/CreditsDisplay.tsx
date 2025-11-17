import { memo } from "react";
import { Plus } from "lucide-react";
import { useUserCreditsQuery } from "@/data";

interface Props {
  onBuyCredits?: () => void;
}

export const CreditsDisplay = memo(function CreditsDisplay({
  onBuyCredits,
}: Props) {
  const { data: credits, isLoading } = useUserCreditsQuery();

  if (isLoading) {
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
      type="button"
    >
      <Plus size={20} />
      <span className="hidden sm:inline text-white/90">Credits:</span>{" "}
      <span className="font-bold text-[#ffd976]">{credits ?? 0}</span>
    </button>
  );
});
