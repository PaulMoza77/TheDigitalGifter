import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient } from "../_shared/supabase.ts";

/**
 * Apple App Store Guideline 5.1.1(v) — account deletion from the app.
 *
 * Delete account-owned profile/content data, remove uploaded media we control,
 * de-identify transaction records that must remain for fraud/refund/accounting,
 * then delete the authenticated Supabase Auth user.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await getAuthUser(req);
    if (!user) return jsonResponse({ error: "Authentication required" }, 401);

    const service = getServiceClient();
    const userId = user.id;
    const email = (user.email || "").trim().toLowerCase();
    const tombstoneId = crypto.randomUUID();
    const failures: string[] = [];

    async function removeRows(table: string, column: string, value: string) {
      const { error } = await service.from(table).delete().eq(column, value);
      if (error) failures.push(`${table}:${error.message}`);
    }

    async function updateRows(
      table: string,
      column: string,
      value: string,
      patch: Record<string, unknown>,
    ) {
      const { error } = await service.from(table).update(patch).eq(column, value);
      if (error) failures.push(`${table}:${error.message}`);
    }

    async function removeStoragePrefix(bucket: string, prefix: string) {
      // Keep asking for page 0 because each successful delete shrinks the list.
      for (let pass = 0; pass < 50; pass += 1) {
        const { data, error } = await service.storage.from(bucket).list(prefix, {
          limit: 100,
          offset: 0,
        });
        if (error) {
          // A missing/unused bucket must not strand an otherwise deletable account.
          if (!/not found|bucket/i.test(error.message || "")) {
            failures.push(`${bucket}:${error.message}`);
          }
          return;
        }
        const files = (data || []).filter((item) => item.name && item.id);
        if (files.length === 0) return;
        const paths = files.map((item) => `${prefix}/${item.name}`);
        const removed = await service.storage.from(bucket).remove(paths);
        if (removed.error) {
          failures.push(`${bucket}:${removed.error.message}`);
          return;
        }
        if (files.length < 100) return;
      }
      failures.push(`${bucket}:too_many_objects`);
    }

    // Capture Christmas order-owned media before de-identifying order rows.
    const { data: christmasOrders, error: christmasOrderReadError } = await service
      .from("christmas_orders")
      .select("id,source_bucket,source_path")
      .eq("user_id", userId);
    if (christmasOrderReadError) failures.push(`christmas_orders:${christmasOrderReadError.message}`);

    const orderIds = (christmasOrders || []).map((row: any) => String(row.id));
    if (orderIds.length > 0) {
      const { data: assets, error: assetReadError } = await service
        .from("christmas_order_assets")
        .select("storage_bucket,storage_path")
        .in("order_id", orderIds);
      if (assetReadError) failures.push(`christmas_order_assets:${assetReadError.message}`);

      for (const asset of assets || []) {
        const bucket = String((asset as any).storage_bucket || "").trim();
        const path = String((asset as any).storage_path || "").trim();
        if (bucket && path) {
          const removed = await service.storage.from(bucket).remove([path]);
          if (removed.error) failures.push(`${bucket}:${removed.error.message}`);
        }
      }

      for (const order of christmasOrders || []) {
        const bucket = String((order as any).source_bucket || "").trim();
        const path = String((order as any).source_path || "").trim();
        if (bucket && path) {
          const removed = await service.storage.from(bucket).remove([path]);
          if (removed.error) failures.push(`${bucket}:${removed.error.message}`);
        }
      }

      const assetDelete = await service
        .from("christmas_order_assets")
        .delete()
        .in("order_id", orderIds);
      if (assetDelete.error) failures.push(`christmas_order_assets:${assetDelete.error.message}`);
    }

    // Native TDG uploads are stored under inputs/<auth-user-id>.
    await removeStoragePrefix("uploads", `inputs/${userId}`);
    // Older/web TDG media may use the auth user id as the top-level folder.
    await removeStoragePrefix("christmas-source-photos", userId);
    await removeStoragePrefix("pet-source-photos", userId);
    await removeStoragePrefix("pet-generated", userId);

    // Account-owned content and preferences.
    for (const table of [
      "app_christmas_jobs",
      "generations",
      "christmas_advent_claims",
      "christmas_bundle_entitlements",
      "christmas_card_projects",
      "christmas_countdown_signups",
      "christmas_free_gift_claims",
      "christmas_funnel_events",
      "christmas_gift_finder_sessions",
      "christmas_gift_tree_opens",
      "christmas_message_sessions",
      "christmas_reward_entitlements",
      "christmas_trees",
      "christmas_wishlists",
      "support_tickets",
      "email_preferences",
      "affiliate_codes",
      "affiliate_conversions",
      "affiliate_profiles",
      "user_roles",
    ]) {
      await removeRows(table, "user_id", userId);
    }

    // Credits have no value after account deletion and may also be keyed by email.
    await removeRows("credits_ledger", "user_id", userId);
    if (email) await removeRows("credits_ledger", "user_convex_id", email);

    // Financial / App Store transaction records are retained only in de-identified
    // form so refunds, duplicate-purchase protection and accounting can still work.
    await updateRows("apple_iap_transactions", "user_id", userId, {
      user_id: tombstoneId,
      user_email: null,
      app_account_token: tombstoneId,
    });
    await updateRows("apple_iap_verify_attempts", "user_id", userId, {
      user_id: tombstoneId,
    });

    // Preserve order accounting while removing the direct account identity.
    await updateRows("christmas_orders", "user_id", userId, {
      user_id: null,
      email: null,
      email_normalized: null,
      public_token_hash: `deleted:${crypto.randomUUID()}`,
      public_token_ciphertext: null,
      source_bucket: null,
      source_path: null,
      result_asset_id: null,
      metadata: { account_deleted: true },
    });
    await updateRows("orders", "user_id", userId, {
      user_id: null,
      email: null,
      user_convex_id: null,
    });
    await updateRows("customers", "user_id", userId, {
      user_id: null,
      email: null,
    });

    if (email) {
      await removeRows("email_preferences", "email", email);
      await removeRows("funnel_leads", "email", email);
    }

    // Profile records are intentionally last, immediately before Auth deletion.
    await removeRows("user_profiles", "id", userId);
    await removeRows("profiles", "id", userId);

    if (failures.length > 0) {
      // Fail before deleting Auth so the user can retry; never claim deletion if
      // first-party personal data cleanup did not complete.
      return jsonResponse(
        { error: "Account deletion could not be completed. Please retry.", details: failures.slice(0, 8) },
        500,
      );
    }

    const { error: authDeleteError } = await service.auth.admin.deleteUser(userId);
    if (authDeleteError) throw authDeleteError;

    return jsonResponse({ ok: true, message: "Account deleted" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
