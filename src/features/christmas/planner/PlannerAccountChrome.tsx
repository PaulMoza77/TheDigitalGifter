import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useUserCreditsQuery } from "@/data";

export function PlannerAccountChrome({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { data: credits = 0 } = useUserCreditsQuery();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!user) return null;
  const initial = (user.email || "A").slice(0, 1).toUpperCase();

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/christmas/planner");
  }

  return (
    <div className={`tdg-planner-account-chrome${compact ? " is-compact" : ""}`} ref={ref}>
      {!compact ? (
        <>
          <Link className="tdg-planner-credit-pill" to="/account" data-testid="planner-shell-credits">
            {Number(credits || 0)} credits
          </Link>
          <Link className="tdg-planner-create-link" to="/generator">
            Create
          </Link>
        </>
      ) : null}
      <button type="button" className="tdg-planner-avatar" aria-label="Account menu" onClick={() => setOpen((v) => !v)}>
        {initial}
      </button>
      {open ? (
        <div className="tdg-planner-account-menu">
          <Link to="/account" onClick={() => setOpen(false)}>
            My account
          </Link>
          <Link to="/generator" onClick={() => setOpen(false)}>
            Create
          </Link>
          <Link to="/account" onClick={() => setOpen(false)}>
            {Number(credits || 0)} credits
          </Link>
          <button type="button" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
