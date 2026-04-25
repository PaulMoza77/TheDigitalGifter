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
  inserted_at: string | null;
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
  full_name: string | null;
  source: string | null;
  source_funnel: string | null;
  created_at: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  last_activity: string | null;
  user_id: string | null;
};

type GenerationRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  order_id: string | null;
  status: string | null;
  title: string | null;
  occasion_slug: string | null;
  style_slug: string | null;
  is_saved: boolean | null;
  created_at: string | null;
  completed_at: string | null;
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
  created_at: string | null;
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function orderAmount(row: OrderRow) {
  const cents = toNumber(row.amount_total_cents);
  if (cents > 0) return cents / 100;

  return toNumber(row.amount);
}

function isCompletedOrder(row: OrderRow) {
  const status = normalizeText(row.status).toLowerCase();
  return status === "completed" || status === "paid" || status === "succeeded";
}

function getRangeIso(range: AdminDateRange) {
  return {
    fromIso: `${range.from}T00:00:00.000Z`,
    toIso: `${range.to}T23:59:59.999Z`,
  };
}

async function fetchRows<T>(
  table: string,
  columns: string,
  dateColumn: string,
  range: AdminDateRange
): Promise<T[]> {
  const { fromIso, toIso } = getRangeIso(range);

  const ranged = await supabase
    .from(table)
    .select(columns)
    .gte(dateColumn, fromIso)
    .lte(dateColumn, toIso);

  if (!ranged.error) return (ranged.data ?? []) as T[];

  console.error(`[useAdminOverview] ${table} ranged error:`, ranged.error);

  const fallback = await supabase.from(table).select(columns);

  if (fallback.error) {
    console.error(`[useAdminOverview] ${table} fallback error:`, fallback.error);
    return [];
  }

  return (fallback.data ?? []) as T[];
}

async function countRows(table: string) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error(`[useAdminOverview] count ${table} error:`, error);
    return 0;
  }

  return count ?? 0;
}

