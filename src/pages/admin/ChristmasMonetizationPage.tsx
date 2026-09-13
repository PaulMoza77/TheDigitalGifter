import React, { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  BUNDLE_COMPONENTS,
  CHRISTMAS_COMMERCIAL_KEYS,
  validateChristmasOfferPatch,
  type ChristmasCommercialKey,
} from "@/features/christmas/commercialOffers";

type OfferForm = {
  id?: string;
  key: ChristmasCommercialKey;
  name: string;
  active: boolean;
  webCheckoutEnabled: boolean;
  webPrice: string;
  currency: string;
  compareAt: string;
  credits: string;
  featured: boolean;
  sortOrder: number;
  badge: string;
  bundleComponents: string[];
};

const EMPTY: OfferForm[] = CHRISTMAS_COMMERCIAL_KEYS.map((key) => ({
  key,
  name: key,
  active: true,
  webCheckoutEnabled: true,
  webPrice: "",
  currency: "eur",
  compareAt: "",
  credits: "",
  featured: key === "xmas_magic_bundle",
  sortOrder: 10,
  badge: "",
  bundleComponents: key === "xmas_magic_bundle" ? [...BUNDLE_COMPONENTS] : [],
}));

function eurosToMinor(value: string): number {
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function minorToEuros(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (Number(cents) / 100).toFixed(2);
}

export default function ChristmasMonetizationPage() {
  const [offers, setOffers] = useState<OfferForm[]>(EMPTY);
  const [packs, setPacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-pricing-manager", {
        body: { action: "list" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      const rows = Array.isArray(data?.items) ? data.items : [];
      setOffers(
        CHRISTMAS_COMMERCIAL_KEYS.map((key) => {
          const row = rows.find((item: any) => item.key === key);
          const meta = (row?.metadata || {}) as Record<string, unknown>;
          return {
            id: row?.id,
            key,
            name: String(row?.name || key),
            active: row ? row.active !== false && row.is_active !== false : true,
            webCheckoutEnabled: meta.web_checkout_enabled !== false,
            webPrice: minorToEuros(Number(meta.web_price_minor ?? row?.price_cents ?? 0)),
            currency: String(row?.currency || meta.web_currency || "eur"),
            compareAt: minorToEuros(
              meta.compare_at_price_minor == null ? null : Number(meta.compare_at_price_minor),
            ),
            credits: String(meta.app_credits_cost ?? row?.credits ?? ""),
            featured: Boolean(row?.is_featured),
            sortOrder: Number(row?.sort_order ?? 10),
            badge: String(meta.display_badge || meta.badge || ""),
            bundleComponents: Array.isArray(meta.bundle_components)
              ? (meta.bundle_components as string[])
              : key === "xmas_magic_bundle"
                ? [...BUNDLE_COMPONENTS]
                : [],
          };
        }),
      );
      setPacks(
        rows.filter((item: any) => item.category === "credit_pack" || item.category === "credits"),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load Christmas monetization.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateOffer(key: string, patch: Partial<OfferForm>) {
    setOffers((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function saveOffer(offer: OfferForm) {
    const validated = validateChristmasOfferPatch({
      key: offer.key,
      name: offer.name,
      active: offer.active,
      webCheckoutEnabled: offer.webCheckoutEnabled,
      webPriceMinor: eurosToMinor(offer.webPrice),
      webCurrency: offer.currency,
      compareAtPriceMinor: offer.compareAt ? eurosToMinor(offer.compareAt) : null,
      appCreditsCost: Number(offer.credits),
      featured: offer.featured,
      sortOrder: offer.sortOrder,
      displayBadge: offer.badge || null,
      bundleComponents: offer.key === "xmas_magic_bundle" ? offer.bundleComponents : null,
    });
    if (!validated.ok) {
      toast.error(validated.message);
      return;
    }

    setSavingKey(offer.key);
    try {
      const { data, error } = await supabase.functions.invoke("admin-pricing-manager", {
        body: {
          action: "save",
          item: {
            id: offer.id,
            key: offer.key,
            category: "christmas_offer",
            name: offer.name,
            description: offer.name,
            price_cents: validated.offer.webPriceMinor,
            currency: validated.offer.webCurrency,
            credits: validated.offer.appCreditsCost,
            is_active: offer.active,
            active: offer.active,
            is_featured: offer.featured,
            sort_order: offer.sortOrder,
            metadata: {
              product_type: validated.offer.productType,
              web_checkout_enabled: validated.offer.webCheckoutEnabled,
              web_price_minor: validated.offer.webPriceMinor,
              web_currency: validated.offer.webCurrency,
              compare_at_price_minor: validated.offer.compareAtPriceMinor,
              app_credits_cost: validated.offer.appCreditsCost,
              display_badge: validated.offer.displayBadge,
              bundle_components: validated.offer.bundleComponents,
            },
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      toast.success(`${offer.name} saved. Web and app will use the new values on next fetch.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingKey(null);
    }
  }

  async function savePack(pack: any) {
    const credits = Number(pack.credits);
    const bonus = Number(pack.bonus || pack.metadata?.bonus_credits || 0);
    if (!Number.isFinite(credits) || credits < 0 || bonus < 0) {
      toast.error("Credits cannot be negative.");
      return;
    }
    if (!pack.is_active && pack.active === false) {
      /* inactive allowed */
    } else if (credits < 1) {
      toast.error("Active credit packs must grant more than 0 credits.");
      return;
    }
    setSavingKey(pack.key);
    try {
      const metadata = {
        ...(pack.metadata || {}),
        apple_product_id: pack.appleProductId || pack.metadata?.apple_product_id,
        bonus_credits: bonus,
        base_credits: Math.max(0, credits - bonus),
        badge: pack.badge || pack.metadata?.badge || null,
        label: pack.name,
      };
      const { data, error } = await supabase.functions.invoke("admin-pricing-manager", {
        body: {
          action: "save",
          item: {
            ...pack,
            credits,
            active: pack.is_active !== false,
            metadata,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      toast.success(`${pack.name} credit grant saved. Next verified IAP uses the new total.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              Christmas → Monetization
            </div>
            <h1 className="mt-2 text-3xl font-bold">Christmas commercial offers</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Change web cash prices and app credit costs here. No web or App Store build is
              required. iOS money prices still come only from StoreKit.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </button>
        </div>

        <div className="mt-8 space-y-5">
          {offers.map((offer) => (
            <div key={offer.key} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">{offer.name}</div>
                  <div className="text-xs text-slate-500">{offer.key}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void saveOffer(offer)}
                  disabled={savingKey === offer.key}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {savingKey === offer.key ? "Saving…" : "Save"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm">
                  Public name
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-950 px-3 py-2"
                    value={offer.name}
                    onChange={(e) => updateOffer(offer.key, { name: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  Badge
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-950 px-3 py-2"
                    value={offer.badge}
                    onChange={(e) => updateOffer(offer.key, { badge: e.target.value })}
                    placeholder="Best Value"
                  />
                </label>
                <label className="text-sm">
                  Web price
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-950 px-3 py-2"
                    value={offer.webPrice}
                    onChange={(e) => updateOffer(offer.key, { webPrice: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  Currency
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-950 px-3 py-2"
                    value={offer.currency}
                    onChange={(e) => updateOffer(offer.key, { currency: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  Compare-at price
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-950 px-3 py-2"
                    value={offer.compareAt}
                    onChange={(e) => updateOffer(offer.key, { compareAt: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  App credits required
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-950 px-3 py-2"
                    value={offer.credits}
                    onChange={(e) => updateOffer(offer.key, { credits: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  Display order
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-950 px-3 py-2"
                    value={offer.sortOrder}
                    onChange={(e) => updateOffer(offer.key, { sortOrder: Number(e.target.value || 0) })}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={offer.active}
                    onChange={(e) => updateOffer(offer.key, { active: e.target.checked })}
                  />
                  Enabled
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={offer.webCheckoutEnabled}
                    onChange={(e) => updateOffer(offer.key, { webCheckoutEnabled: e.target.checked })}
                  />
                  Web checkout enabled
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={offer.featured}
                    onChange={(e) => updateOffer(offer.key, { featured: e.target.checked })}
                  />
                  Featured
                </label>
              </div>

              {offer.key === "xmas_magic_bundle" ? (
                <div className="mt-4 text-sm">
                  Bundle contents
                  <div className="mt-2 flex flex-wrap gap-3">
                    {BUNDLE_COMPONENTS.map((component) => (
                      <label key={component} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={offer.bundleComponents.includes(component)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...offer.bundleComponents, component]
                              : offer.bundleComponents.filter((item) => item !== component);
                            updateOffer(offer.key, { bundleComponents: next });
                          }}
                        />
                        {component}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-bold">Credit packs (Apple IAP grants)</h2>
        <p className="mt-2 text-sm text-slate-400">
          Apple display price is never edited here. These fields control how many credits a verified
          StoreKit purchase grants.
        </p>
        <div className="mt-5 space-y-4">
          {packs.map((pack) => {
            const meta = pack.metadata || {};
            return (
              <div key={pack.id || pack.key} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{pack.name}</div>
                    <div className="text-xs text-slate-500">{pack.key}</div>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold"
                    onClick={() =>
                      void savePack({
                        ...pack,
                        appleProductId: pack.appleProductId ?? meta.apple_product_id,
                        bonus: pack.bonus ?? meta.bonus_credits ?? 0,
                        badge: pack.badge ?? meta.badge,
                      })
                    }
                    disabled={savingKey === pack.key}
                  >
                    Save
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    Apple product ID
                    <input
                      className="mt-1 w-full rounded-lg bg-slate-950 px-3 py-2"
                      defaultValue={meta.apple_product_id || ""}
                      onBlur={(e) => {
                        pack.appleProductId = e.target.value;
                      }}
                    />
                  </label>
                  <label className="text-sm">
                    Total credits granted
                    <input
                      className="mt-1 w-full rounded-lg bg-slate-950 px-3 py-2"
                      defaultValue={pack.credits ?? ""}
                      onBlur={(e) => {
                        pack.credits = Number(e.target.value);
                      }}
                    />
                  </label>
                  <label className="text-sm">
                    Bonus credits
                    <input
                      className="mt-1 w-full rounded-lg bg-slate-950 px-3 py-2"
                      defaultValue={meta.bonus_credits ?? 0}
                      onBlur={(e) => {
                        pack.bonus = Number(e.target.value);
                      }}
                    />
                  </label>
                  <label className="text-sm">
                    Badge
                    <input
                      className="mt-1 w-full rounded-lg bg-slate-950 px-3 py-2"
                      defaultValue={meta.badge || ""}
                      onBlur={(e) => {
                        pack.badge = e.target.value;
                      }}
                      placeholder="Best Value"
                    />
                  </label>
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    defaultChecked={pack.is_active !== false && pack.active !== false}
                    onChange={(e) => {
                      pack.is_active = e.target.checked;
                      pack.active = e.target.checked;
                    }}
                  />
                  Active
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
