/**
 * Same-origin Christmas Gift Tree API.
 * Actions: openGiftTree | claimGiftEmail | claimGiftTree | getGiftTreeStatus | listMyGifts
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash, randomBytes } from "node:crypto";
import {
  GIFT_TREE_PAID_OFFERS,
  GIFT_TREE_REWARD_CATALOG,
  GIFT_TREE_SEASON_YEAR,
  findGiftTreeReward,
  type GiftTreeRewardDef,
} from "../src/features/christmas/gifts/rewardCatalog";
import { pickEligibleGiftTreeReward } from "../src/features/christmas/gifts/rewardEngine";

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_ROLE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const SITE_ORIGIN = String(
  process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://www.thedigitalgifter.com",
).replace(/\/$/, "");

type EntitlementRow = {
  id: string;
  entitlement_key: string;
  user_id: string | null;
  guest_token_hash: string | null;
  source_ref: string;
  email_normalized?: string | null;
  claimed_email_at?: string | null;
  status?: string | null;
  expires_at?: string | null;
  redeemed_at?: string | null;
  created_at?: string;
};

function isOriginAllowed(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    if (url.hostname.endsWith(".vercel.app")) return true;
    if (url.hostname === "www.thedigitalgifter.com" || url.hostname === "thedigitalgifter.com") return true;
    if (host && url.host === host) return true;
    return false;
  } catch {
    return false;
  }
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(raw: unknown): string | null {
  const email = String(raw || "").trim().toLowerCase();
  if (!email || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function calendarDayUtc(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function toPublicReward(reward: GiftTreeRewardDef) {
  return {
    id: reward.id,
    type: reward.type,
    value: reward.value,
    title: reward.title,
    headline: reward.headline,
    description: reward.description,
    entitlement_key: reward.entitlementKey,
    claim_path: reward.claimPath,
  };
}

function isGiftTreeEnabled(): boolean {
  const raw = String(process.env.CHRISTMAS_GIFT_TREE_ENABLED || "true").toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

function isGiftTreeCreditsEnabled(): boolean {
  const raw = String(process.env.CHRISTMAS_GIFT_TREE_CREDITS_ENABLED || "true").toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

function buildClaimIdem(
  userId: string | null,
  guestHash: string | null,
  openSlot = 0,
  day = calendarDayUtc(),
): string {
  const base = userId
    ? `gift_tree:${GIFT_TREE_SEASON_YEAR}:user:${userId}`
    : `gift_tree:${GIFT_TREE_SEASON_YEAR}:guest:${guestHash}`;
  const slot = Number.isFinite(openSlot) ? Math.max(0, Math.floor(openSlot)) : 0;
  if (slot > 0) return `${base}:open:${slot}`;
  return `${base}:day:${day}`;
}

function parseOpenSlot(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
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
    const errObj = data as { message?: string } | null;
    return { data: null, error: errObj?.message || `rest_${res.status}`, status: res.status };
  }
  return { data, error: null, status: res.status };
}

async function supabaseRpc<T>(
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return { data: null, error: "supabase_unconfigured" };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const errObj = data as { message?: string } | null;
    return { data: null, error: errObj?.message || `rpc_${res.status}` };
  }
  return { data, error: null };
}

async function getUserFromAuthHeader(
  req: VercelRequest,
): Promise<{ id: string; email: string | null } | null> {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token === SERVICE_ROLE || token.length < 20) return null;
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; email?: string };
  if (!user?.id) return null;
  return { id: user.id, email: user.email || null };
}

function rewardFromEntitlement(row: EntitlementRow): GiftTreeRewardDef {
  const reward =
    GIFT_TREE_REWARD_CATALOG.find((r) => r.entitlementKey === row.entitlement_key) ||
    findGiftTreeReward(row.entitlement_key);
  if (!reward) {
    // Never substitute a different financial entitlement.
    throw new Error(`unknown_gift_tree_reward:${row.entitlement_key}`);
  }
  return reward;
}

/** Spend/balance identity: authenticated user XOR guest hash (never trust client email for spend). */
function spendIdentity(input: {
  userId: string | null;
  guestHash: string | null;
}): { userId: string | null; guestHash: string | null; email: string | null } {
  if (input.userId) return { userId: input.userId, guestHash: null, email: null };
  if (input.guestHash) return { userId: null, guestHash: input.guestHash, email: null };
  return { userId: null, guestHash: null, email: null };
}

