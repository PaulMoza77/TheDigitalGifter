import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { assertAdmin, getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import {
  adventCreditsEnabled,
  adventDayParts,
  adventEnabled,
  asString,
  BOX_STYLES,
  freeGiftEnabled,
  generateOpaqueToken,
  generateShareId,
  GIFT_TYPES,
  isTreeStyle,
  sanitizeText,
  sha256Hex,
} from "../_shared/christmas/treeAdvent.ts";
import {
  findGiftTreeReward,
  giftTreeClaimIdempotency,
  giftTreeCreditsEnabled,
  giftTreeEnabled,
  GIFT_TREE_REWARDS,
  GIFT_TREE_SEASON_YEAR,
  pickGiftTreeReward,
  publicGiftTreeReward,
} from "../_shared/christmas/giftTreeRewards.ts";

type Body = Record<string, unknown>;

const SEASON_YEAR = 2026;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = asString(body.action);
    const service = getServiceClient();
    const { user } = await getAuthUser(req);

    if (action === "createTree") {
      const ownerToken = generateOpaqueToken();
      const ownerHash = await sha256Hex(ownerToken);
      const shareId = generateShareId();
      const style = asString(body.tree_style) || "classic";
      if (!isTreeStyle(style)) return jsonResponse({ error: "invalid_style" }, 400);
      const row = {
        user_id: user?.id || null,
        owner_token_hash: user?.id ? null : ownerHash,
        share_id: shareId,
        share_enabled: false,
        title: sanitizeText(body.title || "My Christmas Tree", 80) || "My Christmas Tree",
        message: sanitizeText(body.message, 500),
        from_name: sanitizeText(body.from_name, 80),
        tree_style: style,
        decoration_config: sanitizeDecor(body.decoration_config),
        locale: asString(body.locale) === "ro" ? "ro" : "en",
      };
      const { data, error } = await service.from("christmas_trees").insert(row).select("id,share_id").single();
      if (error) throw error;
      return jsonResponse({
        ok: true,
        tree_id: data.id,
        share_id: data.share_id,
        owner_token: user?.id ? null : ownerToken,
        share_enabled: false,
      });
    }

    if (action === "getOwnerTree") {
      const tree = await loadOwnerTree(service, body, user?.id);
      if (!tree) return jsonResponse({ error: "not_found" }, 404);
      const { data: gifts } = await service
        .from("christmas_tree_gifts")
        .select("*")
        .eq("tree_id", tree.id)
        .order("sort_order", { ascending: true });
      return jsonResponse({
        ok: true,
        tree: {
          id: tree.id,
          share_id: tree.share_id,
          share_enabled: tree.share_enabled,
          title: tree.title,
          message: tree.message,
          from_name: tree.from_name,
          tree_style: tree.tree_style,
          decoration_config: tree.decoration_config,
          locale: tree.locale,
          gifts: gifts || [],
        },
      });
    }

    if (action === "updateTree") {
      const tree = await loadOwnerTree(service, body, user?.id);
      if (!tree) return jsonResponse({ error: "forbidden" }, 403);
      const patch: Record<string, unknown> = {};
      if (body.title != null) patch.title = sanitizeText(body.title, 80) || "My Christmas Tree";
      if (body.message != null) patch.message = sanitizeText(body.message, 500);
      if (body.from_name != null) patch.from_name = sanitizeText(body.from_name, 80);
      if (body.tree_style != null) {
        const style = asString(body.tree_style);
        if (!isTreeStyle(style)) return jsonResponse({ error: "invalid_style" }, 400);
        patch.tree_style = style;
      }
      if (body.decoration_config != null) patch.decoration_config = sanitizeDecor(body.decoration_config);
      const { error } = await service.from("christmas_trees").update(patch).eq("id", tree.id);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === "setShareEnabled") {
      const tree = await loadOwnerTree(service, body, user?.id);
      if (!tree) return jsonResponse({ error: "forbidden" }, 403);
      if (tree.moderation_status !== "active") return jsonResponse({ error: "moderated" }, 403);
      const enabled = Boolean(body.share_enabled);
      const { error } = await service
        .from("christmas_trees")
        .update({
          share_enabled: enabled,
          share_count: enabled ? Number(tree.share_count || 0) + 1 : tree.share_count,
        })
        .eq("id", tree.id);
      if (error) throw error;
      return jsonResponse({ ok: true, share_enabled: enabled, share_id: tree.share_id });
    }

    if (action === "getSharedTree") {
      const shareId = asString(body.share_id);
      if (shareId.length < 22) return jsonResponse({ error: "invalid_share" }, 400);
      const { data: tree } = await service
        .from("christmas_trees")
        .select("*")
        .eq("share_id", shareId)
        .maybeSingle();
      if (!tree || !tree.share_enabled || tree.moderation_status !== "active") {
        return jsonResponse({ error: "unavailable" }, 404);
      }
      await service
        .from("christmas_trees")
        .update({
          view_count: Number(tree.view_count || 0) + 1,
          last_viewed_at: new Date().toISOString(),
        })
        .eq("id", tree.id);
      const { data: gifts } = await service
        .from("christmas_tree_gifts")
        .select("*")
        .eq("tree_id", tree.id)
        .order("sort_order", { ascending: true });
      const now = Date.now();
      const safeGifts = (gifts || []).map((g: Record<string, unknown>) => {
        const unlocked =
          g.unlock_mode === "immediate" ||
          (g.unlock_at && new Date(String(g.unlock_at)).getTime() <= now);
        const opened = Boolean(g.opened_at);
        return {
          id: g.id,
          sort_order: g.sort_order,
          gift_type: g.gift_type,
          box_style: g.box_style,
          display_name: g.display_name,
          unlock_mode: g.unlock_mode,
          unlock_at: g.unlock_at,
          can_open: unlocked,
          opened,
          message: opened && unlocked ? g.message : null,
        };
      });
      return jsonResponse({
        ok: true,
        tree: {
          share_id: tree.share_id,
          title: tree.title,
          message: tree.message,
          from_name: tree.from_name,
          tree_style: tree.tree_style,
          decoration_config: tree.decoration_config,
          locale: tree.locale,
          gifts: safeGifts,
        },
      });
    }

    if (action === "addGift") {
      const tree = await loadOwnerTree(service, body, user?.id);
      if (!tree) return jsonResponse({ error: "forbidden" }, 403);
      const giftType = asString(body.gift_type) || "message";
      if (!(GIFT_TYPES as readonly string[]).includes(giftType)) {
        return jsonResponse({ error: "invalid_gift_type" }, 400);
      }
      const box = asString(body.box_style) || "red";
      if (!(BOX_STYLES as readonly string[]).includes(box)) {
        return jsonResponse({ error: "invalid_box" }, 400);
      }
      const { data: existing } = await service
        .from("christmas_tree_gifts")
        .select("sort_order")
        .eq("tree_id", tree.id)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextSort = existing?.[0] ? Number(existing[0].sort_order) + 1 : 0;
      const unlockMode = asString(body.unlock_mode) === "on_date" ? "on_date" : "immediate";
      const { data, error } = await service
        .from("christmas_tree_gifts")
        .insert({
          tree_id: tree.id,
          sort_order: nextSort,
          gift_type: giftType,
          box_style: box,
          display_name: sanitizeText(body.display_name, 80),
          message: sanitizeText(body.message, 800),
          unlock_mode: unlockMode,
          unlock_at: unlockMode === "on_date" ? asString(body.unlock_at) || null : null,
          linked_product_key: sanitizeText(body.linked_product_key, 80) || null,
        })
        .select("id,sort_order")
        .single();
      if (error) throw error;
      return jsonResponse({ ok: true, gift: data });
    }

    if (action === "reorderGifts") {
      const tree = await loadOwnerTree(service, body, user?.id);
      if (!tree) return jsonResponse({ error: "forbidden" }, 403);
      const order = Array.isArray(body.gift_ids) ? body.gift_ids.map((x) => asString(x)) : [];
      if (order.length === 0 || order.length > 40) return jsonResponse({ error: "invalid_order" }, 400);
      for (let i = 0; i < order.length; i++) {
        await service
          .from("christmas_tree_gifts")
          .update({ sort_order: i })
          .eq("id", order[i])
          .eq("tree_id", tree.id);
      }
      return jsonResponse({ ok: true });
    }

    if (action === "openGift") {
      const shareId = asString(body.share_id);
      const giftId = asString(body.gift_id);
      if (!shareId || !giftId) return jsonResponse({ error: "missing" }, 400);
      const { data: tree } = await service
        .from("christmas_trees")
        .select("*")
        .eq("share_id", shareId)
        .maybeSingle();
      if (!tree || !tree.share_enabled || tree.moderation_status !== "active") {
        return jsonResponse({ error: "unavailable" }, 404);
      }
      const { data: gift } = await service
        .from("christmas_tree_gifts")
        .select("*")
        .eq("id", giftId)
        .eq("tree_id", tree.id)
        .maybeSingle();
      if (!gift) return jsonResponse({ error: "gift_not_found" }, 404);
      const now = Date.now();
      const unlocked =
        gift.unlock_mode === "immediate" ||
        (gift.unlock_at && new Date(String(gift.unlock_at)).getTime() <= now);
      if (!unlocked) return jsonResponse({ error: "locked", code: "locked" }, 403);
      if (!gift.opened_at) {
        await service
          .from("christmas_tree_gifts")
          .update({ opened_at: new Date().toISOString() })
          .eq("id", gift.id);
        await service
          .from("christmas_trees")
          .update({ open_count: Number(tree.open_count || 0) + 1 })
          .eq("id", tree.id);
      }
      return jsonResponse({
        ok: true,
        gift: {
          id: gift.id,
          display_name: gift.display_name,
          message: gift.message,
          gift_type: gift.gift_type,
          box_style: gift.box_style,
        },
      });
    }

    if (action === "claimGuestTree") {
      if (!user?.id) return jsonResponse({ error: "auth_required" }, 401);
      const tree = await loadOwnerTree(service, body, null);
      if (!tree) return jsonResponse({ error: "forbidden" }, 403);
      if (tree.user_id && tree.user_id !== user.id) return jsonResponse({ error: "already_owned" }, 409);
      const { error } = await service
        .from("christmas_trees")
        .update({ user_id: user.id, owner_token_hash: null })
        .eq("id", tree.id);
      if (error) throw error;
      return jsonResponse({ ok: true, tree_id: tree.id, share_id: tree.share_id });
    }

    if (action === "listMyTrees") {
      if (!user?.id) return jsonResponse({ error: "auth_required" }, 401);
      const { data, error } = await service
        .from("christmas_trees")
        .select("id,share_id,share_enabled,title,tree_style,created_at,view_count,open_count")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return jsonResponse({ ok: true, trees: data || [] });
    }

    if (action === "adminListTrees") {
      await assertAdmin(user?.email);
      const { data, error } = await service
        .from("christmas_trees")
        .select(
          "id,user_id,share_id,share_enabled,tree_style,moderation_status,view_count,share_count,open_count,created_at,locale",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const withCounts = [];
      for (const t of data || []) {
        const { count } = await service
          .from("christmas_tree_gifts")
          .select("id", { count: "exact", head: true })
          .eq("tree_id", t.id);
        withCounts.push({
          id: t.id,
          account: t.user_id ? "user" : "guest",
          user_id: t.user_id,
          share_enabled: t.share_enabled,
          tree_style: t.tree_style,
          moderation_status: t.moderation_status,
          gift_count: count || 0,
          views: t.view_count,
          shares: t.share_count,
          opens: t.open_count,
          created_at: t.created_at,
          locale: t.locale,
          // deliberately omit title/message/from_name
        });
      }
      return jsonResponse({ ok: true, trees: withCounts });
    }

    if (action === "adminDisableShare") {
      await assertAdmin(user?.email);
      const treeId = asString(body.tree_id);
      if (!treeId) return jsonResponse({ error: "missing_tree" }, 400);
      const { error } = await service
        .from("christmas_trees")
        .update({ share_enabled: false, moderation_status: "disabled" })
        .eq("id", treeId);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    // ---- Advent ----
    if (action === "adventStatus") {
      const parts = adventDayParts(parseInjectedDate(body), SEASON_YEAR);
      const { data: rewards } = await service
        .from("christmas_advent_rewards")
        .select("id,day,reward_type,title,description,active,config")
        .eq("season_year", SEASON_YEAR)
        .eq("locale", "en")
        .order("day", { ascending: true });
      let claims: Record<string, unknown>[] = [];
      if (user?.id) {
        const { data } = await service
          .from("christmas_advent_claims")
          .select("day,reward_id,entitlement_key,created_at")
          .eq("user_id", user.id)
          .eq("season_year", SEASON_YEAR);
        claims = data || [];
      }
      return jsonResponse({
        ok: true,
        season_year: SEASON_YEAR,
        timezone_policy: "Europe/Bucharest",
        engine_ready: true,
        production_claims_live: adventEnabled() && parts.eligibleDay != null,
        advent_enabled: adventEnabled(),
        calendar: {
          year: parts.year,
          month: parts.month,
          day: parts.day,
          eligible_day: parts.eligibleDay,
          before_season: parts.beforeSeason,
          after_season: parts.afterSeason,
        },
        rewards: (rewards || []).map((r: Record<string, unknown>) => ({
          day: r.day,
          title: r.title,
          description: r.description,
          reward_type: r.reward_type,
          active: r.active,
          claimed: claims.some((c) => Number(c.day) === Number(r.day)),
        })),
        auth_required_for_claim: true,
      });
    }

    if (action === "claimAdvent") {
      if (!user?.id || !user.email) return jsonResponse({ error: "auth_required" }, 401);
      if (!adventEnabled() && !body.__test_force) {
        return jsonResponse({ error: "advent_disabled", code: "advent_disabled" }, 403);
      }
      const parts = adventDayParts(parseInjectedDate(body), SEASON_YEAR);
      const requestedDay = Number(body.day);
      if (!Number.isInteger(requestedDay) || requestedDay < 1 || requestedDay > 24) {
        return jsonResponse({ error: "invalid_day" }, 400);
      }
      // Production: only eligibleDay. Test inject allows matching injected date.
      if (parts.eligibleDay !== requestedDay) {
        return jsonResponse({ error: "not_eligible", code: "not_eligible" }, 403);
      }
      const { data: reward } = await service
        .from("christmas_advent_rewards")
        .select("*")
        .eq("season_year", SEASON_YEAR)
        .eq("day", requestedDay)
        .eq("locale", "en")
        .maybeSingle();
      if (!reward || (!reward.active && !body.__test_force)) {
        return jsonResponse({ error: "inactive_reward" }, 403);
      }
      if (reward.reward_type === "credits" && !adventCreditsEnabled()) {
        return jsonResponse({ error: "credits_disabled" }, 403);
      }
      const idem = `advent:${SEASON_YEAR}:${requestedDay}:${user.id}`;
      const { data: existing } = await service
        .from("christmas_advent_claims")
        .select("*")
        .eq("idempotency_key", idem)
        .maybeSingle();
      if (existing) {
        return jsonResponse({
          ok: true,
          already: true,
          claim_id: existing.id,
          entitlement_key: existing.entitlement_key,
          reward_type: reward.reward_type,
          title: reward.title,
        });
      }

      let ledgerId: string | null = null;
      let entitlementKey: string | null = null;
      if (reward.reward_type === "credits") {
        const credits = Math.min(Number(reward.reward_value) || 0, 5);
        if (credits <= 0) return jsonResponse({ error: "invalid_credit_value" }, 400);
        const note = `christmas_advent:${SEASON_YEAR}:${requestedDay}:${user.id}`;
        const { data: led, error: ledErr } = await service
          .from("credits_ledger")
          .insert({
            user_convex_id: user.email.trim().toLowerCase(),
            user_id: user.id,
            direction: "in",
            credits,
            event_type: "christmas_advent",
            category: "christmas_advent",
            note,
            amount: null,
            currency: "eur",
          })
          .select("id")
          .single();
        if (ledErr) {
          // unique note race → treat as already
          if (String(ledErr.message || "").includes("duplicate") || ledErr.code === "23505") {
            const { data: again } = await service
              .from("christmas_advent_claims")
              .select("*")
              .eq("idempotency_key", idem)
              .maybeSingle();
            return jsonResponse({ ok: true, already: true, claim_id: again?.id });
          }
          throw ledErr;
        }
        ledgerId = led.id;
      } else if (reward.reward_type === "cosmetic") {
        entitlementKey = asString((reward.config as Record<string, unknown>)?.entitlement_key) ||
          "gold_star_topper";
      }

      const { data: claim, error: claimErr } = await service
        .from("christmas_advent_claims")
        .insert({
          reward_id: reward.id,
          user_id: user.id,
          season_year: SEASON_YEAR,
          day: requestedDay,
          claim_date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
          ledger_entry_id: ledgerId,
          entitlement_key: entitlementKey,
          idempotency_key: idem,
        })
        .select("id")
        .single();
      if (claimErr) {
        if (claimErr.code === "23505") {
          return jsonResponse({ ok: true, already: true });
        }
        throw claimErr;
      }
      if (entitlementKey) {
        await service.from("christmas_reward_entitlements").upsert(
          {
            user_id: user.id,
            entitlement_key: entitlementKey,
            source: "christmas_advent",
            source_ref: claim.id,
          },
          { onConflict: "source,source_ref" },
        );
      }
      return jsonResponse({
        ok: true,
        claim_id: claim.id,
        reward_type: reward.reward_type,
        title: reward.title,
        description: reward.description,
        entitlement_key: entitlementKey,
        credits_granted: reward.reward_type === "credits" ? Number(reward.reward_value) : 0,
      });
    }

    // ---- Free gift ----
    if (action === "claimFreeGift") {
      if (!freeGiftEnabled() && !body.__test_force) {
        return jsonResponse({ error: "free_gift_disabled" }, 403);
      }
      const guestToken = asString(body.guest_token);
      const guestHash = guestToken ? await sha256Hex(guestToken) : null;
      if (!user?.id && !guestHash) return jsonResponse({ error: "identity_required" }, 400);

      const idem = user?.id
        ? `free_gift:${SEASON_YEAR}:user:${user.id}`
        : `free_gift:${SEASON_YEAR}:guest:${guestHash}`;

      const { data: existing } = await service
        .from("christmas_free_gift_claims")
        .select("*, christmas_free_gifts(*)")
        .eq("idempotency_key", idem)
        .maybeSingle();
      if (existing) {
        const g = existing.christmas_free_gifts as Record<string, unknown>;
        return jsonResponse({
          ok: true,
          already: true,
          gift: {
            title: g?.title,
            description: g?.description,
            reward_type: g?.reward_type,
            entitlement_key: existing.entitlement_key,
          },
        });
      }

      const { data: pool } = await service
        .from("christmas_free_gifts")
        .select("*")
        .eq("season_year", SEASON_YEAR);
      // Never grant monetary credits to anonymous/guest free-gift traffic.
      let candidates = (pool || []).filter((g: Record<string, unknown>) => {
        if (g.reward_type === "credits") return false;
        if (body.__test_force) return true;
        return Boolean(g.active);
      });
      if (candidates.length === 0) return jsonResponse({ error: "no_gifts" }, 503);

      const picked = weightedPick(candidates);
      if (picked.reward_type === "credits" && !user?.id) {
        return jsonResponse({ error: "auth_required_for_credits" }, 401);
      }

      let entitlementKey: string | null = null;
      if (picked.reward_type === "cosmetic") {
        entitlementKey =
          asString((picked.config as Record<string, unknown>)?.entitlement_key) ||
          "snow_globe_ornament";
      }

      const { data: claim, error: claimErr } = await service
        .from("christmas_free_gift_claims")
        .insert({
          gift_id: picked.id,
          user_id: user?.id || null,
          guest_token_hash: user?.id ? null : guestHash,
          season_year: SEASON_YEAR,
          entitlement_key: entitlementKey,
          idempotency_key: idem,
        })
        .select("id")
        .single();
      if (claimErr) {
        if (claimErr.code === "23505") return jsonResponse({ ok: true, already: true });
        throw claimErr;
      }
      if (entitlementKey) {
        await service.from("christmas_reward_entitlements").insert({
          user_id: user?.id || null,
          guest_token_hash: user?.id ? null : guestHash,
          entitlement_key: entitlementKey,
          source: "christmas_free_gift",
          source_ref: claim.id,
        });
      }
      return jsonResponse({
        ok: true,
        gift: {
          title: picked.title,
          description: picked.description,
          reward_type: picked.reward_type,
          entitlement_key: entitlementKey,
          message: asString((picked.config as Record<string, unknown>)?.message) || null,
        },
      });
    }

    // ---- Gift Tree marketing experience (/christmas/gifts) ----
    if (action === "openGiftTree") {
      if (!giftTreeEnabled() && !body.__test_force) {
        return jsonResponse({ error: "gift_tree_disabled" }, 403);
      }
      const guestToken = asString(body.guest_token);
      const guestHash = guestToken.length >= 32 ? await sha256Hex(guestToken) : null;
      if (!user?.id && !guestHash) return jsonResponse({ error: "identity_required" }, 400);

      const idem = giftTreeClaimIdempotency({
        seasonYear: GIFT_TREE_SEASON_YEAR,
        userId: user?.id,
        guestHash,
      });

      const { data: existing } = await service
        .from("christmas_reward_entitlements")
        .select("*")
        .eq("source", "christmas_tree")
        .eq("source_ref", idem)
        .maybeSingle();
      if (existing) {
        const reward =
          GIFT_TREE_REWARDS.find((r) => r.entitlement_key === existing.entitlement_key) ||
          findGiftTreeReward(asString(existing.entitlement_key).replace("gift_tree_", "")) ||
          GIFT_TREE_REWARDS.find((r) => r.id === asString(body.reward_id));
        const resolved = reward || GIFT_TREE_REWARDS[0]!;
        return jsonResponse({
          ok: true,
          already: true,
          claim_id: existing.id,
          reward_id: resolved.id,
          reward: publicGiftTreeReward(resolved),
          credits_granted: 0,
          requires_auth_for_credits: resolved.type === "credits" && !user?.id,
        });
      }

      const picked = pickGiftTreeReward();
      const { data: claim, error: claimErr } = await service
        .from("christmas_reward_entitlements")
        .insert({
          user_id: user?.id || null,
          guest_token_hash: user?.id ? null : guestHash,
          entitlement_key: picked.entitlement_key,
          source: "christmas_tree",
          source_ref: idem,
        })
        .select("id")
        .single();
      if (claimErr) {
        if (claimErr.code === "23505") {
          const { data: again } = await service
            .from("christmas_reward_entitlements")
            .select("*")
            .eq("source", "christmas_tree")
            .eq("source_ref", idem)
            .maybeSingle();
          const reward =
            GIFT_TREE_REWARDS.find((r) => r.entitlement_key === again?.entitlement_key) ||
            picked;
          return jsonResponse({
            ok: true,
            already: true,
            claim_id: again?.id,
            reward_id: reward.id,
            reward: publicGiftTreeReward(reward),
            credits_granted: 0,
            requires_auth_for_credits: reward.type === "credits" && !user?.id,
          });
        }
        throw claimErr;
      }

      let creditsGranted = 0;
      if (
        picked.type === "credits" &&
        user?.id &&
        user.email &&
        giftTreeCreditsEnabled()
      ) {
        const credits = Math.min(Math.max(Number(picked.value) || 0, 0), 50);
        if (credits > 0) {
          const note = `christmas_gift_tree:${GIFT_TREE_SEASON_YEAR}:${user.id}`;
          const { data: existingLed } = await service
            .from("credits_ledger")
            .select("id")
            .eq("note", note)
            .maybeSingle();
          if (existingLed) {
            creditsGranted = 0;
          } else {
            const { error: ledErr } = await service.from("credits_ledger").insert({
              user_convex_id: user.email.trim().toLowerCase(),
              user_id: user.id,
              direction: "in",
              credits,
              event_type: "christmas_gift_tree",
              category: "christmas_gift_tree",
              note,
              amount: null,
              currency: "eur",
            });
            if (!ledErr) creditsGranted = credits;
          }
        }
      }

      return jsonResponse({
        ok: true,
        claim_id: claim.id,
        reward_id: picked.id,
        reward: publicGiftTreeReward(picked),
        credits_granted: creditsGranted,
        requires_auth_for_credits: picked.type === "credits" && !user?.id,
        present_id: asString(body.present_id) || null,
      });
    }

    if (action === "claimGiftTree") {
      if (!giftTreeEnabled() && !body.__test_force) {
        return jsonResponse({ error: "gift_tree_disabled" }, 403);
      }
      const guestToken = asString(body.guest_token);
      const guestHash = guestToken.length >= 32 ? await sha256Hex(guestToken) : null;
      const claimId = asString(body.claim_id);

      let entitlement: Record<string, unknown> | null = null;
      if (claimId) {
        const { data } = await service
          .from("christmas_reward_entitlements")
          .select("*")
          .eq("id", claimId)
          .eq("source", "christmas_tree")
          .maybeSingle();
        entitlement = data;
      }
      if (!entitlement) {
        const idem = giftTreeClaimIdempotency({
          seasonYear: GIFT_TREE_SEASON_YEAR,
          userId: user?.id,
          guestHash,
        });
        const { data } = await service
          .from("christmas_reward_entitlements")
          .select("*")
          .eq("source", "christmas_tree")
          .eq("source_ref", idem)
          .maybeSingle();
        entitlement = data;
      }
      // Guest claim → attach to logged-in user when possible
      if (!entitlement && user?.id && guestHash) {
        const guestIdem = giftTreeClaimIdempotency({
          seasonYear: GIFT_TREE_SEASON_YEAR,
          guestHash,
        });
        const { data } = await service
          .from("christmas_reward_entitlements")
          .select("*")
          .eq("source", "christmas_tree")
          .eq("source_ref", guestIdem)
          .maybeSingle();
        entitlement = data;
        if (entitlement && !entitlement.user_id) {
          await service
            .from("christmas_reward_entitlements")
            .update({ user_id: user.id })
            .eq("id", entitlement.id);
        }
      }
      if (!entitlement) return jsonResponse({ error: "claim_not_found" }, 404);

      const reward =
        GIFT_TREE_REWARDS.find((r) => r.entitlement_key === entitlement!.entitlement_key) ||
        null;
      if (!reward) return jsonResponse({ error: "unknown_reward" }, 400);

      let creditsGranted = 0;
      if (reward.type === "credits") {
        if (!user?.id || !user.email) {
          return jsonResponse({ error: "auth_required_for_credits" }, 401);
        }
        if (!giftTreeCreditsEnabled()) {
          return jsonResponse({ error: "credits_disabled" }, 403);
        }
        const credits = Math.min(Math.max(Number(reward.value) || 0, 0), 50);
        const note = `christmas_gift_tree:${GIFT_TREE_SEASON_YEAR}:${user.id}`;
        const { data: existingLed } = await service
          .from("credits_ledger")
          .select("id")
          .eq("note", note)
          .maybeSingle();
        if (existingLed) {
          return jsonResponse({
            ok: true,
            already: true,
            reward_id: reward.id,
            credits_granted: 0,
            claim_id: entitlement.id,
          });
        }
        const { data: led, error: ledErr } = await service
          .from("credits_ledger")
          .insert({
            user_convex_id: user.email.trim().toLowerCase(),
            user_id: user.id,
            direction: "in",
            credits,
            event_type: "christmas_gift_tree",
            category: "christmas_gift_tree",
            note,
            amount: null,
            currency: "eur",
          })
          .select("id")
          .single();
        if (ledErr) {
          if (ledErr.code === "23505" || String(ledErr.message || "").includes("duplicate")) {
            return jsonResponse({
              ok: true,
              already: true,
              reward_id: reward.id,
              credits_granted: 0,
              claim_id: entitlement.id,
            });
          }
          throw ledErr;
        }
        creditsGranted = credits;
        void led;
      }

      return jsonResponse({
        ok: true,
        reward_id: reward.id,
        credits_granted: creditsGranted,
        claim_id: entitlement.id,
        reward: publicGiftTreeReward(reward),
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});

function sanitizeDecor(value: unknown): Record<string, unknown> {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    lights: Boolean(raw.lights ?? true),
    snow: Boolean(raw.snow ?? false),
    topper: ["star", "angel", "bow", "none"].includes(asString(raw.topper))
      ? asString(raw.topper)
      : "star",
    ornaments: ["classic", "gold", "minimal", "colorful"].includes(asString(raw.ornaments))
      ? asString(raw.ornaments)
      : "classic",
  };
}

async function loadOwnerTree(
  service: ReturnType<typeof getServiceClient>,
  body: Body,
  userId: string | null | undefined,
) {
  const treeId = asString(body.tree_id);
  const ownerToken = asString(body.owner_token);
  if (treeId && userId) {
    const { data } = await service.from("christmas_trees").select("*").eq("id", treeId).maybeSingle();
    if (data && data.user_id === userId) return data;
  }
  if (ownerToken.length >= 32) {
    const hash = await sha256Hex(ownerToken);
    const { data } = await service
      .from("christmas_trees")
      .select("*")
      .eq("owner_token_hash", hash)
      .maybeSingle();
    if (data) return data;
  }
  if (treeId && ownerToken.length >= 32) {
    const hash = await sha256Hex(ownerToken);
    const { data } = await service
      .from("christmas_trees")
      .select("*")
      .eq("id", treeId)
      .eq("owner_token_hash", hash)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

function parseInjectedDate(body: Body): Date {
  const raw = asString(body.__test_date);
  if (raw && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw + (raw.includes("T") ? "" : "T12:00:00+02:00"));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function weightedPick(items: Record<string, unknown>[]): Record<string, unknown> {
  const total = items.reduce((s, i) => s + (Number(i.weight) || 1), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= Number(item.weight) || 1;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}
