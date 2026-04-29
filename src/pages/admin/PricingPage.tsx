import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Category =
  | "funnel_subscription"
  | "credit_pack"
  | "bundle_offer"
  | "affiliate_setting";

type PricingItem = {
  id?: string;
  key: string;
  category: Category;
  name: string;
  description: string | null;
  price_cents: number | null;
  credits: number | null;
  currency: string | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  discount_percent: number | null;
  commission_percent: number | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  sort_order: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const categories: Array<{ key: Category; label: string; description: string }> = [
  {
    key: "funnel_subscription",
    label: "Funnel subscriptions",
    description: "Starter, Pro, Elite plans shown on the Funnel Payment page.",
  },
  {
    key: "credit_pack",
    label: "Credit packs",
    description: "One-time credit purchases from + Credits / dashboard.",
  },
  {
    key: "bundle_offer",
    label: "Bundle offers",
    description: "Upsells shown on the Result Page after generation.",
  },
  {
    key: "affiliate_setting",
    label: "Affiliate settings",
    description: "Default discount and commission logic for affiliate codes.",
  },
];

const emptyItem: PricingItem = {
  key: "",
  category: "funnel_subscription",
  name: "",
  description: "",
  price_cents: null,
  credits: null,
  currency: "eur",
  stripe_price_id: "",
  stripe_product_id: "",
  discount_percent: null,
  commission_percent: null,
  is_active: true,
  is_featured: false,
  sort_order: 10,
  metadata: {},
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function eurFromCents(cents: number | null | undefined) {
  if (cents == null) return "";
  return (Number(cents) / 100).toFixed(2);
}

function centsFromEur(value: string) {
  const clean = value.trim().replace(",", ".");
  if (!clean) return null;

  const n = Number(clean);
  if (!Number.isFinite(n)) return null;

  return Math.round(n * 100);
}

function normalizeItem(row: Partial<PricingItem>): PricingItem {
  return {
    id: row.id,
    key: String(row.key ?? ""),
    category: (row.category || "funnel_subscription") as Category,
    name: String(row.name ?? ""),
    description: row.description ?? "",
    price_cents:
      row.price_cents === null || row.price_cents === undefined
        ? null
        : Number(row.price_cents),
    credits:
      row.credits === null || row.credits === undefined
        ? null
        : Number(row.credits),
    currency: row.currency || "eur",
    stripe_price_id: row.stripe_price_id || "",
    stripe_product_id: row.stripe_product_id || "",
    discount_percent:
      row.discount_percent === null || row.discount_percent === undefined
        ? null
        : Number(row.discount_percent),
    commission_percent:
      row.commission_percent === null || row.commission_percent === undefined
        ? null
        : Number(row.commission_percent),
    is_active: row.is_active ?? true,
    is_featured: row.is_featured ?? false,
    sort_order:
      row.sort_order === null || row.sort_order === undefined
        ? 10
        : Number(row.sort_order),
    metadata: row.metadata ?? {},
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

async function callPricingManager(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-pricing-manager", {
    body,
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));

  return data;
}

export default function PricingPage() {
  const [items, setItems] = useState<PricingItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>("funnel_subscription");
  const [selectedItem, setSelectedItem] = useState<PricingItem>({
    ...emptyItem,
  });
  const [priceInput, setPriceInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedCategoryData =
    categories.find((c) => c.key === selectedCategory) ?? categories[0];

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => item.category === selectedCategory)
      .sort((a, b) => Number(a.sort_order ?? 999) - Number(b.sort_order ?? 999));
  }, [items, selectedCategory]);

  async function loadItems() {
    setLoading(true);

    try {
      const data = await callPricingManager({ action: "list" });
      const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];

      setItems(rows.map((row: Partial<PricingItem>) => normalizeItem(row)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load pricing items.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  function startCreate(category: Category = selectedCategory) {
    const next = normalizeItem({
      ...emptyItem,
      category,
      sort_order: filteredItems.length ? filteredItems.length * 10 + 10 : 10,
    });

    setSelectedItem(next);
    setPriceInput("");
  }

  function startEdit(item: PricingItem) {
    const normalized = normalizeItem(item);
    setSelectedItem(normalized);
    setPriceInput(eurFromCents(normalized.price_cents));
  }

  async function saveItem(createNewStripePrice = false) {
    if (!selectedItem.key.trim()) {
      toast.error("Key is required.");
      return;
    }

    if (!selectedItem.name.trim()) {
      toast.error("Name is required.");
      return;
    }

    setSaving(true);

    try {
      const price_cents = centsFromEur(priceInput);

      const payload: PricingItem = normalizeItem({
        ...selectedItem,
        key: selectedItem.key.trim(),
        name: selectedItem.name.trim(),
        description: selectedItem.description || "",
        currency: selectedItem.currency || "eur",
        price_cents,
        credits:
          selectedItem.credits === null || selectedItem.credits === undefined
            ? null
            : Number(selectedItem.credits),
        discount_percent:
          selectedItem.discount_percent === null ||
          selectedItem.discount_percent === undefined
            ? null
            : Number(selectedItem.discount_percent),
        commission_percent:
          selectedItem.commission_percent === null ||
          selectedItem.commission_percent === undefined
            ? null
            : Number(selectedItem.commission_percent),
        sort_order:
          selectedItem.sort_order === null || selectedItem.sort_order === undefined
            ? 10
            : Number(selectedItem.sort_order),
        is_active: Boolean(selectedItem.is_active),
        is_featured: Boolean(selectedItem.is_featured),
      });

      const data = await callPricingManager({
        action: "save",
        item: payload,
        create_new_price: createNewStripePrice,
        price_eur: priceInput ? Number(priceInput.replace(",", ".")) : null,
      });

      toast.success(
        createNewStripePrice
          ? `Saved + Stripe price updated${data?.stripe_price_id ? `: ${data.stripe_price_id}` : ""}`
          : "Pricing item saved."
      );

      await loadItems();

      if (data?.item) {
        startEdit(normalizeItem(data.item));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save item.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(item: PricingItem) {
    if (!item.id && !item.key) return;

    const ok = window.confirm(`Delete ${item.name}?`);
    if (!ok) return;

    setSaving(true);

    try {
      await callPricingManager({
        action: "delete",
        id: item.id,
        key: item.key,
      });

      toast.success("Pricing item deleted.");
      await loadItems();
      startCreate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              Admin
            </div>

            <h1 className="mt-2 text-3xl font-bold tracking-tight">Pricing Manager</h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Manage funnel subscriptions, credit packs, result bundle offers, and affiliate
              settings from one place. UI reads from Supabase. Checkout uses the saved Stripe Price ID.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadItems()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            <RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-4">
          {categories.map((category) => {
            const count = items.filter((item) => item.category === category.key).length;
            const active = selectedCategory === category.key;

            return (
              <button
                key={category.key}
                type="button"
                onClick={() => {
                  setSelectedCategory(category.key);
                  startCreate(category.key);
                }}
                className={cx(
                  "rounded-2xl border p-5 text-left transition",
                  active
                    ? "border-indigo-400 bg-indigo-950/40 ring-2 ring-indigo-400/30"
                    : "border-slate-800 bg-slate-900 hover:border-slate-700"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">{category.label}</div>
                  <span className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold">
                    {count}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-400">
                  {category.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{selectedCategoryData.label}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedCategoryData.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => startCreate()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                <Plus className="h-4 w-4" />
                New
              </button>
            </div>

            <div className="mt-6">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
                  Loading pricing items...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center">
                  <div className="font-bold">No pricing items yet</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Create the first item from the panel on the right.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id || item.key}
                      className={cx(
                        "rounded-2xl border bg-slate-950 p-4 transition",
                        selectedItem.key === item.key
                          ? "border-indigo-400"
                          : "border-slate-800"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-bold">{item.name}</div>

                            {!item.is_active ? (
                              <span className="rounded-full bg-red-950 px-2 py-1 text-xs text-red-300">
                                inactive
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-950 px-2 py-1 text-xs text-emerald-300">
                                active
                              </span>
                            )}

                            {item.is_featured ? (
                              <span className="rounded-full bg-amber-950 px-2 py-1 text-xs text-amber-300">
                                featured
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">{item.key}</div>

                          {item.description ? (
                            <div className="mt-2 text-sm text-slate-400">
                              {item.description}
                            </div>
                          ) : null}

                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                            <span className="rounded-lg bg-slate-800 px-2 py-1">
                              Price:{" "}
                              {item.price_cents == null
                                ? "-"
                                : `€${(item.price_cents / 100).toFixed(2)}`}
                            </span>

                            <span className="rounded-lg bg-slate-800 px-2 py-1">
                              Credits: {item.credits ?? "-"}
                            </span>

                            <span className="rounded-lg bg-slate-800 px-2 py-1">
                              Discount: {item.discount_percent ?? "-"}%
                            </span>

                            <span className="rounded-lg bg-slate-800 px-2 py-1">
                              Commission: {item.commission_percent ?? "-"}%
                            </span>

                            <span className="max-w-full truncate rounded-lg bg-slate-800 px-2 py-1">
                              Stripe: {item.stripe_price_id || "-"}
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => void deleteItem(item)}
                          disabled={saving}
                          className="rounded-xl border border-red-900/60 p-2 text-red-300 hover:bg-red-950/40 disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-xl font-bold">Edit pricing item</h2>

            <p className="mt-1 text-sm text-slate-400">
              Save changes to Supabase. Use “Create new Stripe price + save” only when the
              amount changes.
            </p>

            <div className="mt-6 space-y-4">
              <Field label="Category">
                <select
                  value={selectedItem.category}
                  onChange={(e) =>
                    setSelectedItem((p) => ({
                      ...p,
                      category: e.target.value as Category,
                    }))
                  }
                  className="input"
                >
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Key">
                <input
                  value={selectedItem.key}
                  onChange={(e) =>
                    setSelectedItem((p) => ({ ...p, key: e.target.value }))
                  }
                  placeholder="subscription_pro"
                  className="input"
                />
              </Field>

              <Field label="Name">
                <input
                  value={selectedItem.name}
                  onChange={(e) =>
                    setSelectedItem((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Pro"
                  className="input"
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={selectedItem.description || ""}
                  onChange={(e) =>
                    setSelectedItem((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                  className="input resize-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Price EUR">
                  <input
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder="4.99"
                    className="input"
                  />
                </Field>

                <Field label="Credits">
                  <input
                    value={selectedItem.credits ?? ""}
                    onChange={(e) =>
                      setSelectedItem((p) => ({
                        ...p,
                        credits: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    placeholder="100"
                    className="input"
                  />
                </Field>
              </div>

              <Field label="Currency">
                <input
                  value={selectedItem.currency || "eur"}
                  onChange={(e) =>
                    setSelectedItem((p) => ({
                      ...p,
                      currency: e.target.value.toLowerCase(),
                    }))
                  }
                  placeholder="eur"
                  className="input"
                />
              </Field>

              <Field label="Stripe price ID">
                <input
                  value={selectedItem.stripe_price_id || ""}
                  onChange={(e) =>
                    setSelectedItem((p) => ({
                      ...p,
                      stripe_price_id: e.target.value,
                    }))
                  }
                  placeholder="price_xxx"
                  className="input"
                />
              </Field>

              <Field label="Stripe product ID">
                <input
                  value={selectedItem.stripe_product_id || ""}
                  onChange={(e) =>
                    setSelectedItem((p) => ({
                      ...p,
                      stripe_product_id: e.target.value,
                    }))
                  }
                  placeholder="prod_xxx"
                  className="input"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Discount %">
                  <input
                    value={selectedItem.discount_percent ?? ""}
                    onChange={(e) =>
                      setSelectedItem((p) => ({
                        ...p,
                        discount_percent: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    placeholder="70"
                    className="input"
                  />
                </Field>

                <Field label="Commission %">
                  <input
                    value={selectedItem.commission_percent ?? ""}
                    onChange={(e) =>
                      setSelectedItem((p) => ({
                        ...p,
                        commission_percent: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    placeholder="20"
                    className="input"
                  />
                </Field>
              </div>

              <Field label="Sort order">
                <input
                  value={selectedItem.sort_order ?? ""}
                  onChange={(e) =>
                    setSelectedItem((p) => ({
                      ...p,
                      sort_order: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="input"
                />
              </Field>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedItem.is_active)}
                    onChange={(e) =>
                      setSelectedItem((p) => ({
                        ...p,
                        is_active: e.target.checked,
                      }))
                    }
                  />
                  Active
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedItem.is_featured)}
                    onChange={(e) =>
                      setSelectedItem((p) => ({
                        ...p,
                        is_featured: e.target.checked,
                      }))
                    }
                  />
                  Featured
                </label>
              </div>

              <button
                type="button"
                onClick={() => void saveItem(false)}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save to DB"}
              </button>

              <button
                type="button"
                onClick={() => void saveItem(true)}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                Create new Stripe price + save
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgb(51 65 85);
          background: rgb(15 23 42);
          padding: 10px 12px;
          color: white;
          outline: none;
          font-size: 14px;
        }

        .input:focus {
          border-color: rgb(129 140 248);
          box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.25);
        }

        .input::placeholder {
          color: rgb(100 116 139);
        }

        .input option {
          background: rgb(15 23 42);
          color: white;
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
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      {children}
    </label>
  );
}