// FILE: src/hooks/useAdminOverview.ts
import * as React from "react";
import { supabase } from "@/lib/supabase";

export type AdminDateRange = {
  from: string;
  to: string;
};

export type AdminValueCard = {
  label: string;
  value: number;
  revenue: number;
};

export type AdminListItem = {
  label: string;
  value: string;
  helper?: string;
};

export type AdminOverviewData = {
  loading: boolean;
  error: string;
  totals: {
    totalGenerated: number;
    customers: number;
    orders: number;
    generations: number;
    creditsInCirculation: number;
    creditsUsed: number;
    totalRevenue: number;
  };
  subscriptions: AdminValueCard[];
  bundleOffers: AdminValueCard[];
  creditsBought: AdminValueCard[];
  topRegions: AdminListItem[];
  topCategories: AdminListItem[];
  topTemplates: AdminListItem[];
  customerBehaviour: AdminListItem[];
  refresh: () => Promise<void>;
};

type OrderRow = {
  id: number;
  amount: number | string | null;
  pack: string | null;
  status: string | null;
  created_at: string | null;
  currency: string | null;
  amount_total_cents: number | string | null;
  product_type: string | null;
  credits_granted: number | string | null;
  user_convex_id: string | null;
  user_id: string | null;
  email: string | null;
};

type CustomerRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  user_id: string | null;
};

type GenerationRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  status: string | null;
  title: string | null;
  occasion_slug: string | null;
  style_slug: string | null;
  is_saved: boolean | null;
  created_at: string | null;
};

type CreditLedgerRow = {
  id: string;
  user_convex_id: string;
  event_type: string;
  direction: string;
  credits: number | string;
  template_title: string | null;
  category: string | null;
  amount: number | string | null;
  currency: string | null;
  occurred_at: string | null;
};

const emptyTotals = {
  totalGenerated: 0,
  customers: 0,
  orders: 0,
  generations: 0,
  creditsInCirculation: 0,
  creditsUsed: 0,
  totalRevenue: 0,
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function normalizeStatus(value: unknown) {
  return clean(value).toLowerCase();
}

function isCompletedOrder(order: OrderRow) {
  const status = normalizeStatus(order.status);
  return status === "completed" || status === "paid" || status === "succeeded";
}

function orderAmount(order: OrderRow) {
  const cents = toNumber(order.amount_total_cents);
  if (cents > 0) return cents / 100;
  return toNumber(order.amount);
}

function rangeToIso(from: string, to: string) {
  return {
    fromIso: `${from}T00:00:00.000Z`,
    toIso: `${to}T23:59:59.999Z`,
  };
}

async function fetchCount(table: string) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error(`[useAdminOverview] count ${table}:`, error);
    return 0;
  }

  return count ?? 0;
}

async function fetchRows<T>(
  table: string,
  columns: string,
  dateColumn: string,
  from: string,
  to: string
): Promise<T[]> {
  const { fromIso, toIso } = rangeToIso(from, to);

  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .gte(dateColumn, fromIso)
    .lte(dateColumn, toIso);

  if (error) {
    console.error(`[useAdminOverview] ${table} ranged error:`, error);
    return [];
  }

  return (data ?? []) as T[];
}

function groupOrdersByPack(orders: OrderRow[], labels: string[]) {
  return labels.map((label) => {
    const target = label.toLowerCase();

    const rows = orders.filter((order) => {
      const pack = clean(order.pack).toLowerCase();
      const productType = clean(order.product_type).toLowerCase();

      return pack === target || productType === target;
    });

    return {
      label,
      value: rows.length,
      revenue: rows.reduce((sum, order) => sum + orderAmount(order), 0),
    };
  });
}

function groupByCount<T>(
  rows: T[],
  getKey: (row: T) => string,
  limit = 5
): AdminListItem[] {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const key = getKey(row) || "Unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      value: String(count),
    }));
}

function buildTopRegions(orders: OrderRow[]) {
  const revenue = orders.reduce((sum, order) => sum + orderAmount(order), 0);

  return [
    {
      label: "Unknown",
      value: `€${revenue.toFixed(2)}`,
      helper: "No country/region column exists yet in orders/customers.",
    },
  ];
}

function buildCustomerBehaviour(
  customers: CustomerRow[],
  orders: OrderRow[],
  ledger: CreditLedgerRow[]
) {
  const customerOrderCount = new Map<string, number>();

  orders.forEach((order) => {
    const key = order.user_convex_id || order.user_id || order.email || "";
    if (!key) return;
    customerOrderCount.set(key, (customerOrderCount.get(key) ?? 0) + 1);
  });

  const totalKnownCustomers = customerOrderCount.size;
  const returningCustomers = Array.from(customerOrderCount.values()).filter(
    (count) => count >= 2
  ).length;
  const newCustomers = Math.max(0, totalKnownCustomers - returningCustomers);

  const newPercent =
    totalKnownCustomers > 0 ? (newCustomers / totalKnownCustomers) * 100 : 0;
  const returningPercent =
    totalKnownCustomers > 0 ? (returningCustomers / totalKnownCustomers) * 100 : 0;

  const creditsUsed = ledger
    .filter((row) => clean(row.direction).toLowerCase() === "out")
    .reduce((sum, row) => sum + toNumber(row.credits), 0);

  const avgCreditsUsed = orders.length > 0 ? creditsUsed / orders.length : 0;

  return [
    {
      label: "New vs returning customers",
      value: `${newPercent.toFixed(1)}% new · ${returningPercent.toFixed(1)}% returning`,
    },
    {
      label: "Total customer records",
      value: String(customers.length),
    },
    {
      label: "Average credits used per order",
      value: avgCreditsUsed.toFixed(1),
    },
    {
      label: "Customers with 2+ orders",
      value: String(returningCustomers),
    },
  ];
}

