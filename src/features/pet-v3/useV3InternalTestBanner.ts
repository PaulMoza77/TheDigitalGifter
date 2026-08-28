import { useEffect, useState } from "react";
import { fetchV3InternalTestStatus } from "./v3TestMode";
import { getPetV3SessionId } from "./session";

export function useV3InternalTestBanner() {
  const [active, setActive] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const status = await fetchV3InternalTestStatus(getPetV3SessionId());
      if (cancelled) return;
      setActive(status.authorized);
      setExpiresAt(status.expiresAt);
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return { active, expiresAt };
}
