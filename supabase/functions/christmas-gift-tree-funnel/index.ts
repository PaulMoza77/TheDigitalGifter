import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import { asString } from "../_shared/christmas/crypto.ts";
import {
  ensureGiftTreeAccount,
  filterOpenableRewards,
  giftTreeCreditsEnabled,
  giftTreeEnabled,
  GIFT_TREE_FREE_OPENS_PER_SEASON,
  GIFT_TREE_PRODUCT_KEY,
  GIFT_TREE_SEASON_YEAR,
  hashGuestToken,
  publicRewardFromRow,
  remainingFreeOpens,
  weightedPick,
} from "../_shared/christmas/giftTree.ts";

type Body = Record<string, unknown>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = asString(body.action);
    const service = getServiceClient();
    const { user } = await getAuthUser(req);
    const guestHash = await hashGuestToken(asString(body.guest_token));
    const forceTest = Boolean(body.__test_force);

    if (action === "status") {
      const account = user?.id || guestHash
        ? await ensureGiftTreeAccount(service, { userId: user?.id, guestHash })
        : null;

      const { data: productRow } = await service
        .from("christmas_products")
        .select("id")
        .eq("product_key", GIFT_TREE_PRODUCT_KEY)
        .maybeSingle();
      const { data: packs } = productRow?.id
        ? await service
            .from("christmas_packages")
            .select("package_key, package_name, description, price_cents, currency, active, purchasable, metadata, features")
            .eq("product_id", productRow.id)
            .order("sort_order", { ascending: true })
        : { data: [] as Record<string, unknown>[] };

      let opens: Record<string, unknown>[] = [];
      if (account?.id) {
        const { data } = await service
          .from("christmas_gift_tree_opens")
          .select("id, open_kind, box_slot, reward_key, reward_type, title, entitlement_key, created_at")
          .eq("account_id", account.id)
          .order("created_at", { ascending: false })
          .limit(20);
        opens = data || [];
      }

      const freeUsed = Number(account?.free_opens_used || 0);
      const paidRemaining = Number(account?.paid_opens_remaining || 0);
      const opensOn = giftTreeEnabled() || forceTest;

      return jsonResponse({
        ok: true,
        product_key: GIFT_TREE_PRODUCT_KEY,
        season_year: GIFT_TREE_SEASON_YEAR,
        distinct_from: "/christmas/tree",
        engine_ready: true,
        production_opens_live: opensOn,
        gift_tree_enabled: giftTreeEnabled(),
        credits_enabled: giftTreeCreditsEnabled(),
        identity: user?.id ? "user" : guestHash ? "guest" : null,
        remaining_free_opens: opensOn ? remainingFreeOpens(freeUsed) : 0,
        remaining_paid_opens: paidRemaining,
        remaining_opens: (opensOn ? remainingFreeOpens(freeUsed) : 0) + paidRemaining,
        free_opens_per_season: GIFT_TREE_FREE_OPENS_PER_SEASON,
        opens,
        packs: (packs || []).map((pkg) => ({
          package_key: pkg.package_key,
          package_name: pkg.package_name,
          description: pkg.description,
          price_cents: pkg.price_cents,
          currency: pkg.currency,
          active: pkg.active,
          purchasable: pkg.purchasable,
          opens: Number((pkg.metadata as Record<string, unknown> | null)?.opens) || 0,
          features: pkg.features,
        })),
        checkout_hint:
          "Apple Pay / Google Pay / card via Stripe Checkout Elements when a pack is purchasable and CHRISTMAS_CHECKOUT_ENABLED is on.",
      });
    }

    if (action === "openGift") {
      if (!user?.id && !guestHash) return jsonResponse({ error: "identity_required" }, 400);

      const account = await ensureGiftTreeAccount(service, { userId: user?.id, guestHash });
      if (!account) return jsonResponse({ error: "identity_required" }, 400);

      const paidRemaining = Number(account.paid_opens_remaining || 0);
      const freeLeft = remainingFreeOpens(Number(account.free_opens_used || 0));
      const opensOn = giftTreeEnabled() || forceTest;

      let kind: "free" | "paid" | null = null;
      if (opensOn && freeLeft > 0) kind = "free";
      else if (paidRemaining > 0) kind = "paid";
      else if (!opensOn) return jsonResponse({ error: "opens_disabled" }, 403);
      else return jsonResponse({ error: "need_pack" }, 402);

      const { data: pool } = await service
        .from("christmas_gift_tree_rewards")
        .select("*")
        .eq("season_year", GIFT_TREE_SEASON_YEAR);

      const candidates = filterOpenableRewards(pool || [], {
        kind,
        authenticated: Boolean(user?.id),
        creditsEnabled: giftTreeCreditsEnabled(),
        requireActive: !forceTest,
      });
      if (candidates.length === 0) return jsonResponse({ error: "no_rewards" }, 503);

      const picked = weightedPick(candidates);
      if (!picked) return jsonResponse({ error: "no_rewards" }, 503);
      if (picked.reward_type === "credits" && !user?.id) {
        return jsonResponse({ error: "auth_required_for_credits" }, 401);
      }

      const publicReward = publicRewardFromRow(picked);
      const slotRaw = body.box_slot;
      const boxSlot =
        slotRaw == null || slotRaw === ""
          ? null
          : Math.max(0, Math.min(20, Math.round(Number(slotRaw))));

      const idem = kind === "free"
        ? user?.id
          ? `gift_tree_free:${GIFT_TREE_SEASON_YEAR}:user:${user.id}`
          : `gift_tree_free:${GIFT_TREE_SEASON_YEAR}:guest:${guestHash}`
        : `gift_tree_paid:${account.id}:${crypto.randomUUID()}`;

      if (kind === "free") {
        const { data: existing } = await service
          .from("christmas_gift_tree_opens")
          .select("id, reward_key, reward_type, title, entitlement_key, open_kind, box_slot")
          .eq("idempotency_key", idem)
          .maybeSingle();
        if (existing) {
          return jsonResponse({
            ok: true,
            already: true,
            open_kind: "free",
            reward: {
              reward_key: existing.reward_key,
              reward_type: existing.reward_type,
              title: existing.title,
              entitlement_key: existing.entitlement_key,
            },
          });
        }
      }

      const { data: openRow, error: openErr } = await service
        .from("christmas_gift_tree_opens")
        .insert({
          account_id: account.id,
          reward_id: picked.id,
          user_id: user?.id || null,
          guest_token_hash: user?.id ? null : guestHash,
          season_year: GIFT_TREE_SEASON_YEAR,
          open_kind: kind,
          box_slot: Number.isFinite(boxSlot as number) ? boxSlot : null,
          reward_key: publicReward.reward_key,
          reward_type: publicReward.reward_type,
          title: publicReward.title,
          entitlement_key: publicReward.entitlement_key,
          idempotency_key: idem,
        })
        .select("id")
        .single();
      if (openErr) {
        if (openErr.code === "23505" && kind === "free") {
          return jsonResponse({ ok: true, already: true, open_kind: "free" });
        }
        throw openErr;
      }

      const nextFree = kind === "free" ? Number(account.free_opens_used || 0) + 1 : account.free_opens_used;
      const nextPaid = kind === "paid" ? paidRemaining - 1 : paidRemaining;
      const { error: balErr } = await service
        .from("christmas_gift_tree_accounts")
        .update({
          free_opens_used: nextFree,
          paid_opens_remaining: nextPaid,
        })
        .eq("id", account.id);
      if (balErr) throw balErr;

      if (publicReward.entitlement_key) {
        await service.from("christmas_reward_entitlements").insert({
          user_id: user?.id || null,
          guest_token_hash: user?.id ? null : guestHash,
          entitlement_key: publicReward.entitlement_key,
          source: "christmas_gift_tree",
          source_ref: openRow.id,
        });
      }

      if (publicReward.reward_type === "credits" && user?.id && giftTreeCreditsEnabled()) {
        const credits = Math.min(publicReward.credits_granted, 5);
        if (credits > 0) {
          const note = `christmas_gift_tree:${GIFT_TREE_SEASON_YEAR}:${openRow.id}:${user.id}`;
          await service.from("credits_ledger").insert({
            user_convex_id: (user.email || user.id).trim().toLowerCase(),
            user_id: user.id,
            direction: "in",
            credits,
            event_type: "christmas_gift_tree",
            category: "christmas_gift_tree",
            note,
            amount: null,
            currency: "eur",
          });
        }
      }

      return jsonResponse({
        ok: true,
        open_kind: kind,
        reward: publicReward,
        remaining_free_opens: opensOn ? remainingFreeOpens(Number(nextFree)) : 0,
        remaining_paid_opens: nextPaid,
      });
    }

    if (action === "claimGuestAccount") {
      if (!user?.id) return jsonResponse({ error: "auth_required" }, 401);
      if (!guestHash) return jsonResponse({ error: "guest_token_required" }, 400);
      const guestAccount = await service
        .from("christmas_gift_tree_accounts")
        .select("*")
        .eq("guest_token_hash", guestHash)
        .eq("season_year", GIFT_TREE_SEASON_YEAR)
        .maybeSingle();
      if (!guestAccount.data) return jsonResponse({ ok: true, claimed: false });

      const userAccount = await ensureGiftTreeAccount(service, { userId: user.id });
      if (!userAccount) return jsonResponse({ error: "identity_required" }, 400);

      await service
        .from("christmas_gift_tree_accounts")
        .update({
          paid_opens_remaining:
            Number(userAccount.paid_opens_remaining || 0) + Number(guestAccount.data.paid_opens_remaining || 0),
          paid_opens_granted:
            Number(userAccount.paid_opens_granted || 0) + Number(guestAccount.data.paid_opens_granted || 0),
          free_opens_used: Math.max(
            Number(userAccount.free_opens_used || 0),
            Number(guestAccount.data.free_opens_used || 0),
          ),
        })
        .eq("id", userAccount.id);
      await service
        .from("christmas_gift_tree_opens")
        .update({ user_id: user.id, guest_token_hash: null })
        .eq("account_id", guestAccount.data.id);
      await service
        .from("christmas_gift_tree_grants")
        .update({ user_id: user.id, account_id: userAccount.id })
        .eq("account_id", guestAccount.data.id);
      await service.from("christmas_gift_tree_accounts").delete().eq("id", guestAccount.data.id);
      return jsonResponse({ ok: true, claimed: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
