import postgres from "npm:postgres@3.4.5";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeSignature(rawBody: string, header: string, secret: string): Promise<boolean> {
  const timestamp = header.split(",").map((p) => p.trim()).find((p) => p.startsWith("t="))?.slice(2) || "";
  const signatures = header.split(",").map((p) => p.trim()).filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const ts = Number(timestamp);
  if (!timestamp || !signatures.length || !Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const digest = toHex(signed);
  return signatures.some((signature) => signature.length === digest.length && signature === digest);
}

function dbUrl(): string {
  const url = Deno.env.get("STRIPE_TEST_DATABASE_URL") || "";
  if (!url.includes("/tdg_christmas_test")) throw new Error("test database is not isolated");
  return url;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const token = url.searchParams.get("token") || "";
    if (!token) return json({ error: "token required" }, 400);
    const sql = postgres(dbUrl(), { max: 1 });
    try {
      const rows = await sql<{ result_bytes: Uint8Array | null; result_type: string | null }[]>`
        select result_bytes, result_type from orders where result_token = ${token} limit 1
      `;
      const row = rows[0];
      if (!row?.result_bytes) return json({ error: "not found" }, 404);
      return new Response(row.result_bytes, {
        headers: { "content-type": row.result_type || "image/jpeg", "cache-control": "private, no-store" },
      });
    } finally {
      await sql.end();
    }
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const gate = Deno.env.get("TDG_TEST_GATE") || "";
  const presented = req.headers.get("x-tdg-test-gate") || "";
  if (presented && gate && presented === gate) {
    const sql = postgres(dbUrl(), { max: 1 });
    try {
      const body = await req.json();
      if (body.action === "create_order") {
        const id = crypto.randomUUID();
        const email = String(body.email || "").trim();
        const amount = Number(body.amount_cents || 0);
        if (!email || !Number.isInteger(amount) || amount < 100) return json({ error: "invalid order" }, 400);
        await sql`insert into orders (id, email, payment_status, amount_cents) values (${id}, ${email}, 'pending', ${amount})`;
        return json({ ok: true, order_id: id });
      }
      if (body.action === "upload") {
        const bytes = Uint8Array.from(atob(String(body.image_base64 || "")), (c) => c.charCodeAt(0));
        if (!bytes.length) return json({ error: "image required" }, 400);
        const updated = await sql`
          update orders set source_bytes = ${bytes}, source_type = ${String(body.content_type || "image/jpeg")}
          where id = ${String(body.order_id)} and payment_status = 'pending'
          returning id
        `;
        if (!updated.length) return json({ error: "order not uploadable" }, 404);
        return json({ ok: true, bytes: bytes.length });
      }
      if (body.action === "generate") {
        const orderId = String(body.order_id || "");
        const rows = await sql<{
          id: string;
          email: string;
          payment_status: string;
          source_bytes: Uint8Array | null;
          source_type: string | null;
          result_bytes: Uint8Array | null;
          result_token: string | null;
          provider_request_id: string | null;
        }[]>`
          select id, email, payment_status, source_bytes, source_type, result_bytes, result_token, provider_request_id
          from orders where id = ${orderId}
        `;
        const order = rows[0];
        if (!order) return json({ error: "order not found" }, 404);
        if (!["paid", "partially_refunded"].includes(order.payment_status)) {
          return json({ error: "payment_required", code: "payment_required" }, 402);
        }
        if (order.result_bytes && order.result_token) {
          return json({
            ok: true,
            status: "already_complete",
            bytes: order.result_bytes.length,
            regenerated: false,
          });
        }
        const source = order.source_bytes;
        if (!source || source.length < 50) return json({ error: "missing source photo" }, 400);
        const { uploadBytesToHiggsfield } = await import("../_shared/higgsfieldClient.ts");
        const { readHiggsfieldAuthorization } = await import("../_shared/higgsfieldImage.ts");
        const { generateChristmasHiggsfieldImage } = await import("../_shared/christmas/higgsfield.ts");
        if (!readHiggsfieldAuthorization(Deno.env)) {
          return json({ error: "Higgsfield credentials are not configured", code: "generation_unconfigured" }, 503);
        }
        const sourceUrl = await uploadBytesToHiggsfield(
          readHiggsfieldAuthorization(Deno.env) || "",
          source,
          order.source_type || "image/jpeg",
        );
        const generated = await generateChristmasHiggsfieldImage(
          Deno.env,
          "Photoreal Christmas portrait of the person in the customer photo. Keep their face, age, hair, and identity recognizable. Place them in a warm Christmas scene with soft lights. No text, watermark, or extra people.",
          sourceUrl,
          "https://www.thedigitalgifter.com/assets/funnel/christmas-after.png",
          {
            requestId: order.provider_request_id,
            onSubmitted: async (id) => {
              await sql`update orders set provider_request_id = ${id} where id = ${orderId}`;
            },
          },
        );
        const img = await fetch(generated.outputUrl);
        if (!img.ok) return json({ error: "result_download_failed" }, 502);
        const bytes = new Uint8Array(await img.arrayBuffer());
        const jpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
        const png = bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50;
        if ((!jpeg && !png) || bytes.length < 8000 || bytes.length === source.length) {
          return json({ error: "result_not_a_real_image", bytes: bytes.length }, 502);
        }
        const token = order.result_token || crypto.randomUUID();
        await sql`
          update orders
          set result_bytes = ${bytes},
              result_type = ${jpeg ? "image/jpeg" : "image/png"},
              result_token = ${token},
              provider_request_id = ${generated.predictionId},
              fulfillment_status = 'completed'
          where id = ${orderId}
        `;
        const existing = await sql`select provider_id from email_deliveries where order_id = ${orderId} and kind = 'portrait_ready'`;
        if (existing.length) {
          return json({ ok: true, status: "completed", bytes: bytes.length, email: "already_sent", regenerated: false });
        }
        const apiKey = Deno.env.get("RESEND_API_KEY") || "";
        const from = Deno.env.get("CHRISTMAS_EMAIL_FROM") || "";
        const link = `https://supabase.thedigitalgifter.com/functions/v1/stripe-webhook-test?token=${encodeURIComponent(token)}`;
        const sent = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `xmas-portrait-ready/${orderId}`,
          },
          body: JSON.stringify({
            from,
            to: [order.email],
            subject: "Your Christmas portrait is ready",
            html: `<p>Your personalized Christmas portrait is ready.</p><p><a href="${link}">Open your result</a></p><p>- The Digital Gifter</p>`,
          }),
        });
        const payload = await sent.json().catch(() => ({})) as { id?: string };
        await sql`
          insert into email_deliveries (order_id, kind, provider_id, status)
          values (${orderId}, 'portrait_ready', ${String(payload.id || "")}, ${sent.ok ? "sent" : "failed"})
        `;
        return json({
          ok: sent.ok,
          status: "completed",
          bytes: bytes.length,
          email: sent.ok ? "accepted" : "failed",
          provider_id: payload.id || null,
          regenerated: true,
        });
      }
      return json({ error: "unknown action" }, 400);
    } finally {
      await sql.end();
    }
  }

  const secret = Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET") || "";
  if (!secret) return json({ error: "STRIPE_TEST_WEBHOOK_SECRET is not configured" }, 503);
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") || "";
  if (!await verifyStripeSignature(rawBody, signature, secret)) return json({ error: "Invalid Stripe signature" }, 400);
  const event = JSON.parse(rawBody) as { id?: string; type?: string; livemode?: boolean; data?: { object?: Record<string, unknown> } };
  if (event.livemode === true) return json({ error: "live event refused", code: "isolation" }, 403);
  const eventId = String(event.id || "");
  const eventType = String(event.type || "");
  if (!eventId) return json({ error: "Missing event id" }, 400);
  const earlyObj = (event.data?.object || {}) as Record<string, unknown>;
  const earlyMeta = (earlyObj.metadata || {}) as Record<string, unknown>;
  if (String(earlyMeta.isolation || "") === "tdg_e2e") {
    const orderId = String(earlyMeta.christmas_order_id || "").trim();
    const sessionId = String(earlyObj.id || "");
    if (!orderId) return json({ error: "christmas_order_id required" }, 400);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      return json({ ok: true, status: "ignored", reason: "invalid_order_id" });
    }
    if (eventType.startsWith("checkout.session") && !sessionId.startsWith("cs_test_")) {
      return json({ error: "test session required", code: "isolation" }, 403);
    }
    const { getServiceClient } = await import("../_shared/supabase.ts");
    const { handleChristmasStripeEvent } = await import("../_shared/christmas/stripeFulfill.ts");
    const service = getServiceClient();
    const { data: existingEvent } = await service
      .from("processed_stripe_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();
    if (existingEvent) return json({ ok: true, status: "already_processed", event_id: eventId });
    const { data: order, error: orderError } = await service
      .from("christmas_orders")
      .select("id,metadata,stripe_checkout_session_id")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) return json({ error: "order_lookup_failed" }, 500);
    const orderMeta = (order?.metadata || {}) as Record<string, unknown>;
    if (!order || String(orderMeta.isolation || "") !== "tdg_e2e") {
      return json({ error: "isolation_mismatch", code: "isolation" }, 403);
    }
    if (
      eventType.startsWith("checkout.session") &&
      order.stripe_checkout_session_id &&
      String(order.stripe_checkout_session_id) !== sessionId
    ) {
      return json({ error: "session_mismatch", code: "isolation" }, 403);
    }
    const response = await handleChristmasStripeEvent({
      service,
      eventId,
      eventType,
      obj: earlyObj,
      metadata: earlyMeta,
    });
    return response || json({ ok: true, status: "ignored_production" });
  }
  const sql = postgres(dbUrl(), { max: 1 });
  try {
    const seen = await sql`select event_id from processed_events where event_id = ${eventId}`;
    if (seen.length) return json({ ok: true, status: "already_processed", event_id: eventId });
    const obj = event.data?.object || {};
    const metadata = (obj.metadata || {}) as Record<string, unknown>;
    if (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") {
      const orderId = String(metadata.order_id || "");
      const purpose = String(metadata.purpose || "");
      if (purpose !== "tdg_christmas_test" || !orderId) {
        await sql`insert into processed_events (event_id, event_type, result) values (${eventId}, ${eventType}, ${sql.json({ status: "ignored" })})`;
        return json({ ok: true, status: "ignored" });
      }
      const updated = await sql`
        update orders
        set payment_status = 'paid',
            stripe_session_id = ${String(obj.id || "")},
            stripe_payment_intent = ${String(obj.payment_intent || "")},
            amount_cents = ${Number(obj.amount_total || 0)}
        where id = ${orderId} and payment_status in ('pending', 'paid')
        returning id
      `;
      await sql`insert into processed_events (event_id, event_type, result) values (${eventId}, ${eventType}, ${sql.json({ status: updated.length ? "paid" : "missing_order" })})`;
      return json({ ok: true, status: updated.length ? "paid" : "missing_order" });
    }
    if (eventType === "charge.refunded") {
      const paymentIntent = String(obj.payment_intent || "");
      const refunded = Number(obj.amount_refunded || 0);
      const updated = await sql`
        update orders
        set refunded_amount_cents = ${refunded},
            payment_status = case
              when ${refunded} >= amount_cents then 'refunded'
              when ${refunded} > 0 then 'partially_refunded'
              else payment_status
            end
        where stripe_payment_intent = ${paymentIntent}
        returning id, payment_status, refunded_amount_cents
      `;
      await sql`insert into processed_events (event_id, event_type, result) values (${eventId}, ${eventType}, ${sql.json({ status: "refunded", rows: updated.length })})`;
      return json({ ok: true, status: "refund_applied", rows: updated.length });
    }
    await sql`insert into processed_events (event_id, event_type, result) values (${eventId}, ${eventType}, ${sql.json({ status: "ignored" })})`;
    return json({ ok: true, status: "ignored", type: eventType });
  } finally {
    await sql.end();
  }
});
