import { alerts } from "./alerts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const env = (key: string) => Deno.env.get(key) || "";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 16000) return json({ error: "too_large" }, 413);
    const b = JSON.parse(raw);
    const db = createClient(
      env("SUPABASE_URL"),
      env("SUPABASE_SERVICE_ROLE_KEY"),
    );
    if (b.action === "drain") {
      if (
        !env("SUPPORT_WORKER_SECRET") ||
        req.headers.get("authorization") !==
          `Bearer ${env("SUPPORT_WORKER_SECRET")}`
      )
        return json({ error: "forbidden" }, 403);
      await alerts(db, env);
      return json({ ok: true });
    }
    const client = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"));
    let data: any, error: any;
    if (b.action === "create") {
      // Existing server-side validation, honeypot and email rate limit.
      ({ data, error } = await client.rpc("create_public_support_ticket", {
        p_email: b.email,
        p_category: "other",
        p_subject: "Apel cu Moșu — suport",
        p_message: b.message,
        p_page_path:
          b.context === "call" ? "/santa/call" : "/christmas/santa-call",
        p_honeypot: b.website || "",
      }));
    } else if (b.action === "load" || b.action === "reply") {
      if (typeof b.reference !== "string" || typeof b.guestToken !== "string")
        return json({ error: "invalid" }, 400);
      if (b.action === "reply") {
        const sent = await client.rpc("reply_public_support_ticket", {
          p_reference: b.reference,
          p_guest_token: b.guestToken,
          p_message: b.message,
        });
        if (sent.error) return json({ error: "message_failed" }, 400);
      }
      ({ data, error } = await client.rpc("load_own_support_ticket", {
        p_reference: b.reference,
        p_guest_token: b.guestToken,
      }));
    } else return json({ error: "invalid_action" }, 400);
    if (error || !data) return json({ error: "support_unavailable" }, 400);
    // The ticket is committed first; email failures cannot discard the conversation.
    if (
      b.action !== "load" &&
      data.reference &&
      data.reference !== "TDG-000000"
    ) {
      const { data: ticket } = await db
        .from("support_tickets")
        .select("id")
        .eq("public_reference", data.reference)
        .single();
      if (ticket) await alerts(db, env, ticket.id).catch(() => {});
    }
    return json(data);
  } catch {
    return json({ error: "support_unavailable" }, 500);
  }
});
