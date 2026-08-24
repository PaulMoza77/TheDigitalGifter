import { Button } from "@/components/ui/button";

export function StickyCta({
  onClick,
  label,
  visible = true,
  supporting,
}: {
  onClick: () => void;
  label: string;
  visible?: boolean;
  supporting?: string;
}) {
  if (!visible) return null;

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-[#f6efe4]/10 bg-[#140e0a]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
      <Button
        type="button"
        onClick={onClick}
        className="h-12 min-h-[44px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
      >
        {label}
      </Button>
      {supporting ? (
        <p className="mt-1.5 text-center text-[11px] text-[#f6efe4]/55">{supporting}</p>
      ) : null}
    </div>
  );
}
