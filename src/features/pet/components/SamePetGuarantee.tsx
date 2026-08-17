import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { PET_GUARANTEE } from "../catalog";
import { supportFormPath } from "@/features/support/guards";
import { capturePetSupportContext } from "@/features/support/storage";

export function SamePetGuarantee() {
  const navigate = useNavigate();

  function openSupport() {
    capturePetSupportContext({ search: window.location.search });
    void navigate(supportFormPath({ category: "pet_order", pathname: window.location.pathname }));
  }

  return (
    <aside className="rounded-2xl border border-[#d4a84b]/25 bg-[#d4a84b]/8 px-4 py-4">
      <h2 className="inline-flex items-center gap-2 text-base font-semibold text-[#f6efe4]">
        <ShieldCheck className="h-4 w-4 text-[#d4a84b]" aria-hidden="true" />
        {PET_GUARANTEE.heading}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#f6efe4]/70">{PET_GUARANTEE.body}</p>
      <button
        type="button"
        onClick={openSupport}
        className="mt-2 inline-flex min-h-[44px] items-center text-sm font-medium text-[#d4a84b] underline-offset-4 hover:underline"
      >
        Contact support
      </button>
    </aside>
  );
}
