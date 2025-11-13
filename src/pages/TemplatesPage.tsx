import { useNavigate } from "react-router-dom";
import TemplatesGrid from "../components/TemplatesGrid";

export default function TemplatesPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <button
        onClick={() => void navigate("/")}
        className="rounded-full px-4 py-2 text-sm border border-white/20 bg-white/10 hover:bg-white/15 transition will-change-transform hover:scale-[1.04] text-white mb-4"
      >
        ← Back to Home
      </button>
      <TemplatesGrid />
    </div>
  );
}
