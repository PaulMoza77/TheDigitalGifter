import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { assertAdmin, getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import {
  generateOpaqueToken,
  sanitizeText,
  sha256Hex,
  asString,
} from "../_shared/christmas/treeAdvent.ts";
import {
  generateChristmasMessages,
  validateMessageInput,
  type MessageInput,
} from "../_shared/christmas/messageGenerator.ts";
import { CARD_LAYOUT_KEYS, CARD_STYLE_KEYS } from "../_shared/christmas/cardStyles.ts";

type Body = Record<string, unknown>;
type Service = ReturnType<typeof getServiceClient>;

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = asString(body.action);
    const service = getServiceClient();
    const { user } = await getAuthUser(req);
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (action === "runMessageGenerator" || action === "generateMessages") {
      let guestToken = asString(body.guest_token);
      let mintedGuest: string | null = null;
      if (!user?.id && !guestToken) {
        mintedGuest = generateOpaqueToken();
        guestToken = mintedGuest;
      }
      const guestHash = guestToken ? await sha256Hex(guestToken) : null;
      const rateBucket = user?.id ? `user:${user.id}` : `guest:${guestHash || (await sha256Hex(clientIp))}`;

      const forceNew = body.force_new === true;
      const sessionIdExisting = asString(body.session_id);

      if (!forceNew && sessionIdExisting) {
        const existing = await loadMessageSession(service, sessionIdExisting, user?.id, guestHash);
        if (existing?.status === "completed") {
          const { data: results } = await service
            .from("christmas_message_results")
            .select("id,result_key,message_text,tone_key,length_key,recipient_key,language")
            .eq("session_id", existing.id)
            .order("sort_order", { ascending: true });
          return jsonResponse({
            ok: true,
            session_id: existing.id,
            guest_token: user?.id ? null : guestToken,
            messages: (results || []).map(mapResult),
            provider: existing.provider,
            model: existing.model,
            latency_ms: existing.latency_ms,
            used_fallback: existing.used_fallback,
            reused: true,
          });
        }
      }

      const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
      const { count } = await service
        .from("christmas_message_sessions")
        .select("id", { count: "exact", head: true })
        .eq("rate_bucket", rateBucket)
        .gte("created_at", since);
      if ((count || 0) >= RATE_MAX) {
        return jsonResponse({ error: "rate_limited", retry_after_seconds: 3600 }, 429);
      }

      const input: MessageInput = {
        locale: asString(body.locale) === "ro" || asString(body.language) === "ro" ? "ro" : "en",
        recipientKey: asString(body.recipient_key),
        toneKey: asString(body.tone_key),
        lengthKey: asString(body.length_key),
        relationshipKey: asString(body.relationship_key) || null,
        customDetail: asString(body.custom_detail),
      };
      const validated = validateMessageInput(input);
      if (!validated.ok) return jsonResponse({ error: validated.error }, 400);

      let generation;
      try {
        generation = await generateChristmasMessages(validated.value);
      } catch (err) {
        const code = err instanceof Error ? err.message : "generate_failed";
        await service.from("christmas_message_sessions").insert({
          user_id: user?.id || null,
          guest_token_hash: user?.id ? null : guestHash,
          locale: validated.value.locale,
          recipient_key: validated.value.recipientKey,
          tone_key: validated.value.toneKey,
          length_key: validated.value.lengthKey,
          relationship_key: validated.value.relationshipKey || null,
          custom_detail_len: String(validated.value.customDetail || "").length,
          status: "failed",
          error_code: code.slice(0, 80),
          rate_bucket: rateBucket,
          attempt: forceNew ? 2 : 1,
        });
        return jsonResponse({ error: code }, 400);
      }

      const { data: session, error: sErr } = await service
        .from("christmas_message_sessions")
        .insert({
          user_id: user?.id || null,
          guest_token_hash: user?.id ? null : guestHash,
          locale: validated.value.locale,
          recipient_key: validated.value.recipientKey,
          tone_key: validated.value.toneKey,
          length_key: validated.value.lengthKey,
          relationship_key: validated.value.relationshipKey || null,
          custom_detail_len: String(validated.value.customDetail || "").length,
          attempt: forceNew ? 2 : 1,
          status: "completed",
          provider: generation.provider,
          model: generation.model,
          latency_ms: generation.latencyMs,
          input_tokens: generation.inputTokens,
          output_tokens: generation.outputTokens,
          cost_usd: generation.costUsd,
          cost_state: generation.costState,
          used_fallback: generation.usedFallback,
          rate_bucket: rateBucket,
        })
        .select("id")
        .single();
      if (sErr) throw sErr;

      const rows = generation.messages.map((m, i) => ({
        session_id: session.id,
        sort_order: i,
        result_key: m.result_key,
        message_text: m.text,
        tone_key: m.tone_key,
        length_key: m.length_key,
        recipient_key: m.recipient_key,
        language: m.language,
      }));
      const { data: inserted, error: rErr } = await service
        .from("christmas_message_results")
        .insert(rows)
        .select("id,result_key,message_text,tone_key,length_key,recipient_key,language");
      if (rErr) throw rErr;

      try {
        await service.from("ai_cost_ledger").insert({
          prediction_id: `christmas_message_generator:${session.id}`,
          product_family: "christmas_message_generator",
          product_sku: "christmas_message_generator",
          media_type: "text",
          provider: generation.provider,
          model: generation.model,
          input_tokens: generation.inputTokens,
          output_tokens: generation.outputTokens,
          cost_usd: generation.costUsd ?? 0,
          cost_state:
            generation.costState === "estimated"
              ? "estimated"
              : generation.costState === "none"
                ? "exact"
                : "estimated",
          is_mock: generation.usedFallback,
          cost_notes: "christmas_message_generator",
          latency_ms: generation.latencyMs,
        });
      } catch {
        /* non-fatal */
      }

      return jsonResponse({
        ok: true,
        session_id: session.id,
        guest_token: user?.id ? null : guestToken,
        messages: (inserted || []).map(mapResult),
        provider: generation.provider,
        model: generation.model,
        latency_ms: generation.latencyMs,
        used_fallback: generation.usedFallback,
        cost_usd: generation.costUsd,
        cost_state: generation.costState,
        reused: false,
      });
    }

    if (action === "getMessageSession") {
      const guestToken = asString(body.guest_token);
      const guestHash = guestToken ? await sha256Hex(guestToken) : null;
      const session = await loadMessageSession(service, asString(body.session_id), user?.id, guestHash);
      if (!session) return jsonResponse({ error: "not_found" }, 404);
      const { data: results } = await service
        .from("christmas_message_results")
        .select("id,result_key,message_text,tone_key,length_key,recipient_key,language")
        .eq("session_id", session.id)
        .order("sort_order", { ascending: true });
      return jsonResponse({
        ok: true,
        session_id: session.id,
        messages: (results || []).map(mapResult),
        provider: session.provider,
        model: session.model,
        used_fallback: session.used_fallback,
      });
    }

    if (action === "getMessageResult") {
      const guestToken = asString(body.guest_token);
      const guestHash = guestToken ? await sha256Hex(guestToken) : null;
      const resultId = asString(body.result_id);
      const { data: result } = await service
        .from("christmas_message_results")
        .select("id,result_key,message_text,tone_key,length_key,recipient_key,language,session_id")
        .eq("id", resultId)
        .maybeSingle();
      if (!result) return jsonResponse({ error: "not_found" }, 404);
      const session = await loadMessageSession(service, result.session_id, user?.id, guestHash);
      if (!session) return jsonResponse({ error: "forbidden" }, 403);
      return jsonResponse({ ok: true, message: mapResult(result) });
    }

    if (action === "adminMessageStats") {
      await assertAdmin(user?.email);
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: sessions } = await service
        .from("christmas_message_sessions")
        .select("status,provider,model,locale,recipient_key,tone_key,latency_ms,cost_usd,used_fallback")
        .gte("created_at", since);
      const rows = sessions || [];
      return jsonResponse({
        ok: true,
        window_days: 7,
        sessions: rows.length,
        completed: rows.filter((r) => r.status === "completed").length,
        failed: rows.filter((r) => r.status === "failed").length,
        fallback_used: rows.filter((r) => r.used_fallback).length,
        avg_latency_ms: avg(rows.map((r) => r.latency_ms).filter((n): n is number => n != null)),
        estimated_cost_usd: sum(rows.map((r) => Number(r.cost_usd) || 0)),
        top_recipients: topCounts(rows.map((r) => r.recipient_key)),
        top_tones: topCounts(rows.map((r) => r.tone_key)),
        languages: topCounts(rows.map((r) => r.locale)),
      });
    }

    if (action === "createCardProject") {
      const ownerToken = user?.id ? null : generateOpaqueToken();
      const ownerHash = ownerToken ? await sha256Hex(ownerToken) : null;
      const styleKey = asString(body.style_key) || "classic_christmas";
      const layoutKey = asString(body.layout_key) || "square";
      if (!CARD_STYLE_KEYS.has(styleKey as never)) return jsonResponse({ error: "invalid_style" }, 400);
      if (!CARD_LAYOUT_KEYS.has(layoutKey as never)) return jsonResponse({ error: "invalid_layout" }, 400);
      const { data, error } = await service
        .from("christmas_card_projects")
        .insert({
          user_id: user?.id || null,
          owner_token_hash: ownerHash,
          locale: asString(body.locale) === "ro" ? "ro" : "en",
          style_key: styleKey,
          layout_key: layoutKey,
          message_text: sanitizeText(body.message_text ?? body.message, 800),
          message_source:
            asString(body.message_source) === "message_generator" ? "message_generator" : "manual",
          message_result_id: asString(body.message_result_id) || null,
          recipient_name: sanitizeText(body.recipient_name, 80),
          from_name: sanitizeText(body.from_name, 80),
          photo_present: body.photo_present === true,
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw error;
      return jsonResponse({ ok: true, project_id: data.id, owner_token: ownerToken });
    }

    if (action === "updateCardProject") {
      const project = await loadOwnerCard(service, body, user?.id);
      if (!project) return jsonResponse({ error: "not_found" }, 404);
      const patch: Record<string, unknown> = {};
      if (body.style_key != null) {
        const sk = asString(body.style_key);
        if (!CARD_STYLE_KEYS.has(sk as never)) return jsonResponse({ error: "invalid_style" }, 400);
        patch.style_key = sk;
      }
      if (body.layout_key != null) {
        const lk = asString(body.layout_key);
        if (!CARD_LAYOUT_KEYS.has(lk as never)) return jsonResponse({ error: "invalid_layout" }, 400);
        patch.layout_key = lk;
      }
      if (body.message_text != null || body.message != null) {
        patch.message_text = sanitizeText(body.message_text ?? body.message, 800);
      }
      if (body.recipient_name != null) patch.recipient_name = sanitizeText(body.recipient_name, 80);
      if (body.from_name != null) patch.from_name = sanitizeText(body.from_name, 80);
      if (body.photo_present != null) patch.photo_present = body.photo_present === true;
      if (body.message_source != null) {
        patch.message_source =
          asString(body.message_source) === "message_generator" ? "message_generator" : "manual";
      }
      if (body.message_result_id != null) patch.message_result_id = asString(body.message_result_id) || null;
      const { error } = await service.from("christmas_card_projects").update(patch).eq("id", project.id);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === "getOwnerCard" || action === "getCardProject") {
      const project = await loadOwnerCard(service, body, user?.id);
      if (!project) return jsonResponse({ error: "not_found" }, 404);
      return jsonResponse({
        ok: true,
        project: {
          id: project.id,
          locale: project.locale,
          style_key: project.style_key,
          layout_key: project.layout_key,
          message_text: project.message_text,
          message_source: project.message_source,
          recipient_name: project.recipient_name,
          from_name: project.from_name,
          photo_present: project.photo_present,
          status: project.status,
          download_count: project.download_count,
          share_count: project.share_count,
          render_count: project.render_count,
        },
      });
    }

    if (action === "recordCardRender") {
      const project = await loadOwnerCard(service, body, user?.id);
      if (!project) return jsonResponse({ error: "not_found" }, 404);
      const layoutKey = asString(body.layout_key) || project.layout_key;
      const width = Number(body.width || body.width_px || 0);
      const height = Number(body.height || body.height_px || 0);
      const byteSize = Number(body.byte_size || 0);
      if (body.failed === true) {
        await service
          .from("christmas_card_projects")
          .update({
            render_failure_count: (project.render_failure_count || 0) + 1,
            status: "failed",
            last_error: sanitizeText(body.error_code ?? body.error, 120) || "render_failed",
          })
          .eq("id", project.id);
        return jsonResponse({ ok: true, failed: true });
      }
      if (width <= 0 || height <= 0) return jsonResponse({ error: "invalid_dimensions" }, 400);
      await service.from("christmas_card_assets").insert({
        project_id: project.id,
        asset_kind: "rendered",
        layout_key: layoutKey,
        mime_type: asString(body.content_type) || "image/png",
        width,
        height,
        byte_size: byteSize || null,
      });
      await service
        .from("christmas_card_projects")
        .update({
          render_count: (project.render_count || 0) + 1,
          status: "rendered",
          layout_key: layoutKey,
          last_error: null,
        })
        .eq("id", project.id);
      return jsonResponse({ ok: true, render_cost_usd: 0 });
    }

    if (action === "recordCardDownload" || action === "trackCardDownload") {
      const project = await loadOwnerCard(service, body, user?.id);
      if (!project) return jsonResponse({ error: "not_found" }, 404);
      await service
        .from("christmas_card_projects")
        .update({ download_count: (project.download_count || 0) + 1 })
        .eq("id", project.id);
      return jsonResponse({ ok: true });
    }

    if (action === "recordCardShare" || action === "trackCardShare") {
      const project = await loadOwnerCard(service, body, user?.id);
      if (!project) return jsonResponse({ error: "not_found" }, 404);
      await service
        .from("christmas_card_projects")
        .update({ share_count: (project.share_count || 0) + 1 })
        .eq("id", project.id);
      return jsonResponse({ ok: true });
    }

    if (action === "adminCardStats") {
      await assertAdmin(user?.email);
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: projects } = await service
        .from("christmas_card_projects")
        .select(
          "id,style_key,layout_key,status,download_count,share_count,render_count,render_failure_count,photo_present,created_at,user_id",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = projects || [];
      return jsonResponse({
        ok: true,
        window_days: 7,
        projects: rows.length,
        renders: sum(rows.map((r) => r.render_count || 0)),
        downloads: sum(rows.map((r) => r.download_count || 0)),
        shares: sum(rows.map((r) => r.share_count || 0)),
        render_failures: sum(rows.map((r) => r.render_failure_count || 0)),
        with_photo: rows.filter((r) => r.photo_present).length,
        styles: topCounts(rows.map((r) => r.style_key)),
        layouts: topCounts(rows.map((r) => r.layout_key)),
        recent: rows.map((r) => ({
          id: r.id,
          account: r.user_id ? "account" : "guest",
          style_key: r.style_key,
          layout_key: r.layout_key,
          status: r.status,
          downloads: r.download_count,
          shares: r.share_count,
          photo_present: r.photo_present,
          created_at: r.created_at,
        })),
      });
    }

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("christmas-cards-messages-funnel", message);
    return jsonResponse({ error: message }, 500);
  }
});

