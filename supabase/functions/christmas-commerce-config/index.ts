import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { catalogFromRows, mapCreditPackRow } from "../_shared/christmas/commercialOffers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const service = getServiceClient();
    const { data: offers, error } = await service
      .from("pricing_items")
      .select("*")
      .eq("category", "christmas_offer")
      .order("sort_order", { ascending: true });
    if (error) throw error;

    const { data: packs, error: packError } = await service
      .from("pricing_items")
      .select("*")
      .in("category", ["credit_pack", "credits"])
      .order("sort_order", { ascending: true });
    if (packError) throw packError;

    return jsonResponse({
      ok: true,
      offers: catalogFromRows(offers || []),
      creditPacks: (packs || [])
        .map(mapCreditPackRow)
        .filter((row) => row && row.active)
        .map((row) => ({
          key: row!.key,
          name: row!.name,
          appleProductId: row!.appleProductId,
          baseCredits: row!.baseCredits,
          bonusCredits: row!.bonusCredits,
          totalCredits: row!.totalCredits,
          badge: row!.badge,
          sortOrder: row!.sortOrder,
        })),
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
