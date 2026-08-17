import { MessageCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { supportFormPath } from "@/features/support/guards";
import { capturePetSupportContext } from "@/features/support/storage";

export default function SupportTicketWidget() {
  const location = useLocation();
  const navigate = useNavigate();
  const hidden =
    location.pathname.includes("/admin") || location.pathname === "/support";

  if (hidden) return null;

  function openSupport() {
    capturePetSupportContext({ search: location.search });
    void navigate(supportFormPath({ pathname: location.pathname }));
  }

  return (
    <button
      type="button"
      onClick={openSupport}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:brightness-110 sm:bottom-5 sm:right-5"
    >
      <MessageCircle className="h-4 w-4" />
      Help
    </button>
  );
}
