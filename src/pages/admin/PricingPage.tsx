import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgePercent,
  Coins,
  CreditCard,
  Gift,
  HandCoins,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PricingCategory =
  | "funnel_subscription"
  | "credit_pack"
  | "result_bundle_offer"
  | "affiliate_setting";

type PricingItem = {
  id: string;
  key: string;
  category: PricingCategory;
  name: string;
  description: string | null;
  price_cents: number | null;
  currency: string;
  credits: number | null;
  stripe_price_id: string | null;
  active: boolean;
  sort_order: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

type DraftPricingItem = Omit<PricingItem, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

const CATEGORY_CONFIG: Array<{
  key: PricingCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "funnel_subscription",
    label: "Funnel subscriptions",
    description: "Starter, Pro, Elite plans shown on the Funnel Payment page.",
    icon: CreditCard,
  },
  {
    key: "credit_pack",
    label: "Credit packs",
    description: "One-time credit purchases from + Credits / dashboard.",
    icon: Coins,
  },
  {
    key: "result_bundle_offer",
    label: "Bundle offers",
    description: "Upsells shown on the Result Page after generation.",
    icon: Gift,
  },
  {
    key: "affiliate_setting",
    label: "Affiliate settings",
    description: "Default discount and commission logic for affiliate codes.",
    icon: HandCoins,
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function centsToEuro(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return (Number(value) / 100).toFixed(2);
}

function euroToCents(value: string) {
  const n = Number(String(value || "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function safeJsonParse(value: string): Record<string, any> {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    throw new Error("Metadata must be valid JSON.");
  }
}

function defaultDraft(category: PricingCategory): DraftPricingItem {
  if (category === "affiliate_setting") {
    return {
      key: "affiliate_default",
      category,
      name: "Default Affiliate Program",
      description: "70% off first order and 20% affiliate commission.",
      price_cents: null,
      currency: "eur",
      credits: null,
      stripe_price_id: null,
      active: true,
      sort_order: 10,
      metadata: {
        client_discount_percent: 70,
        affiliate_commission_percent: 20,
      },
    };
  }

  return {
    key: "",
    category,
    name: "",
    description: "",
    price_cents: 0,
    currency: "eur",
    credits: null,
    stripe_price_id: "",
    active: true,
    sort_order: 10,
    metadata: {},
  };
}

function formatPrice(item: PricingItem | DraftPricingItem) {
  if (item.price_cents === null || item.price_cents === undefined) return "No price";
  return `€${centsToEuro(item.price_cents)}`;
}

export default function PricingPage() {
  const [items, setItems] = useState<PricingItem[]>([]);
  const [activeCategory, setActiveCategory] =
    useState<PricingCategory>("funnel_subscription");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DraftPricingItem>(() =>
    defaultDraft("funnel_subscription")
  );

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => item.category === activeCategory)
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.name.localeCompare(b.name);
      });
  }, [items, activeCategory]);

  const activeConfig = useMemo(
    () => CATEGORY_CONFIG.find((c) => c.key === activeCategory) ?? CATEGORY_CONFIG[0],
    [activeCategory]
  );

  async function loadPricing() {
    setLoading(true);

    const { data, error } = await supabase
      .from("pricing_items")
      .select("*")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      toast.error(error.message || "Failed to load pricing.");
      setLoading(false);
      return;
    }

    setItems((data ?? []) as PricingItem[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadPricing();
  }, []);

  useEffect(() => {
    setDraft(defaultDraft(activeCategory));
  }, [activeCategory]);

  function updateItemLocal(id: string, partial: Partial<PricingItem>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...partial } : item))
    );
  }

  function updateDraft(partial: Partial<DraftPricingItem>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  async function saveItem(item: PricingItem) {
    setSavingId(item.id);

    try {
      const payload = {
        key: item.key.trim(),
        category: item.category,
        name: item.name.trim(),
        description: item.description || "",
        price_cents: item.price_cents,
        currency: item.currency || "eur",
        credits: item.credits,
        stripe_price_id: item.stripe_price_id || null,
        active: item.active,
        sort_order: Number(item.sort_order || 0),
        metadata: item.metadata || {},
      };

      if (!payload.key) throw new Error("Key is required.");
      if (!payload.name) throw new Error("Name is required.");

      const { error } = await supabase
        .from("pricing_items")
        .update(payload)
        .eq("id", item.id);

      if (error) throw error;

      toast.success("Pricing item saved.");
      await loadPricing();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save item.");
    } finally {
      setSavingId(null);
    }
  }

  async function createItem() {
    setCreating(true);

    try {
      const payload = {
        key: draft.key.trim(),
        category: draft.category,
        name: draft.name.trim(),
        description: draft.description || "",
        price_cents: draft.price_cents,
        currency: draft.currency || "eur",
        credits: draft.credits,
        stripe_price_id: draft.stripe_price_id || null,
        active: draft.active,
        sort_order: Number(draft.sort_order || 0),
        metadata: draft.metadata || {},
      };

      if (!payload.key) throw new Error("Key is required.");
      if (!payload.name) throw new Error("Name is required.");

      const { error } = await supabase.from("pricing_items").insert(payload);

      if (error) throw error;

      toast.success("Pricing item created.");
      setDraft(defaultDraft(activeCategory));
      await loadPricing();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create item.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteItem(item: PricingItem) {
    const confirmed = window.confirm(
      `Delete "${item.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    const { error } = await supabase.from("pricing_items").delete().eq("id", item.id);

    if (error) {
      toast.error(error.message || "Failed to delete item.");
      return;
    }

    toast.success("Pricing item deleted.");
    await loadPricing();
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Admin
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Pricing Manager
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Manage funnel subscriptions, credit packs, result bundle offers,
              and affiliate commission settings from one place. UI reads from
              Supabase, while checkout uses the saved Stripe Price IDs.
            </p>
          </div>

          <Button
            onClick={() => void loadPricing()}
            disabled={loading}
            className="bg-slate-800 text-white hover:bg-slate-700"
          >
            <RefreshCw className={cx("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {CATEGORY_CONFIG.map((category) => {
            const Icon = category.icon;
            const active = activeCategory === category.key;
            const count = items.filter((item) => item.category === category.key).length;

            return (
              <button
                key={category.key}
                type="button"
                onClick={() => setActiveCategory(category.key)}
                className={cx(
                  "rounded-2xl border p-4 text-left transition",
                  active
                    ? "border-indigo-400 bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.18)]"
                    : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-950">
                    <Icon className="h-5 w-5 text-indigo-300" />
                  </div>

                  <Badge className="bg-slate-800 text-slate-200 hover:bg-slate-800">
                    {count}
                  </Badge>
                </div>

                <div className="mt-4 text-sm font-semibold text-white">
                  {category.label}
                </div>

                <div className="mt-1 text-xs leading-relaxed text-slate-400">
                  {category.description}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <Card className="border-slate-800 bg-slate-900/70 text-slate-50">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <BadgePercent className="h-5 w-5 text-indigo-300" />
                    {activeConfig.label}
                  </CardTitle>

                  <CardDescription className="mt-1 text-slate-400">
                    {activeConfig.description}
                  </CardDescription>
                </div>

                <Badge className="bg-slate-800 text-slate-200 hover:bg-slate-800">
                  {filteredItems.length} items
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="flex min-h-[360px] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-6 py-12 text-center">
                  <div className="text-lg font-semibold">No pricing items yet</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Create the first item for this category from the panel on the right.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredItems.map((item) => (
                    <PricingEditor
                      key={item.id}
                      item={item}
                      saving={savingId === item.id}
                      onChange={(partial) => updateItemLocal(item.id, partial)}
                      onSave={() => void saveItem(item)}
                      onDelete={() => void deleteItem(item)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit border-slate-800 bg-slate-900/70 text-slate-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Plus className="h-5 w-5 text-emerald-300" />
                Add new item
              </CardTitle>

              <CardDescription className="text-slate-400">
                Create a new pricing item inside the selected category.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <PricingFormFields
                item={draft}
                onChange={updateDraft}
                compact
              />

              <Button
                onClick={() => void createItem()}
                disabled={creating}
                className="mt-5 w-full bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Create item
              </Button>

              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-100">
                Stripe Price IDs are saved here, but Stripe prices are not changed
                automatically yet. Create the Price in Stripe, paste its ID here,
                then checkout can use it.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PricingEditor({
  item,
  saving,
  onChange,
  onSave,
  onDelete,
}: {
  item: PricingItem;
  saving: boolean;
  onChange: (partial: Partial<PricingItem>) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-semibold text-white">{item.name || "Untitled"}</div>

            <Badge
              className={
                item.active
                  ? "bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/15"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-700"
              }
            >
              {item.active ? "Active" : "Inactive"}
            </Badge>

            <Badge className="bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/15">
              {formatPrice(item)}
            </Badge>

            {item.credits ? (
              <Badge className="bg-amber-500/15 text-amber-200 hover:bg-amber-500/15">
                {item.credits} credits
              </Badge>
            ) : null}
          </div>

          <div className="mt-1 text-xs text-slate-500">{item.key}</div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onSave}
            disabled={saving}
            className="bg-indigo-600 text-white hover:bg-indigo-500"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>

          <Button
            variant="outline"
            onClick={onDelete}
            className="border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <PricingFormFields item={item} onChange={onChange} />
      </div>
    </div>
  );
}

function PricingFormFields({
  item,
  onChange,
  compact = false,
}: {
  item: PricingItem | DraftPricingItem;
  onChange: (partial: any) => void;
  compact?: boolean;
}) {
  const [metadataText, setMetadataText] = useState(() =>
    JSON.stringify(item.metadata ?? {}, null, 2)
  );

  useEffect(() => {
    setMetadataText(JSON.stringify(item.metadata ?? {}, null, 2));
  }, [item.id]);

  function updateMetadataText(value: string) {
    setMetadataText(value);

    try {
      const parsed = safeJsonParse(value);
      onChange({ metadata: parsed });
    } catch {
      // keep typing, validation happens visually by JSON color not needed
    }
  }

  const priceEuro = centsToEuro(item.price_cents);

  return (
    <div className="grid gap-4">
      <div className={cx("grid gap-4", compact ? "grid-cols-1" : "md:grid-cols-2")}>
        <Field label="Key">
          <input
            value={item.key}
            onChange={(e) => onChange({ key: e.target.value })}
            placeholder="subscription_pro"
            className="input-admin"
          />
        </Field>

        <Field label="Name">
          <input
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Pro"
            className="input-admin"
          />
        </Field>

        <Field label="Price EUR">
          <input
            value={priceEuro}
            onChange={(e) => onChange({ price_cents: euroToCents(e.target.value) })}
            placeholder="4.99"
            className="input-admin"
          />
        </Field>

        <Field label="Credits">
          <input
            value={item.credits ?? ""}
            onChange={(e) =>
              onChange({
                credits: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="100"
            type="number"
            className="input-admin"
          />
        </Field>

        <Field label="Currency">
          <input
            value={item.currency}
            onChange={(e) => onChange({ currency: e.target.value.toLowerCase() })}
            placeholder="eur"
            className="input-admin"
          />
        </Field>

        <Field label="Sort order">
          <input
            value={item.sort_order}
            onChange={(e) => onChange({ sort_order: Number(e.target.value || 0) })}
            type="number"
            className="input-admin"
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={item.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={compact ? 2 : 3}
          placeholder="Short description shown in UI"
          className="input-admin resize-none"
        />
      </Field>

      <Field label="Stripe Price ID">
        <input
          value={item.stripe_price_id ?? ""}
          onChange={(e) => onChange({ stripe_price_id: e.target.value })}
          placeholder="price_..."
          className="input-admin"
        />
      </Field>

      <Field label="Metadata JSON">
        <textarea
          value={metadataText}
          onChange={(e) => updateMetadataText(e.target.value)}
          rows={compact ? 5 : 7}
          className="input-admin resize-none font-mono text-xs"
        />
      </Field>

      <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={item.active}
          onChange={(e) => onChange({ active: e.target.checked })}
          className="h-4 w-4"
        />
        Active
      </label>

      <style>{`
        .input-admin {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(51 65 85);
          background: rgba(15, 23, 42, 0.9);
          color: rgb(248 250 252);
          padding: 0.65rem 0.8rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input-admin:focus {
          border-color: rgb(129 140 248);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.22);
        }
        .input-admin::placeholder {
          color: rgb(100 116 139);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      {children}
    </label>
  );
}