async function findEntitlementByRef(sourceRef: string): Promise<EntitlementRow | null> {
  const { data } = await supabaseRest<EntitlementRow[]>(
    `christmas_reward_entitlements?source=eq.christmas_tree&source_ref=eq.${encodeURIComponent(sourceRef)}&select=id,entitlement_key,user_id,guest_token_hash,source_ref,email_normalized,claimed_email_at,status,expires_at,redeemed_at,created_at&limit=1`,
  );
  return data?.[0] || null;
}

async function findEntitlementById(id: string): Promise<EntitlementRow | null> {
  const { data } = await supabaseRest<EntitlementRow[]>(
    `christmas_reward_entitlements?id=eq.${encodeURIComponent(id)}&source=eq.christmas_tree&select=id,entitlement_key,user_id,guest_token_hash,source_ref,email_normalized,claimed_email_at,status,expires_at,redeemed_at,created_at&limit=1`,
  );
  return data?.[0] || null;
}

async function remainingOpens(input: {
  userId: string | null;
  guestHash: string | null;
  email: string | null;
}): Promise<number> {
  const { data } = await supabaseRpc<number>("christmas_gift_tree_remaining_opens", {
    p_season_year: GIFT_TREE_SEASON_YEAR,
    p_user_id: input.userId,
    p_guest_token_hash: input.guestHash,
    p_email_normalized: input.email,
  });
  return typeof data === "number" ? data : 0;
}

async function consumePaidOpen(input: {
  userId: string | null;
  guestHash: string | null;
  email: string | null;
}): Promise<{ ok: boolean; remaining: number; reason?: string }> {
  const { data, error } = await supabaseRpc<{
    ok?: boolean;
    remaining_opens?: number;
    reason?: string;
  }>("christmas_gift_tree_consume_open", {
    p_season_year: GIFT_TREE_SEASON_YEAR,
    p_user_id: input.userId,
    p_guest_token_hash: input.guestHash,
    p_email_normalized: input.email,
  });
  if (error) return { ok: false, remaining: 0, reason: error };
  if (!data?.ok) return { ok: false, remaining: 0, reason: data?.reason || "no_opens" };
  return { ok: true, remaining: Number(data.remaining_opens || 0) };
}

async function previousRewardId(input: {
  userId: string | null;
  guestHash: string | null;
}): Promise<string | null> {
  const filters: string[] = ["source=eq.christmas_tree", "order=created_at.desc", "limit=8"];
  if (input.userId) filters.push(`user_id=eq.${encodeURIComponent(input.userId)}`);
  else if (input.guestHash) filters.push(`guest_token_hash=eq.${encodeURIComponent(input.guestHash)}`);
  else return null;
  const { data } = await supabaseRest<EntitlementRow[]>(
    `christmas_reward_entitlements?${filters.join("&")}&select=entitlement_key,created_at`,
  );
  const today = calendarDayUtc();
  const older = (data || []).find((row) => String(row.created_at || "").slice(0, 10) !== today);
  if (!older) return null;
  return rewardFromEntitlement(older).id;
}