export function useAdminOverview(range: AdminDateRange): AdminOverviewData {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [totals, setTotals] = React.useState(emptyTotals);
  const [subscriptions, setSubscriptions] = React.useState<AdminValueCard[]>([]);
  const [bundleOffers, setBundleOffers] = React.useState<AdminValueCard[]>([]);
  const [creditsBought, setCreditsBought] = React.useState<AdminValueCard[]>([]);
  const [topRegions, setTopRegions] = React.useState<AdminListItem[]>([]);
  const [topCategories, setTopCategories] = React.useState<AdminListItem[]>([]);
  const [topTemplates, setTopTemplates] = React.useState<AdminListItem[]>([]);
  const [customerBehaviour, setCustomerBehaviour] = React.useState<AdminListItem[]>([]);

  const from = range.from;
  const to = range.to;

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [customersTotal, ordersTotal, generationsTotal] = await Promise.all([
        fetchCount("customers"),
        fetchCount("orders"),
        fetchCount("generations"),
      ]);

      const [ordersRaw, customers, generations, ledger] = await Promise.all([
        fetchRows<OrderRow>(
          "orders",
          "id, user_convex_id, amount, pack, status, created_at, email, currency, amount_total_cents, product_type, credits_granted, user_id",
          "created_at",
          from,
          to
        ),
        fetchRows<CustomerRow>(
          "customers",
          "id, email, created_at, user_id",
          "created_at",
          from,
          to
        ),
        fetchRows<GenerationRow>(
          "generations",
          "id, user_id, email, status, title, occasion_slug, style_slug, is_saved, created_at",
          "created_at",
          from,
          to
        ),
        fetchRows<CreditLedgerRow>(
          "credits_ledger",
          "id, user_convex_id, event_type, direction, credits, template_title, category, amount, currency, occurred_at",
          "occurred_at",
          from,
          to
        ),
      ]);

      const orders = ordersRaw.filter(isCompletedOrder);

      const creditsIn = ledger
        .filter((row) => clean(row.direction).toLowerCase() === "in")
        .reduce((sum, row) => sum + toNumber(row.credits), 0);

      const creditsOut = ledger
        .filter((row) => clean(row.direction).toLowerCase() === "out")
        .reduce((sum, row) => sum + toNumber(row.credits), 0);

      const totalRevenue = orders.reduce((sum, order) => sum + orderAmount(order), 0);

      const subscriptionOrders = orders.filter((order) => {
        const pack = clean(order.pack).toLowerCase();
        const productType = clean(order.product_type).toLowerCase();

        return (
          productType.includes("subscription") ||
          ["starter", "pro", "elite"].includes(pack)
        );
      });

      const bundleOrders = orders.filter((order) => {
        const pack = clean(order.pack).toLowerCase();
        const productType = clean(order.product_type).toLowerCase();

        return (
          productType.includes("bundle") ||
          ["starter", "creator", "pro", "enterprise"].includes(pack)
        );
      });

      const creditOrders = orders.filter((order) => {
        const productType = clean(order.product_type).toLowerCase();
        return productType.includes("credit") || toNumber(order.credits_granted) > 0;
      });

      setTotals({
        totalGenerated: generations.length || generationsTotal,
        customers: customersTotal,
        orders: orders.length || ordersTotal,
        generations: generations.length || generationsTotal,
        creditsInCirculation: Math.max(0, creditsIn - creditsOut),
        creditsUsed: creditsOut,
        totalRevenue,
      });

      setSubscriptions(groupOrdersByPack(subscriptionOrders, ["Starter", "Pro", "Elite"]));
      setBundleOffers(groupOrdersByPack(bundleOrders, ["Starter", "Creator", "Pro", "Enterprise"]));
      setCreditsBought(groupOrdersByPack(creditOrders, ["Starter", "Creator", "Pro", "Enterprise"]));

      setTopRegions(buildTopRegions(orders));
      setTopCategories(
        groupByCount(generations, (row) => clean(row.occasion_slug) || "Unknown", 5)
      );
      setTopTemplates(
        groupByCount(generations, (row) => clean(row.title) || "Unknown", 5)
      );
      setCustomerBehaviour(buildCustomerBehaviour(customers, orders, ledger));
    } catch (err) {
      console.error("[useAdminOverview] fatal:", err);
      setError(err instanceof Error ? err.message : "Failed to load admin overview.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    loading,
    error,
    totals,
    subscriptions,
    bundleOffers,
    creditsBought,
    topRegions,
    topCategories,
    topTemplates,
    customerBehaviour,
    refresh,
  };
}