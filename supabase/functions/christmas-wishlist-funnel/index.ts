import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { assertAdmin, getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import {
  generateOpaqueToken,
  generateShareId,
  sanitizeText,
  sha256Hex,
  asString,
} from "../_shared/christmas/treeAdvent.ts";
import { generateGiftIdeas, validateFinderInput, type FinderInput } from "../_shared/christmas/giftFinder.ts";
import { PRIORITY_KEYS } from "../_shared/christmas/giftTaxonomy.ts";

type Body = Record<string, unknown>;
type Service = ReturnType<typeof getServiceClient>;

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = asString(body.action);
    const service = getServiceClient();
    const { user } = await getAuthUser(req);
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // ---- Wishlist ----
    if (action === "createWishlist") {
      const ownerToken = generateOpaqueToken();
      const ownerHash = await sha256Hex(ownerToken);
      const shareId = generateShareId();
      const audience = asString(body.audience) || "me";
      if (!["me", "child", "family", "someone_else"].includes(audience)) {
        return jsonResponse({ error: "invalid_audience" }, 400);
      }
      const row = {
        user_id: user?.id || null,
        owner_token_hash: user?.id ? null : ownerHash,
        share_id: shareId,
        share_enabled: false,
        title: sanitizeText(body.title || "My Christmas Wishlist", 80) || "My Christmas Wishlist",
        description: sanitizeText(body.description, 500),
        locale: asString(body.locale) === "ro" ? "ro" : "en",
        currency: sanitizeText(body.currency, 8) || null,
        show_budgets_public: body.show_budgets_public === false ? false : true,
        audience,
      };
      const { data, error } = await service.from("christmas_wishlists").insert(row).select("id,share_id").single();
      if (error) throw error;
      return jsonResponse({
        ok: true,
        wishlist_id: data.id,
        share_id: data.share_id,
        owner_token: user?.id ? null : ownerToken,
        share_enabled: false,
      });
    }

    if (action === "getOwnerWishlist") {
      const list = await loadOwnerWishlist(service, body, user?.id);
      if (!list) return jsonResponse({ error: "not_found" }, 404);
      const { data: items } = await service
        .from("christmas_wishlist_items")
        .select("*")
        .eq("wishlist_id", list.id)
        .eq("status", "active")
        .order("sort_order", { ascending: true });
      return jsonResponse({
        ok: true,
        wishlist: {
          id: list.id,
          share_id: list.share_id,
          share_enabled: list.share_enabled,
          title: list.title,
          description: list.description,
          locale: list.locale,
          currency: list.currency,
          show_budgets_public: list.show_budgets_public,
          audience: list.audience || "me",
          view_count: list.view_count || 0,
          share_count: list.share_count || 0,
          // Anti-spoiler: strip reservation identity + status from owner DTO
          items: (items || []).map((it: Record<string, unknown>) => publicOwnerItem(it)),
        },
      });
    }

    if (action === "updateWishlist") {
      const list = await loadOwnerWishlist(service, body, user?.id);
      if (!list) return jsonResponse({ error: "forbidden" }, 403);
      const patch: Record<string, unknown> = {};
      if (body.title != null) patch.title = sanitizeText(body.title, 80) || "My Christmas Wishlist";
      if (body.description != null) patch.description = sanitizeText(body.description, 500);
      if (body.show_budgets_public != null) patch.show_budgets_public = Boolean(body.show_budgets_public);
      if (body.audience != null) {
        const audience = asString(body.audience);
        if (!["me", "child", "family", "someone_else"].includes(audience)) {
          return jsonResponse({ error: "invalid_audience" }, 400);
        }
        patch.audience = audience;
      }
      const { error } = await service.from("christmas_wishlists").update(patch).eq("id", list.id);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === "setWishlistShareEnabled") {
      const list = await loadOwnerWishlist(service, body, user?.id);
      if (!list) return jsonResponse({ error: "forbidden" }, 403);
      if (list.moderation_status !== "active") return jsonResponse({ error: "moderated" }, 403);
      const enabled = Boolean(body.share_enabled);
      const { error } = await service
        .from("christmas_wishlists")
        .update({
          share_enabled: enabled,
          share_count: enabled ? Number(list.share_count || 0) + 1 : list.share_count,
        })
        .eq("id", list.id);
      if (error) throw error;
      return jsonResponse({ ok: true, share_enabled: enabled, share_id: list.share_id });
    }

    if (action === "getSharedWishlist") {
      const shareId = asString(body.share_id);
      if (shareId.length < 22) return jsonResponse({ error: "invalid_share" }, 400);
      const { data: list } = await service
        .from("christmas_wishlists")
        .select("*")
        .eq("share_id", shareId)
        .maybeSingle();
      if (!list || !list.share_enabled || list.moderation_status !== "active") {
        return jsonResponse({ error: "unavailable" }, 404);
      }
      await service
        .from("christmas_wishlists")
        .update({
          view_count: Number(list.view_count || 0) + 1,
          last_viewed_at: new Date().toISOString(),
        })
        .eq("id", list.id);
      const { data: items } = await service
        .from("christmas_wishlist_items")
        .select(
          "id,sort_order,title,note,external_url,image_url,priority,budget_amount,currency,quantity,preference_size,preference_color,source_type,reservation_status",
        )
        .eq("wishlist_id", list.id)
        .eq("status", "active")
        .order("sort_order", { ascending: true });
      const showBudgets = Boolean(list.show_budgets_public);
      return jsonResponse({
        ok: true,
        wishlist: {
          share_id: list.share_id,
          title: list.title,
          description: list.description,
          locale: list.locale,
          items: (items || []).map((it: Record<string, unknown>) => ({
            id: it.id,
            sort_order: it.sort_order,
            title: it.title,
            note: it.note || "",
            external_url: it.external_url || null,
            image_url: it.image_url || null,
            priority: it.priority,
            budget_amount: showBudgets ? it.budget_amount : null,
            currency: showBudgets ? it.currency : null,
            quantity: it.quantity == null ? 1 : Number(it.quantity),
            preference_size: it.preference_size || "",
            preference_color: it.preference_color || "",
            source_type:
              it.source_type === "gift_finder"
                ? "gift_finder"
                : it.source_type === "tdg_product"
                ? "tdg_product"
                : "manual",
            // Status only — never token / identity
            reservation_status:
              it.reservation_status === "purchased"
                ? "purchased"
                : it.reservation_status === "reserved"
                ? "reserved"
                : "none",
          })),
        },
      });
    }

    if (action === "addWishlistItem") {
      const list = await loadOwnerWishlist(service, body, user?.id);
      if (!list) return jsonResponse({ error: "forbidden" }, 403);
      const title = sanitizeText(body.title, 120);
      if (!title) return jsonResponse({ error: "title_required" }, 400);
      const url = sanitizeExternalUrl(body.external_url);
      if (body.external_url != null && asString(body.external_url) && !url) {
        return jsonResponse({ error: "invalid_url" }, 400);
      }
      const priority = asString(body.priority) || "would_love";
      if (!PRIORITY_KEYS.has(priority)) return jsonResponse({ error: "invalid_priority" }, 400);
      const sourceType = asString(body.source_type) || "manual";
      if (!["manual", "gift_finder", "tdg_product"].includes(sourceType)) {
        return jsonResponse({ error: "invalid_source" }, 400);
      }
      const sourceRef = sanitizeText(body.source_ref, 80) || null;

      if (sourceType === "gift_finder" && sourceRef) {
        const { data: existing } = await service
          .from("christmas_wishlist_items")
          .select("id")
          .eq("wishlist_id", list.id)
          .eq("source_type", "gift_finder")
          .eq("source_ref", sourceRef)
          .eq("status", "active")
          .maybeSingle();
        if (existing) return jsonResponse({ ok: true, item: existing, already: true });
      }

      const { data: last } = await service
        .from("christmas_wishlist_items")
        .select("sort_order")
        .eq("wishlist_id", list.id)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextSort = last?.[0] ? Number(last[0].sort_order) + 1 : 0;
      const imageUrl = sanitizeExternalUrl(body.image_url);
      if (body.image_url != null && asString(body.image_url) && !imageUrl) {
        return jsonResponse({ error: "invalid_image_url" }, 400);
      }
      let quantity = body.quantity == null || body.quantity === "" ? 1 : Number(body.quantity);
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > 20) {
        return jsonResponse({ error: "invalid_quantity" }, 400);
      }
      quantity = Math.floor(quantity);
      const { data, error } = await service
        .from("christmas_wishlist_items")
        .insert({
          wishlist_id: list.id,
          sort_order: nextSort,
          title,
          note: sanitizeText(body.note, 500),
          external_url: url,
          image_url: imageUrl,
          priority,
          budget_amount: body.budget_amount == null || body.budget_amount === ""
            ? null
            : Number(body.budget_amount),
          currency: sanitizeText(body.currency, 8) || list.currency,
          quantity,
          preference_size: sanitizeText(body.preference_size, 40),
          preference_color: sanitizeText(body.preference_color, 40),
          source_type: sourceType,
          source_ref: sourceRef,
        })
        .select("id,sort_order")
        .single();
      if (error) {
        if (error.code === "23505") return jsonResponse({ ok: true, already: true });
        throw error;
      }
      return jsonResponse({ ok: true, item: data });
    }

    if (action === "updateWishlistItem") {
      const list = await loadOwnerWishlist(service, body, user?.id);
      if (!list) return jsonResponse({ error: "forbidden" }, 403);
      const itemId = asString(body.item_id);
      if (!itemId) return jsonResponse({ error: "missing_item" }, 400);
      const patch: Record<string, unknown> = {};
      if (body.title != null) {
        const title = sanitizeText(body.title, 120);
        if (!title) return jsonResponse({ error: "title_required" }, 400);
        patch.title = title;
      }
      if (body.note != null) patch.note = sanitizeText(body.note, 500);
      if (body.external_url !== undefined) {
        const url = sanitizeExternalUrl(body.external_url);
        if (body.external_url != null && asString(body.external_url) && !url) {
          return jsonResponse({ error: "invalid_url" }, 400);
        }
        patch.external_url = url;
      }
      if (body.image_url !== undefined) {
        const imageUrl = sanitizeExternalUrl(body.image_url);
        if (body.image_url != null && asString(body.image_url) && !imageUrl) {
          return jsonResponse({ error: "invalid_image_url" }, 400);
        }
        patch.image_url = imageUrl;
      }
      if (body.priority != null) {
        const priority = asString(body.priority);
        if (!PRIORITY_KEYS.has(priority)) return jsonResponse({ error: "invalid_priority" }, 400);
        patch.priority = priority;
      }
      if (body.budget_amount !== undefined) {
        patch.budget_amount =
          body.budget_amount == null || body.budget_amount === "" ? null : Number(body.budget_amount);
      }
      if (body.currency !== undefined) patch.currency = sanitizeText(body.currency, 8) || list.currency;
      if (body.quantity !== undefined) {
        const quantity = Number(body.quantity);
        if (!Number.isFinite(quantity) || quantity < 1 || quantity > 20) {
          return jsonResponse({ error: "invalid_quantity" }, 400);
        }
        patch.quantity = Math.floor(quantity);
      }
      if (body.preference_size !== undefined) patch.preference_size = sanitizeText(body.preference_size, 40);
      if (body.preference_color !== undefined) patch.preference_color = sanitizeText(body.preference_color, 40);
      if (Object.keys(patch).length === 0) return jsonResponse({ error: "empty_patch" }, 400);
      const { error } = await service
        .from("christmas_wishlist_items")
        .update(patch)
        .eq("id", itemId)
        .eq("wishlist_id", list.id)
        .eq("status", "active");
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === "reserveWishlistItem") {
      const shareId = asString(body.share_id);
      const itemId = asString(body.item_id);
      if (shareId.length < 22 || !itemId) return jsonResponse({ error: "invalid_request" }, 400);
      const { data: list } = await service
        .from("christmas_wishlists")
        .select("id,share_enabled,moderation_status")
        .eq("share_id", shareId)
        .maybeSingle();
      if (!list || !list.share_enabled || list.moderation_status !== "active") {
        return jsonResponse({ error: "unavailable" }, 404);
      }
      const reservationToken = generateOpaqueToken();
      const reservationHash = await sha256Hex(reservationToken);
      const now = new Date().toISOString();
      const { data: updated, error } = await service
        .from("christmas_wishlist_items")
        .update({
          reservation_status: "reserved",
          reservation_token_hash: reservationHash,
          reserved_at: now,
          purchased_at: null,
        })
        .eq("id", itemId)
        .eq("wishlist_id", list.id)
        .eq("status", "active")
        .eq("reservation_status", "none")
        .select("id,reservation_status")
        .maybeSingle();
      if (error) throw error;
      if (!updated) {
        const { data: current } = await service
          .from("christmas_wishlist_items")
          .select("reservation_status")
          .eq("id", itemId)
          .eq("wishlist_id", list.id)
          .maybeSingle();
        return jsonResponse(
          {
            error: "already_reserved",
            reservation_status: current?.reservation_status || "reserved",
          },
          409,
        );
      }
      return jsonResponse({
        ok: true,
        item_id: updated.id,
        reservation_status: "reserved",
        reservation_token: reservationToken,
      });
    }

    if (action === "markWishlistItemPurchased") {
      const shareId = asString(body.share_id);
      const itemId = asString(body.item_id);
      const reservationToken = asString(body.reservation_token);
      if (shareId.length < 22 || !itemId || reservationToken.length < 32) {
        return jsonResponse({ error: "invalid_request" }, 400);
      }
      const { data: list } = await service
        .from("christmas_wishlists")
        .select("id,share_enabled,moderation_status")
        .eq("share_id", shareId)
        .maybeSingle();
      if (!list || !list.share_enabled || list.moderation_status !== "active") {
        return jsonResponse({ error: "unavailable" }, 404);
      }
      const hash = await sha256Hex(reservationToken);
      const now = new Date().toISOString();
      const { data: updated, error } = await service
        .from("christmas_wishlist_items")
        .update({
          reservation_status: "purchased",
          purchased_at: now,
        })
        .eq("id", itemId)
        .eq("wishlist_id", list.id)
        .eq("status", "active")
        .eq("reservation_token_hash", hash)
        .in("reservation_status", ["reserved", "purchased"])
        .select("id,reservation_status")
        .maybeSingle();
      if (error) throw error;
      if (!updated) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ ok: true, item_id: updated.id, reservation_status: "purchased" });
    }

    if (action === "releaseWishlistItemReservation") {
      const shareId = asString(body.share_id);
      const itemId = asString(body.item_id);
      const reservationToken = asString(body.reservation_token);
      if (shareId.length < 22 || !itemId || reservationToken.length < 32) {
        return jsonResponse({ error: "invalid_request" }, 400);
      }
      const { data: list } = await service
        .from("christmas_wishlists")
        .select("id,share_enabled,moderation_status")
        .eq("share_id", shareId)
        .maybeSingle();
      if (!list || !list.share_enabled || list.moderation_status !== "active") {
        return jsonResponse({ error: "unavailable" }, 404);
      }
      const hash = await sha256Hex(reservationToken);
      const { data: updated, error } = await service
        .from("christmas_wishlist_items")
        .update({
          reservation_status: "none",
          reservation_token_hash: null,
          reserved_at: null,
          purchased_at: null,
        })
        .eq("id", itemId)
        .eq("wishlist_id", list.id)
        .eq("status", "active")
        .eq("reservation_token_hash", hash)
        .select("id,reservation_status")
        .maybeSingle();
      if (error) throw error;
      if (!updated) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ ok: true, item_id: updated.id, reservation_status: "none" });
    }

    if (action === "previewExternalUrl") {
      const url = sanitizeExternalUrl(body.url);
      if (!url) return jsonResponse({ error: "invalid_url", extracted: false, url: null }, 400);
      const preview = await previewProductUrl(url);
      return jsonResponse({ ok: true, ...preview });
    }

    if (action === "removeWishlistItem") {
      const list = await loadOwnerWishlist(service, body, user?.id);
      if (!list) return jsonResponse({ error: "forbidden" }, 403);
      const itemId = asString(body.item_id);
      const { error } = await service
        .from("christmas_wishlist_items")
        .update({ status: "removed" })
        .eq("id", itemId)
        .eq("wishlist_id", list.id);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === "reorderWishlistItems") {
      const list = await loadOwnerWishlist(service, body, user?.id);
      if (!list) return jsonResponse({ error: "forbidden" }, 403);
      const order = Array.isArray(body.item_ids) ? body.item_ids.map((x) => asString(x)) : [];
      if (order.length === 0 || order.length > 80) return jsonResponse({ error: "invalid_order" }, 400);
      for (let i = 0; i < order.length; i++) {
        await service
          .from("christmas_wishlist_items")
          .update({ sort_order: i })
          .eq("id", order[i])
          .eq("wishlist_id", list.id);
      }
      return jsonResponse({ ok: true });
    }

    if (action === "trackWishlistExternalClick") {
      const shareId = asString(body.share_id);
      const { data: list } = await service
        .from("christmas_wishlists")
        .select("id,external_click_count,share_enabled,moderation_status")
        .eq("share_id", shareId)
        .maybeSingle();
      if (!list || !list.share_enabled || list.moderation_status !== "active") {
        return jsonResponse({ error: "unavailable" }, 404);
      }
      await service
        .from("christmas_wishlists")
        .update({ external_click_count: Number(list.external_click_count || 0) + 1 })
        .eq("id", list.id);
      return jsonResponse({ ok: true });
    }

    if (action === "claimGuestWishlist") {
      if (!user?.id) return jsonResponse({ error: "auth_required" }, 401);
      const list = await loadOwnerWishlist(service, body, null);
      if (!list) return jsonResponse({ error: "forbidden" }, 403);
      if (list.user_id && list.user_id !== user.id) return jsonResponse({ error: "already_owned" }, 409);
      const { error } = await service
        .from("christmas_wishlists")
        .update({ user_id: user.id, owner_token_hash: null })
        .eq("id", list.id);
      if (error) throw error;
      return jsonResponse({ ok: true, wishlist_id: list.id, share_id: list.share_id });
    }

    if (action === "listMyWishlists") {
      if (!user?.id) return jsonResponse({ error: "auth_required" }, 401);
      const { data, error } = await service
        .from("christmas_wishlists")
        .select("id,share_id,share_enabled,title,created_at,view_count")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return jsonResponse({ ok: true, wishlists: data || [] });
    }

    if (action === "adminListWishlists") {
      await assertAdmin(user?.email);
      const { data, error } = await service
        .from("christmas_wishlists")
        .select(
          "id,user_id,share_enabled,moderation_status,view_count,share_count,external_click_count,created_at,locale",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const out = [];
      for (const w of data || []) {
        const { count } = await service
          .from("christmas_wishlist_items")
          .select("id", { count: "exact", head: true })
          .eq("wishlist_id", w.id)
          .eq("status", "active");
        out.push({
          id: w.id,
          account: w.user_id ? "user" : "guest",
          share_enabled: w.share_enabled,
          moderation_status: w.moderation_status,
          item_count: count || 0,
          views: w.view_count,
          shares: w.share_count,
          external_clicks: w.external_click_count,
          created_at: w.created_at,
          locale: w.locale,
        });
      }
      return jsonResponse({ ok: true, wishlists: out });
    }

    if (action === "adminDisableWishlistShare") {
      await assertAdmin(user?.email);
      const id = asString(body.wishlist_id);
      if (!id) return jsonResponse({ error: "missing" }, 400);
      const { error } = await service
        .from("christmas_wishlists")
        .update({ share_enabled: false, moderation_status: "disabled" })
        .eq("id", id);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    // ---- Gift Finder ----
    if (action === "runGiftFinder") {
      const guestToken = asString(body.guest_token);
      const guestHash = guestToken ? await sha256Hex(guestToken) : null;
      if (!user?.id && !guestHash) return jsonResponse({ error: "identity_required" }, 400);

      const rateBucket = user?.id ? `user:${user.id}` : `guest:${guestHash || (await sha256Hex(clientIp))}`;
      const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
      const { count } = await service
        .from("christmas_gift_finder_sessions")
        .select("id", { count: "exact", head: true })
        .eq("rate_bucket", rateBucket)
        .gte("created_at", since);
      if ((count || 0) >= RATE_MAX) {
        return jsonResponse({ error: "rate_limited", code: "rate_limited" }, 429);
      }

      const input: FinderInput = {
        locale: asString(body.locale) === "ro" ? "ro" : "en",
        countryCode: sanitizeText(body.country_code, 2).toUpperCase() || null,
        recipientKey: asString(body.recipient_key),
        relationshipKey: asString(body.relationship_key) || null,
        ageRangeKey: asString(body.age_range_key),
        interestKeys: Array.isArray(body.interest_keys)
          ? body.interest_keys.map((x) => asString(x))
          : [],
        customInterest: asString(body.custom_interest),
        budgetKey: asString(body.budget_key),
        giftTypeKey: asString(body.gift_type_key),
        vibeKey: asString(body.vibe_key) || null,
      };
      const validated = validateFinderInput(input);
      if (!validated.ok) return jsonResponse({ error: validated.error }, 400);

      // Idempotent reload of latest completed session with same fingerprint
      const fingerprint = [
        validated.value.recipientKey,
        validated.value.ageRangeKey,
        validated.value.budgetKey,
        validated.value.giftTypeKey,
        validated.value.interestKeys.join(","),
        validated.value.customInterest || "",
        validated.value.locale,
      ].join("|");
      if (!body.force_new) {
        const { data: recent } = await service
          .from("christmas_gift_finder_sessions")
          .select("id,status")
          .eq("rate_bucket", rateBucket)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(5);
        for (const s of recent || []) {
          const { data: full } = await service
            .from("christmas_gift_finder_sessions")
            .select("*")
            .eq("id", s.id)
            .maybeSingle();
          if (!full) continue;
          const fp = [
            full.recipient_key,
            full.age_range_key,
            full.budget_key,
            full.gift_type_key,
            (full.interest_keys || []).join(","),
            full.custom_interest || "",
            full.locale,
          ].join("|");
          if (fp === fingerprint) {
            const { data: results } = await service
              .from("christmas_gift_finder_results")
              .select("*")
              .eq("session_id", full.id)
              .order("sort_order", { ascending: true });
            return jsonResponse({
              ok: true,
              already: true,
              session_id: full.id,
              provider: full.provider,
              model: full.model,
              ideas: (results || []).map(publicIdea),
            });
          }
        }
      }

      const { data: session, error: sessErr } = await service
        .from("christmas_gift_finder_sessions")
        .insert({
          user_id: user?.id || null,
          guest_token_hash: user?.id ? null : guestHash,
          locale: validated.value.locale,
          country_code: validated.value.countryCode,
          recipient_key: validated.value.recipientKey,
          relationship_key: validated.value.relationshipKey,
          age_range_key: validated.value.ageRangeKey,
          interest_keys: validated.value.interestKeys,
          custom_interest: validated.value.customInterest || "",
          budget_key: validated.value.budgetKey,
          gift_type_key: validated.value.giftTypeKey,
          vibe_key: validated.value.vibeKey,
          status: "draft",
          rate_bucket: rateBucket,
          attempt_number: body.force_new ? 2 : 1,
        })
        .select("id")
        .single();
      if (sessErr) throw sessErr;

      try {
        const gen = await generateGiftIdeas(validated.value);
        const rows = gen.ideas.map((idea, idx) => ({
          session_id: session.id,
          sort_order: idx,
          title: idea.title,
          reason: idea.reason,
          budget_min: idea.budget_min,
          budget_max: idea.budget_max,
          currency: validated.value.locale === "ro" ? "ron" : "usd",
          category: idea.category,
          search_query: idea.search_query,
          tdg_product_key: idea.tdg_product_key,
        }));
        if (rows.length) {
          const { data: inserted, error: resErr } = await service
            .from("christmas_gift_finder_results")
            .insert(rows)
            .select("id,sort_order,title,reason,budget_min,budget_max,currency,category,search_query,tdg_product_key");
          if (resErr) throw resErr;
          await service
            .from("christmas_gift_finder_sessions")
            .update({
              status: "completed",
              provider: gen.provider,
              model: gen.model,
              latency_ms: gen.latencyMs,
              input_tokens: gen.inputTokens,
              output_tokens: gen.outputTokens,
              cost_usd: gen.costUsd,
              cost_state: gen.costState,
              completed_at: new Date().toISOString(),
            })
            .eq("id", session.id);

          // Cost ledger (text LLM)
          try {
            await service.from("ai_cost_ledger").insert({
              provider: gen.provider,
              prediction_id: `christmas_gift_finder:${session.id}`,
              product_family: "christmas_gift_finder",
              attempt_number: 1,
              is_retry: false,
              is_mock: gen.provider === "curated",
              product_sku: "christmas_gift_finder",
              model_name: gen.model,
              provider_status: "succeeded",
              pricing_method: gen.provider === "openai" ? "per_token" : "none",
              unit_cost_usd: 0,
              billable_units: (gen.inputTokens || 0) + (gen.outputTokens || 0),
              cost_usd: gen.costUsd || 0,
              cost_state: gen.costState === "estimated" ? "estimated" : gen.costState === "none" ? "exact" : "estimated",
              pricing_source: "server_estimate",
              tariff_snapshot: {
                operation: "christmas_gift_finder",
                input_tokens: gen.inputTokens,
                output_tokens: gen.outputTokens,
              },
              currency: "usd",
              media_type: "text",
              cost_notes: "christmas_gift_finder",
              completed_at: new Date().toISOString(),
            });
          } catch {
            /* cost ledger optional */
          }

          return jsonResponse({
            ok: true,
            session_id: session.id,
            provider: gen.provider,
            model: gen.model,
            latency_ms: gen.latencyMs,
            cost_usd: gen.costUsd,
            cost_state: gen.costState,
            used_fallback: gen.usedFallback,
            ideas: (inserted || []).map((r: Record<string, unknown>) => ({
              id: r.id,
              result_key: String(r.id),
              title: r.title,
              reason: r.reason,
              budget_min: r.budget_min,
              budget_max: r.budget_max,
              currency: r.currency,
              category: r.category,
              search_query: r.search_query,
              tdg_product_key: r.tdg_product_key,
            })),
          });
        }
        throw new Error("no_ideas");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await service
          .from("christmas_gift_finder_sessions")
          .update({ status: "failed", error_code: message.slice(0, 120) })
          .eq("id", session.id);
        return jsonResponse({ error: message, code: "finder_failed" }, 500);
      }
    }

    if (action === "getGiftFinderSession") {
      const sessionId = asString(body.session_id);
      const guestToken = asString(body.guest_token);
      const guestHash = guestToken ? await sha256Hex(guestToken) : null;
      const { data: session } = await service
        .from("christmas_gift_finder_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();
      if (!session) return jsonResponse({ error: "not_found" }, 404);
      const allowed =
        (user?.id && session.user_id === user.id) ||
        (guestHash && session.guest_token_hash === guestHash);
      if (!allowed) return jsonResponse({ error: "forbidden" }, 403);
      const { data: results } = await service
        .from("christmas_gift_finder_results")
        .select("*")
        .eq("session_id", session.id)
        .order("sort_order", { ascending: true });
      return jsonResponse({
        ok: true,
        session_id: session.id,
        provider: session.provider,
        model: session.model,
        ideas: (results || []).map((r: Record<string, unknown>) => ({
          id: r.id,
          result_key: String(r.id),
          title: r.title,
          reason: r.reason,
          budget_min: r.budget_min,
          budget_max: r.budget_max,
          currency: r.currency,
          category: r.category,
          search_query: r.search_query,
          tdg_product_key: r.tdg_product_key,
        })),
      });
    }

    if (action === "adminGiftFinderStats") {
      await assertAdmin(user?.email);
      const { data } = await service
        .from("christmas_gift_finder_sessions")
        .select("status,provider,model,latency_ms,cost_usd,recipient_key,budget_key,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      const rows = data || [];
      return jsonResponse({
        ok: true,
        totals: {
          sessions: rows.length,
          completed: rows.filter((r) => r.status === "completed").length,
          failed: rows.filter((r) => r.status === "failed").length,
        },
        recent: rows.slice(0, 50).map((r) => ({
          status: r.status,
          provider: r.provider,
          model: r.model,
          latency_ms: r.latency_ms,
          cost_usd: r.cost_usd,
          recipient_key: r.recipient_key,
          budget_key: r.budget_key,
          created_at: r.created_at,
        })),
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});

function publicIdea(r: Record<string, unknown>) {
  return {
    id: r.id,
    title: r.title,
    reason: r.reason,
    budget_min: r.budget_min,
    budget_max: r.budget_max,
    currency: r.currency,
    category: r.category,
    search_query: r.search_query,
    tdg_product_key: r.tdg_product_key,
  };
}

/** Owner DTO — never leak reservation tokens or spoiler status. */
function publicOwnerItem(it: Record<string, unknown>) {
  return {
    id: it.id,
    sort_order: it.sort_order,
    title: it.title,
    note: it.note || "",
    external_url: it.external_url || null,
    image_url: it.image_url || null,
    priority: it.priority,
    budget_amount: it.budget_amount ?? null,
    currency: it.currency || null,
    quantity: it.quantity == null ? 1 : Number(it.quantity),
    preference_size: it.preference_size || "",
    preference_color: it.preference_color || "",
    source_type: it.source_type || "manual",
    source_ref: it.source_ref || null,
  };
}

function sanitizeExternalUrl(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  if (/^(javascript|data|vbscript):/i.test(raw)) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString().slice(0, 500);
  } catch {
    return null;
  }
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "metadata.google.internal") return true;
  // IPv4 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map((x) => Number(x));
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  // IPv6 / bare
  if (host.includes(":")) return true;
  return false;
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtml(m[1].trim());
  }
  return null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function previewProductUrl(url: string): Promise<{
  url: string;
  title: string | null;
  image_url: string | null;
  retailer: string | null;
  extracted: boolean;
  error?: string;
}> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, title: null, image_url: null, retailer: null, extracted: false, error: "invalid_url" };
  }
  if (isPrivateHostname(parsed.hostname)) {
    return { url, title: null, image_url: null, retailer: null, extracted: false, error: "blocked_host" };
  }
  const retailer = parsed.hostname.replace(/^www\./i, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "TheDigitalGifterWishlistBot/1.0 (+https://www.thedigitalgifter.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      return { url, title: null, image_url: null, retailer, extracted: false, error: `http_${res.status}` };
    }
    const ctype = res.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(ctype) && ctype && !ctype.includes("text/")) {
      return { url, title: null, image_url: null, retailer, extracted: false, error: "unsupported_type" };
    }
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > 350_000 ? buf.slice(0, 350_000) : buf;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);
    const ogTitle = extractMeta(html, "og:title") || extractMeta(html, "twitter:title");
    const titleTag = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1];
    const title = sanitizeText(ogTitle || decodeHtml(String(titleTag || "").trim()), 120) || null;
    const ogImage = extractMeta(html, "og:image") || extractMeta(html, "twitter:image");
    let imageUrl: string | null = null;
    if (ogImage) {
      try {
        imageUrl = sanitizeExternalUrl(new URL(ogImage, url).toString());
      } catch {
        imageUrl = null;
      }
    }
    const extracted = Boolean(title || imageUrl);
    return {
      url,
      title,
      image_url: imageUrl,
      retailer,
      extracted,
      error: extracted ? undefined : "no_metadata",
    };
  } catch {
    return { url, title: null, image_url: null, retailer, extracted: false, error: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

async function loadOwnerWishlist(service: Service, body: Body, userId: string | null | undefined) {
  const wishlistId = asString(body.wishlist_id);
  const ownerToken = asString(body.owner_token);
  if (wishlistId && userId) {
    const { data } = await service.from("christmas_wishlists").select("*").eq("id", wishlistId).maybeSingle();
    if (data && data.user_id === userId) return data;
  }
  if (ownerToken.length >= 32) {
    const hash = await sha256Hex(ownerToken);
    const { data } = await service
      .from("christmas_wishlists")
      .select("*")
      .eq("owner_token_hash", hash)
      .maybeSingle();
    if (data) return data;
  }
  if (wishlistId && ownerToken.length >= 32) {
    const hash = await sha256Hex(ownerToken);
    const { data } = await service
      .from("christmas_wishlists")
      .select("*")
      .eq("id", wishlistId)
      .eq("owner_token_hash", hash)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}
