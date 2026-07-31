import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient } from "../_shared/supabase.ts";

/**
 * Apple App Store Guideline 5.1.1(v) — account deletion from the app.
 * Deletes the authenticated user's auth record (cascades related profile rows).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await getAuthUser(req);
    if (!user) return jsonResponse({ error: "Authentication required" }, 401);

    const service = getServiceClient();
    const userId = user.id;
    const email = (user.email || "").toLowerCase();

    // Best-effort cleanup of app tables (auth delete also cascades FKs where set)
    const cleanup = [
      service.from("affiliate_profiles").delete().eq("user_id", userId),
      service.from("user_profiles").delete().eq("id", userId),
      service.from("profiles").delete().eq("id", userId),
    ];
    if (email) {
      cleanup.push(
        service.from("credits_ledger").delete().eq("user_convex_id", email) as any,
      );
    }
    await Promise.allSettled(cleanup);

    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw error;

    return jsonResponse({
      ok: true,
      message: "Account deleted",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