function groupOrdersByPack(orders: OrderRow[], labels: string[]) {
  return labels.map((label) => {
    const rows = orders.filter((order) => {
      const pack = normalizeText(order.pack).toLowerCase();
      const productType = normalizeText(order.product_type).toLowerCase();
      const normalizedLabel = label.toLowerCase();

      return pack === normalizedLabel || productType === normalizedLabel;
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

function buildTopCategories(generations: GenerationRow[], orders: OrderRow[]) {
  const fromGenerations = groupByCount(
    generations,
    (row) => normalizeText(row.occasion_slug) || "Unknown",
    5
  );

  if (fromGenerations.length > 0) return fromGenerations;

  return groupByCount(
    orders,
    (row) => normalizeText(row.pack) || normalizeText(row.product_type) || "Unknown",
    5
  );
}

function buildTopTemplates(generations: GenerationRow[], ledger: CreditLedgerRow[]) {
  const generationTemplates = groupByCount(
    generations,
    (row) => normalizeText(row.title) || "Unknown",
    5
  );

  if (generationTemplates.length > 0) return generationTemplates;

  return groupByCount(
    ledger,
    (row) => normalizeText(row.template_title) || "Unknown",
    5
  );
}

function buildTopRegions(orders: OrderRow[]) {
  const completed = orders.filter(isCompletedOrder);
  const revenue = completed.reduce((sum, row) => sum + orderAmount(row), 0);

  return [
    {
      label: "Unknown",
      value: `€${revenue.toFixed(2)}`,
      helper: "No country/region column found in orders/customers.",
    },
  ];
}

function buildCustomerBehaviour(customers: CustomerRow[], orders: OrderRow[], ledger: CreditLedgerRow[]) {
  const completedOrders = orders.filter(isCompletedOrder);
  const knownCustomers = new Set(
    completedOrders
      .map((order) => order.user_convex_id || order.user_id || order.email)
      .filter(Boolean)
  );

  const returningCustomers = new Set<string>();

  completedOrders.forEach((order) => {
    const key = order.user_convex_id || order.user_id || order.email || "";
    if (!key) return;

    const count = completedOrders.filter(
      (item) => (item.user_convex_id || item.user_id || item.email || "") === key
    ).length;

    if (count >= 2) returningCustomers.add(key);
  });

  const newCustomers = Math.max(0, knownCustomers.size - returningCustomers.size);

  const avgCreditsUsed =
    completedOrders.length > 0
      ? ledger
          .filter((row) => normalizeText(row.direction).toLowerCase() === "out")
          .reduce((sum, row) => sum + toNumber(row.credits), 0) / completedOrders.length
      : 0;

  const returningPercent =
    knownCustomers.size > 0 ? (returningCustomers.size / knownCustomers.size) * 100 : 0;

  const newPercent =
    knownCustomers.size > 0 ? (newCustomers / knownCustomers.size) * 100 : 0;

  return [
    {
      label: "New vs returning customers",
      value: `${formatPercent(newPercent)} new · ${formatPercent(returningPercent)} returning`,
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
      value: String(returningCustomers.size),
    },
  ];
}

export function useAdminOverview(range: AdminDateRange): AdminOverviewData {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [totals, setTotals] = React.useState<AdminOverviewData["totals"]>({
    totalGenerated: 0,
    customers: 0,
    orders: 0,
    generations: 0,
    creditsInCirculation: 0,
    creditsUsed: 0,
    totalRevenue: 0,
  });

  const [subscriptions, setSubscriptions] = React.useState<AdminValueCard[]>([]);
  const [bundleOffers, setBundleOffers] = React.useState<AdminValueCard[]>([]);
  const [creditsBought, setCreditsBought] = React.useState<AdminValueCard[]>([]);
  const [topRegions, setTopRegions] = React.useState<AdminListItem[]>([]);
  const [topCategories, setTopCategories] = React.useState<AdminListItem[]>([]);
  const [topTemplates, setTopTemplates] = React.useState<AdminListItem[]>([]);
  const [customerBehaviour, setCustomerBehaviour] = React.useState<AdminListItem[]>([]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [customersCount, ordersCount, generationsCount] = await Promise.all([
        countRows("customers"),
        countRows("orders"),
        countRows("generations"),
      ]);

      const [orders, customers, generations, ledger] = await Promise.all([
        fetchRows<OrderRow>(
          "orders",
          "id, convex_id, user_convex_id, amount, pack, status, stripe_session_id, created_at, inserted_at, email, currency, amount_total_cents, product_type, credits_granted, user_id",
          "created_at",
          range
        ),
        fetchRows<CustomerRow>(
          "customers",
          "id, email, full_name, source, source_funnel, first_seen_at, last_seen_at, lead_count, created_at, updated_at, user_id, last_activity, name",
          "created_at",
          range
        ),
        fetchRows<GenerationRow>(
          "generations",
          "id, user_id, email, order_id, status, title, occasion_slug, style_slug, is_saved, created_at, completed_at",
          "created_at",
          range
        ),
        fetchRows<CreditLedgerRow>(
          "credits_ledger",
          "id, user_convex_id, event_type, direction, credits, template_title, category, amount, currency, occurred_at, created_at",
          "occurred_at",
          range
        ),
      ]);

      const completedOrders = orders.filter(isCompletedOrder);

      const totalRevenue = completedOrders.reduce(
        (sum, order) => sum + orderAmount(order),
        0
      );

      const creditsIn = ledger
        .filter((row) => normalizeText(row.direction).toLowerCase() === "in")
        .reduce((sum, row) => sum + toNumber(row.credits), 0);

      const creditsOut = ledger
        .filter((row) => normalizeText(row.direction).toLowerCase() === "out")
        .reduce((sum, row) => sum + toNumber(row.credits), 0);

      const subscriptionOrders = completedOrders.filter((order) => {
        const productType = normalizeText(order.product_type).toLowerCase();
        const pack = normalizeText(order.pack).toLowerCase();

        return (
          productType.includes("subscription") ||
          ["starter", "pro", "elite"].includes(pack)
        );
      });

      const bundleOrders = completedOrders.filter((order) => {
        const productType = normalizeText(order.product_type).toLowerCase();
        const pack = normalizeText(order.pack).toLowerCase();

        return (
          productType.includes("bundle") ||
          ["starter", "creator", "pro", "enterprise"].includes(pack)
        );
      });

      const creditOrders = completedOrders.filter((order) => {
        const productType = normalizeText(order.product_type).toLowerCase();
        const creditsGranted = toNumber(order.credits_granted);

        return productType.includes("credit") || creditsGranted > 0;
      });

      setTotals({
        totalGenerated: generations.length || generationsCount,
        customers: customersCount,
        orders: completedOrders.length || ordersCount,
        generations: generations.length || generationsCount,
        creditsInCirculation: Math.max(0, creditsIn - creditsOut),
        creditsUsed: creditsOut,
        totalRevenue,
      });

      setSubscriptions(groupOrdersByPack(subscriptionOrders, ["Starter", "Pro", "Elite"]));
      setBundleOffers(groupOrdersByPack(bundleOrders, ["Starter", "Creator", "Pro", "Enterprise"]));
      setCreditsBought(groupOrdersByPack(creditOrders, ["Starter", "Creator", "Pro", "Enterprise"]));

      setTopRegions(buildTopRegions(completedOrders));
      setTopCategories(buildTopCategories(generations, completedOrders));
      setTopTemplates(buildTopTemplates(generations, ledger));
      setCustomerBehaviour(buildCustomerBehaviour(customers, completedOrders, ledger));
    } catch (err) {
      console.error("[useAdminOverview] fatal:", err);
      setError(err instanceof Error ? err.message : "Failed to load admin overview.");
    } finally {
      setLoading(false);
    }
  }, [range]);

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