async function grantCredits(
  user: { id: string; email: string },
  value: number,
  entitlementId: string,
): Promise<{ granted: number; already: boolean }> {
  const credits = Math.min(Math.max(value, 0), 100);
  if (credits <= 0) return { granted: 0, already: false };
  const note = `christmas_gift_tree:${GIFT_TREE_SEASON_YEAR}:${entitlementId}`;
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

async function sendGiftClaimEmail(input: {
  email: string;
  reward: GiftTreeRewardDef;
  claimId: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(
    process.env.CHRISTMAS_EMAIL_FROM ||
      process.env.TRANSACTIONAL_EMAIL_FROM ||
      process.env.PET_EMAIL_FROM ||
      "",
  ).trim();
  if (!apiKey || !from) return { sent: false, reason: "unconfigured" };

  const openUrl = `${SITE_ORIGIN}/account/gifts?claim=${encodeURIComponent(input.claimId)}`;
  const giftsUrl = `${SITE_ORIGIN}/account/gifts`;
  const safeTitle = input.reward.title.replace(/[<>&]/g, "");
  const html = `<!doctype html><html><body style="font-family:Georgia,serif;background:#2a0d12;color:#F7F0E4;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#4a121c;border-radius:18px;padding:28px">
    <h1 style="font-size:28px;margin:0 0 12px">Your Christmas gift is here</h1>
    <p style="line-height:1.6;opacity:.92">You opened a Christmas gift from The Digital Gifter.</p>
    <p style="line-height:1.6;opacity:.92"><strong>You received:</strong> ${safeTitle}</p>
    <p style="margin:24px 0"><a href="${openUrl}" style="display:inline-block;background:#1B4332;color:#F7F0E4;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600">Open My Gift</a></p>
    <p style="margin:0 0 8px"><a href="${giftsUrl}" style="color:#E8C97A">View My Gifts</a></p>
    <p style="font-size:12px;opacity:.55;margin-top:24px">Your free gift is already yours.</p>
  </div></body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: "Your Christmas gift is here",
      html,
    }),
  });
  if (!res.ok) return { sent: false, reason: `resend_${res.status}` };
  return { sent: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const host = typeof req.headers.host === "string" ? req.headers.host : undefined;
  if (!isOriginAllowed(origin, host)) return res.status(403).json({ error: "Origin not allowed" });
  if (!isGiftTreeEnabled()) return res.status(403).json({ error: "gift_tree_disabled" });
  if (!SUPABASE_URL || !SERVICE_ROLE) return res.status(503).json({ error: "supabase_unconfigured" });

  try {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const action = String(body.action || "").trim();
    const user = await getUserFromAuthHeader(req);
    const guestToken = String(body.guest_token || "").trim();
    const guestHash = guestToken.length >= 32 ? sha256Hex(guestToken) : null;
    if (!user?.id && !guestHash) return res.status(400).json({ error: "identity_required" });

    if (action === "getGiftTreeStatus") {
      const email = normalizeEmail(user?.email || body.email);
      const remaining = await remainingOpens(spendIdentity({ userId: user?.id || null, guestHash }));
      const freeExisting = await findEntitlementByRef(buildClaimIdem(user?.id || null, guestHash, 0));
      return res.status(200).json({
        ok: true,
        remaining_opens: remaining,
        free_claimed_today: Boolean(freeExisting),
        free_claim_id: freeExisting?.id || null,
        free_reward: freeExisting ? toPublicReward(rewardFromEntitlement(freeExisting)) : null,
        authenticated: Boolean(user?.id),
        packs: GIFT_TREE_PAID_OFFERS.map((o) => ({
          package_key: o.packageKey,
          label: o.label,
          price_cents: o.priceCents,
          opens_granted: o.opensGranted,
        })),
      });
    }

    if (action === "listMyGifts") {
      if (!user?.id) return res.status(401).json({ error: "auth_required" });
      const { data } = await supabaseRest<EntitlementRow[]>(
        `christmas_reward_entitlements?source=eq.christmas_tree&user_id=eq.${encodeURIComponent(user.id)}&select=id,entitlement_key,source_ref,email_normalized,claimed_email_at,status,expires_at,redeemed_at,created_at&order=created_at.desc&limit=100`,
      );
      const gifts = (data || []).flatMap((row) => {
        let reward;
        try {
          reward = rewardFromEntitlement(row);
        } catch {
          console.error(JSON.stringify({
            action: "listMyGifts",
            error: "unknown_reward_entitlement",
            entitlement_id: row.id,
            entitlement_key: row.entitlement_key,
          }));
          return [{
            id: row.id,
            reward: null,
            status: "unavailable",
            claimed_email_at: row.claimed_email_at || null,
            expires_at: row.expires_at || null,
            redeemed_at: row.redeemed_at || null,
            created_at: row.created_at || null,
            claim_path: "/account/gifts",
            error: "unknown_reward_entitlement",
          }];
        }
        const expired = row.expires_at ? new Date(row.expires_at).getTime() < Date.now() : false;
        let status = row.status || "available";
        if (row.redeemed_at) status = "redeemed";
        else if (expired) status = "expired";
        else if (reward.type === "credits" && status === "available") status = "credits_added";
        return [{
          id: row.id,
          reward: toPublicReward(reward),
          status,
          claimed_email_at: row.claimed_email_at || null,
          expires_at: row.expires_at || null,
          redeemed_at: row.redeemed_at || null,
          created_at: row.created_at || null,
          claim_path: reward.claimPath,
        }];
      });
      return res.status(200).json({ ok: true, gifts });
    }

    if (action === "openGiftTree") {
      const openSlot = parseOpenSlot(body.open_slot);
      const email = normalizeEmail(user?.email || body.email);
      const spend = spendIdentity({ userId: user?.id || null, guestHash });
      let remaining = await remainingOpens(spend);

      const idem = buildClaimIdem(user?.id || null, guestHash, openSlot);
      let existing = await findEntitlementByRef(idem);

      // Guest free gift → login same day: return the same entitlement (no second free roll).
      if (!existing && openSlot === 0 && user?.id && guestHash) {
        const guestIdem = buildClaimIdem(null, guestHash, 0);
        const guestExisting = await findEntitlementByRef(guestIdem);
        if (guestExisting) {
          if (!guestExisting.user_id) {
            await supabaseRest(`christmas_reward_entitlements?id=eq.${encodeURIComponent(guestExisting.id)}`, {
              method: "PATCH",
              body: JSON.stringify({ user_id: user.id, email_normalized: email || guestExisting.email_normalized }),
            });
            guestExisting.user_id = user.id;
          }
          existing = guestExisting;
        }
      }

      // Email already claimed a free gift today (another browser/session).
      if (!existing && openSlot === 0 && email) {
        const day = calendarDayUtc();
        const { data: byEmail } = await supabaseRest<EntitlementRow[]>(
          `christmas_reward_entitlements?source=eq.christmas_tree&email_normalized=eq.${encodeURIComponent(email)}&source_ref=like.*${encodeURIComponent(":day:" + day)}&select=id,entitlement_key,user_id,guest_token_hash,source_ref,email_normalized,claimed_email_at,status,expires_at,redeemed_at,created_at&limit=1`,
        );
        if (byEmail?.[0]) existing = byEmail[0];
      }

      if (existing) {
        let reward;
        try {
          reward = rewardFromEntitlement(existing);
        } catch {
          return res.status(409).json({
            error: "unknown_reward_entitlement",
            claim_id: existing.id,
            entitlement_key: existing.entitlement_key,
          });
        }
        return res.status(200).json({
          ok: true,
          already: true,
          claim_id: existing.id,
          reward_id: reward.id,
          reward: toPublicReward(reward),
          credits_granted: 0,
          requires_auth_for_credits: reward.type === "credits" && !user?.id,
          open_slot: openSlot,
          remaining_opens: remaining,
          email_claimed: Boolean(existing.email_normalized || existing.claimed_email_at),
        });
      }

      if (openSlot > 0) {
        const consumed = await consumePaidOpen(spend);
        if (!consumed.ok) {
          return res.status(402).json({ error: "no_gift_opens_remaining", remaining_opens: remaining });
        }
        remaining = consumed.remaining;
      }


      const prevId = await previousRewardId({ userId: user?.id || null, guestHash });
      const picked = pickEligibleGiftTreeReward(GIFT_TREE_REWARD_CATALOG, { previousRewardId: prevId });

      const insert = await supabaseRest<EntitlementRow[]>("christmas_reward_entitlements", {
        method: "POST",
        prefer: "return=representation",
        body: JSON.stringify({
          user_id: user?.id || null,
          guest_token_hash: user?.id ? null : guestHash,
          entitlement_key: picked.entitlementKey,
          source: "christmas_tree",
          source_ref: idem,
          status: "available",
          claim_campaign: "christmas_gift_tree_2026",
          email_normalized: email,
          metadata: {
            present_id: String(body.present_id || "") || null,
            open_slot: openSlot,
            reward_id: picked.id,
          },
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
            reward: toPublicReward(reward),
            credits_granted: 0,
            requires_auth_for_credits: reward.type === "credits" && !user?.id,
            open_slot: openSlot,
            remaining_opens: remaining,
          });
        }
        throw new Error(insert.error);
      }

      const claim = insert.data?.[0];
      let creditsGranted = 0;
      if (picked.type === "credits" && user?.id && user.email && isGiftTreeCreditsEnabled() && claim?.id) {
        const result = await grantCredits({ id: user.id, email: user.email }, picked.value, claim.id);
        creditsGranted = result.granted;
        if (creditsGranted > 0) {
          await supabaseRest(`christmas_reward_entitlements?id=eq.${encodeURIComponent(claim.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "credits_added" }),
          });
        }
      }

      if (picked.type === "gift_token" && claim?.id) {
        await supabaseRpc("christmas_gift_tree_grant_opens", {
          p_season_year: GIFT_TREE_SEASON_YEAR,
          p_opens: 1,
          p_source: "reward_token",
          p_source_ref: `gift_token:${claim.id}`,
          p_user_id: user?.id || null,
          p_guest_token_hash: user?.id ? null : guestHash,
          p_email_normalized: email,
          p_metadata: { reward_id: picked.id },
        });
        remaining = await remainingOpens(spendIdentity({ userId: user?.id || null, guestHash }));
      }

      return res.status(200).json({
        ok: true,
        claim_id: claim?.id,
        reward_id: picked.id,
        reward: toPublicReward(picked),
        credits_granted: creditsGranted,
        requires_auth_for_credits: picked.type === "credits" && !user?.id,
        present_id: String(body.present_id || "") || null,
        open_slot: openSlot,
        remaining_opens: remaining,
        email_claimed: Boolean(email),
      });
    }

    if (action === "claimGiftEmail") {
      const claimId = String(body.claim_id || "").trim();
      const email = normalizeEmail(body.email);
      if (!email) return res.status(400).json({ error: "invalid_email" });
      if (!claimId) return res.status(400).json({ error: "claim_id_required" });

      let entitlement = await findEntitlementById(claimId);
      if (!entitlement) {
        entitlement = await findEntitlementByRef(buildClaimIdem(user?.id || null, guestHash, 0));
      }
      if (!entitlement) return res.status(404).json({ error: "claim_not_found" });
      if (
        entitlement.guest_token_hash &&
        guestHash &&
        entitlement.guest_token_hash !== guestHash &&
        !user?.id
      ) {
        return res.status(403).json({ error: "forbidden" });
      }

      const already = Boolean(entitlement.email_normalized && entitlement.claimed_email_at);
      const patch: Record<string, unknown> = {
        email_normalized: email,
        claimed_email_at: entitlement.claimed_email_at || new Date().toISOString(),
        claim_campaign: "christmas_gift_tree_2026",
      };
      if (user?.id && !entitlement.user_id) patch.user_id = user.id;
      await supabaseRest(`christmas_reward_entitlements?id=eq.${encodeURIComponent(entitlement.id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });

      if (guestHash) {
        await supabaseRest(
          `christmas_gift_tree_opens?guest_token_hash=eq.${encodeURIComponent(guestHash)}&season_year=eq.${GIFT_TREE_SEASON_YEAR}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              email_normalized: email,
              ...(user?.id ? { user_id: user.id } : {}),
            }),
          },
        );
      }

      const reward = rewardFromEntitlement(entitlement);
      let creditsGranted = 0;
      if (reward.type === "credits" && isGiftTreeCreditsEnabled() && user?.id && user.email) {
        const result = await grantCredits({ id: user.id, email: user.email }, reward.value, entitlement.id);
        creditsGranted = result.granted;
      }

      let emailSent = false;
      if (!already) {
        try {
          emailSent = (await sendGiftClaimEmail({ email, reward, claimId: entitlement.id })).sent;
        } catch {
          emailSent = false;
        }
      }

      const remaining = await remainingOpens(spendIdentity({ userId: user?.id || null, guestHash }));
      return res.status(200).json({
        ok: true,
        already,
        claim_id: entitlement.id,
        reward_id: reward.id,
        reward: toPublicReward(reward),
        email,
        email_sent: emailSent,
        credits_granted: creditsGranted,
        remaining_opens: remaining,
      });
    }

    if (action === "claimGiftTree") {
      const claimId = String(body.claim_id || "").trim();
      let entitlement: EntitlementRow | null = claimId ? await findEntitlementById(claimId) : null;
      if (!entitlement) {
        entitlement = await findEntitlementByRef(buildClaimIdem(user?.id || null, guestHash));
      }
      if (!entitlement && user?.id && guestHash) {
        entitlement = await findEntitlementByRef(buildClaimIdem(null, guestHash));
        if (entitlement && !entitlement.user_id) {
          await supabaseRest(`christmas_reward_entitlements?id=eq.${encodeURIComponent(entitlement.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ user_id: user.id }),
          });
        }
      }
      if (!entitlement) return res.status(404).json({ error: "claim_not_found" });

      const reward = rewardFromEntitlement(entitlement);
      let creditsGranted = 0;
      if (reward.type === "credits") {
        if (!user?.id || !user.email) return res.status(401).json({ error: "auth_required_for_credits" });
        if (!isGiftTreeCreditsEnabled()) return res.status(403).json({ error: "credits_disabled" });
        const result = await grantCredits({ id: user.id, email: user.email }, reward.value, entitlement.id);
        if (result.already) {
          return res.status(200).json({
            ok: true,
            already: true,
            reward_id: reward.id,
            credits_granted: 0,
            claim_id: entitlement.id,
            reward: toPublicReward(reward),
          });
        }
        creditsGranted = result.granted;
      }

      return res.status(200).json({
        ok: true,
        reward_id: reward.id,
        credits_granted: creditsGranted,
        claim_id: entitlement.id,
        reward: toPublicReward(reward),
      });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("unknown_gift_tree_reward:")) {
      return res.status(409).json({ error: "unknown_reward_entitlement", detail: message });
    }
    console.error(JSON.stringify({ action: "christmas_gift_tree", error: message }));
    return res.status(500).json({ error: "internal_error" });
  }
}
