/**
 * Same-origin Christmas Gift Tree open/claim API (Mozas Node / Vercel-compat).
 * Server-authoritative weighted rewards + entitlements + credits_ledger.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash, randomBytes } from "node:crypto";
import {
  GIFT_TREE_REWARD_CATALOG,
  GIFT_TREE_SEASON_YEAR,
  findGiftTreeReward,
  type GiftTreeRewardDef,
} from "../src/features/christmas/gifts/rewardCatalog";
import { pickWeightedReward } from "../src/features/christmas/gifts/rewardEngine";

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(
  /\/$/,
  "",
);
const SERVICE_ROLE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

function originAllowed(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    if (url.hostname.endsWith(".vercel.app")) return true;
    if (url.hostname === "www.thedigitalgifter.com" || url.hostname === "thedigitalgifter.com") {
      return true;
    }
    if (host && url.host === host) return true;
    return false;
  } catch {
    return false;
  }
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function publicReward(reward: GiftTreeRewardDef) {
  return {
    id: reward.id,
    type: reward.type,
    value: reward.value,
    title: reward.title,
    description: reward.description,
    entitlement_key: reward.entitlementKey,
    claim_path: reward.claimPath,
  };
}

function giftTreeEnabled(): boolean {
  const raw = String(process.env.CHRISTMAS_GIFT_TREE_ENABLED || "true").toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

function giftTreeCreditsEnabled(): boolean {
  const raw = String(process.env.CHRISTMAS_GIFT_TREE_CREDITS_ENABLED || "true").toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

function claimIdem(userId: string | null, guestHash: string | null): string {
  if (userId) return `gift_tree:${GIFT_TREE_SEASON_YEAR}:user:${userId}`;
  return `gift_tree:${GIFT_TREE_SEASON_YEAR}:guest:${guestHash}`;
}

async function supabaseRest<T>(
  path: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return { data: null, error: "supabase_unconfigured", status: 503 };
  }
  const headers: Record<string, string> = {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const errObj = data as { message?: string; code?: string } | null;
    return {
      data: null,
      error: errObj?.message || `rest_${res.status}`,
      status: res.status,
    };
  }
  return { data, error: null, status: res.status };
}

async function getUserFromAuthHeader(req: VercelRequest): Promise<{
  id: string;
  email: string | null;
} | null> {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token === SERVICE_ROLE || token.length < 20) return null;
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; email?: string };
  if (!user?.id) return null;
  return { id: user.id, email: user.email || null };
}

type EntitlementRow = {
  id: string;
  entitlement_key: string;
  user_id: string | null;
  guest_token_hash: string | null;
  source_ref: string;
};

function rewardFromEntitlement(row: EntitlementRow): GiftTreeRewardDef {
  return (
    GIFT_TREE_REWARD_CATALOG.find((r) => r.entitlementKey === row.entitlement_key) ||
    findGiftTreeReward(row.entitlement_key) ||
    GIFT_TREE_REWARD_CATALOG[0]!
  );
}

async function findEntitlementByRef(sourceRef: string): Promise<EntitlementRow | null> {
  const { data } = await supabaseRest<EntitlementRow[]>(
    `christmas_reward_entitlements?source=eq.christmas_tree&source_ref=eq.${encodeURIComponent(sourceRef)}&select=id,entitlement_key,user_id,guest_token_hash,source_ref&limit=1`,
  );
  return data?.[0] || null;
}

async function findEntitlementById(id: string): Promise<EntitlementRow | null> {
  const { data } = await supabaseRest<EntitlementRow[]>(
    `christmas_reward_entitlements?id=eq.${encodeURIComponent(id)}&source=eq.christmas_tree&select=id,entitlement_key,user_id,guest_token_hash,source_ref&limit=1`,
  );
  return data?.[0] || null;
}

async function grantCredits(user: {
  id: string;
  email: string;
}, value: number): Promise<{ granted: number; already: boolean }> {
  const credits = Math.min(Math.max(value, 0), 50);
  if (credits <= 0) return { granted: 0, already: false };
  const note = `christmas_gift_tree:${GIFT_TREE_SEASON_YEAR}:${user.id}`;
  const existing = await supabaseRest<{ id: string }[]>(
    `credits_ledger?note=eq.${encodeURIComponent(note)}&select=id&limit=1`,
  );
  if (existing.data?.[0]) return { granted: 0, already: true };
  const insert = await supabaseRest<{ id: string }[]>("credits_ledger", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify({
      user_convex_id: user.email.trim().toLowerCase(),
      user_id: user.id,
      direction: "in",
      credits,
      event_type: "christmas_gift_tree",
      category: "christmas_gift_tree",
      note,
      amount: null,
      currency: "eur",
    }),
  });
  if (insert.error) {
    if (/duplicate|unique|23505/i.test(insert.error)) return { granted: 0, already: true };
    throw new Error(insert.error);
  }
  return { granted: credits, already: false };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const host = typeof req.headers.host === "string" ? req.headers.host : undefined;
  if (!originAllowed(origin, host)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  if (!giftTreeEnabled()) {
    return res.status(403).json({ error: "gift_tree_disabled" });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(503).json({ error: "supabase_unconfigured" });
  }

  try {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<
      string,
      unknown
    >;
    const action = String(body.action || "").trim();
    const user = await getUserFromAuthHeader(req);
    const guestToken = String(body.guest_token || "").trim();
    const guestHash = guestToken.length >= 32 ? sha256Hex(guestToken) : null;
    if (!user?.id && !guestHash) {
      return res.status(400).json({ error: "identity_required" });
    }

    if (action === "openGiftTree") {
      const idem = claimIdem(user?.id || null, guestHash);
      const existing = await findEntitlementByRef(idem);
      if (existing) {
        const reward = rewardFromEntitlement(existing);
        return res.status(200).json({
          ok: true,
          already: true,
          claim_id: existing.id,
          reward_id: reward.id,
          reward: publicReward(reward),
          credits_granted: 0,
          requires_auth_for_credits: reward.type === "credits" && !user?.id,
        });
      }

      const picked = pickWeightedReward(GIFT_TREE_REWARD_CATALOG);
      const insert = await supabaseRest<EntitlementRow[]>("christmas_reward_entitlements", {
        method: "POST",
        prefer: "return=representation",
        body: JSON.stringify({
          user_id: user?.id || null,
          guest_token_hash: user?.id ? null : guestHash,
          entitlement_key: picked.entitlementKey,
          source: "christmas_tree",
          source_ref: idem,
        }),
      });
      if (insert.error) {
        if (/duplicate|unique|23505/i.test(insert.error)) {
          const again = await findEntitlementByRef(idem);
          const reward = again ? rewardFromEntitlement(again) : picked;
          return res.status(200).json({
            ok: true,
            already: true,
            claim_id: again?.id || randomBytes(8).toString("hex"),
            reward_id: reward.id,
            reward: publicReward(reward),
            credits_granted: 0,
            requires_auth_for_credits: reward.type === "credits" && !user?.id,
          });
        }
        throw new Error(insert.error);
      }
      const claim = insert.data?.[0];
      let creditsGranted = 0;
      if (
        picked.type === "credits" &&
        user?.id &&
        user.email &&
        giftTreeCreditsEnabled()
      ) {
        const result = await grantCredits({ id: user.id, email: user.email }, picked.value);
        creditsGranted = result.granted;
      }

      return res.status(200).json({
        ok: true,
        claim_id: claim?.id,
        reward_id: picked.id,
        reward: publicReward(picked),
        credits_granted: creditsGranted,
        requires_auth_for_credits: picked.type === "credits" && !user?.id,
        present_id: String(body.present_id || "") || null,
      });
    }

    if (action === "claimGiftTree") {
      const claimId = String(body.claim_id || "").trim();
      let entitlement: EntitlementRow | null = claimId ? await findEntitlementById(claimId) : null;
      if (!entitlement) {
        entitlement = await findEntitlementByRef(claimIdem(user?.id || null, guestHash));
      }
      if (!entitlement && user?.id && guestHash) {
        entitlement = await findEntitlementByRef(claimIdem(null, guestHash));
        if (entitlement && !entitlement.user_id) {
          await supabaseRest(
            `christmas_reward_entitlements?id=eq.${encodeURIComponent(entitlement.id)}`,
            {
              method: "PATCH",
              body: JSON.stringify({ user_id: user.id }),
            },
          );
        }
      }
      if (!entitlement) return res.status(404).json({ error: "claim_not_found" });

      const reward = rewardFromEntitlement(entitlement);
      let creditsGranted = 0;
      if (reward.type === "credits") {
        if (!user?.id || !user.email) {
          return res.status(401).json({ error: "auth_required_for_credits" });
        }
        if (!giftTreeCreditsEnabled()) {
          return res.status(403).json({ error: "credits_disabled" });
        }
        const result = await grantCredits({ id: user.id, email: user.email }, reward.value);
        if (result.already) {
          return res.status(200).json({
            ok: true,
            already: true,
            reward_id: reward.id,
            credits_granted: 0,
            claim_id: entitlement.id,
          });
        }
        creditsGranted = result.granted;
      }

      return res.status(200).json({
        ok: true,
        reward_id: reward.id,
        credits_granted: creditsGranted,
        claim_id: entitlement.id,
        reward: publicReward(reward),
      });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
