import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  ADMIN_SEEN_ORDERS_KEY,
  ADMIN_SEEN_PET_ORDERS_KEY,
  isOrdersPath,
  isPetOrdersPath,
  unseenSince,
} from "@/hooks/adminNavAlerts";

export type AdminNavAlerts = {
  tickets: number;
  orders: number;
  petOrders: number;
};

function readSeen(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSeen(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
}

function makeChannelName(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

async function countRows(
  table: string,
  apply: (query: any) => any
): Promise<number> {
  const { count, error } = await apply(
    supabase.from(table).select("id", { count: "exact", head: true })
  );
  if (error) {
    console.error(`[useAdminNavAlerts] count ${table}:`, error);
    return 0;
  }
  return count ?? 0;
}

export function useAdminNavAlerts(): AdminNavAlerts {
  const { pathname } = useLocation();
  const [tickets, setTickets] = useState(0);
  const [orders, setOrders] = useState(0);
  const [petOrders, setPetOrders] = useState(0);

  const refresh = useCallback(async () => {
    const now = new Date().toISOString();
    const viewingOrders = isOrdersPath(pathname);
    const viewingPetOrders = isPetOrdersPath(pathname);

    if (viewingOrders) writeSeen(ADMIN_SEEN_ORDERS_KEY, now);
    if (viewingPetOrders) writeSeen(ADMIN_SEEN_PET_ORDERS_KEY, now);

    const orderSince = unseenSince(readSeen(ADMIN_SEEN_ORDERS_KEY));
    const petSince = unseenSince(readSeen(ADMIN_SEEN_PET_ORDERS_KEY));

    const [ticketCount, orderCount, petCount] = await Promise.all([
      countRows("support_tickets", (query) => query.neq("status", "closed")),
      viewingOrders
        ? Promise.resolve(0)
        : countRows("orders", (query) => query.gt("created_at", orderSince)),
      viewingPetOrders
        ? Promise.resolve(0)
        : countRows("pet_orders", (query) => query.gt("paid_at", petSince)),
    ]);

    setTickets(ticketCount);
    setOrders(orderCount);
    setPetOrders(petCount);
  }, [pathname]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const tick = () => {
      void refreshRef.current();
    };

    tick();

    const interval = window.setInterval(tick, 20000);

    const ticketsChannel = supabase
      .channel(makeChannelName("admin-nav-tickets"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        tick
      )
      .subscribe();

    const ordersChannel = supabase
      .channel(makeChannelName("admin-nav-orders"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        tick
      )
      .subscribe();

    const petChannel = supabase
      .channel(makeChannelName("admin-nav-pet-orders"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pet_orders" },
        tick
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(ticketsChannel);
      void supabase.removeChannel(ordersChannel);
      void supabase.removeChannel(petChannel);
    };
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { tickets, orders, petOrders };
}