function mapResult(r: Record<string, unknown>) {
  return {
    id: r.id,
    result_key: r.result_key,
    text: r.message_text,
    tone_key: r.tone_key,
    length_key: r.length_key,
    recipient_key: r.recipient_key,
    language: r.language,
    // legacy aliases
    tone: r.tone_key,
    length: r.length_key,
    recipient_category: r.recipient_key,
  };
}

async function loadMessageSession(
  service: Service,
  sessionId: string,
  userId: string | undefined,
  guestHash: string | null,
) {
  if (!sessionId) return null;
  const { data } = await service.from("christmas_message_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!data) return null;
  if (userId && data.user_id === userId) return data;
  if (guestHash && data.guest_token_hash === guestHash) return data;
  return null;
}

async function loadOwnerCard(service: Service, body: Body, userId: string | undefined) {
  const projectId = asString(body.project_id);
  if (!projectId) return null;
  const { data } = await service.from("christmas_card_projects").select("*").eq("id", projectId).maybeSingle();
  if (!data) return null;
  if (userId && data.user_id === userId) return data;
  const ownerToken = asString(body.owner_token);
  if (ownerToken && data.owner_token_hash) {
    const hash = await sha256Hex(ownerToken);
    if (hash === data.owner_token_hash) return data;
  }
  return null;
}

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

function topCounts(keys: Array<string | null | undefined>) {
  const map = new Map<string, number>();
  for (const k of keys) {
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => ({ key, count }));
}
