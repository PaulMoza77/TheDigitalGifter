import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import {
  assertAdmin,
  getAuthUser,
  getServiceClient,
  getUserClient,
  readJson,
} from "../_shared/supabase.ts";
import {
  buildAdminReplyEmail,
  buildTicketReceivedEmail,
  isResendConfigured,
  sendSupportResend,
} from "../_shared/support/email.ts";

type Body = {
  action?: string;
  email?: string;
  category?: string;
  subject?: string;
  message?: string;
  petPublicToken?: string;
  pagePath?: string;
  honeypot?: string;
  ticketId?: string;
  reply?: string;
  idempotencyKey?: string;
};

function envMap(): Record<string, string | undefined> {
  return {
    RESEND_API_KEY: Deno.env.get("RESEND_API_KEY"),
    PET_EMAIL_FROM: Deno.env.get("PET_EMAIL_FROM"),
    TRANSACTIONAL_EMAIL_FROM: Deno.env.get("TRANSACTIONAL_EMAIL_FROM"),
    SITE_URL: Deno.env.get("SITE_URL"),
    PUBLIC_APP_URL: Deno.env.get("PUBLIC_APP_URL"),
  };
}

function publicError(status: number, message: string) {
  return jsonResponse({ error: message }, status);
}

async function recordDelivery(input: {
  ticketId: string;
  messageId?: string | null;
  kind: "ticket_received" | "admin_reply";
  idempotencyKey: string;
  status: "queued" | "sent" | "pending" | "failed" | "skipped";
  providerMessageId?: string | null;
  errorCode?: string | null;
}) {
  const service = getServiceClient();
  const { data: existing } = await service
    .from("support_email_deliveries")
    .select("id, status")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();

  const row = {
    ticket_id: input.ticketId,
    message_id: input.messageId || null,
    kind: input.kind,
    status: input.status,
    idempotency_key: input.idempotencyKey,
    provider_message_id: input.providerMessageId || null,
    error_code: input.errorCode || null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    if (existing.status === "sent") return existing;
    const { data, error } = await service
      .from("support_email_deliveries")
      .update(row)
      .eq("id", existing.id)
      .select("id, status")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await service
    .from("support_email_deliveries")
    .insert(row)
    .select("id, status")
    .single();
  if (error) throw error;
  return data;
}

async function deliver(input: {
  ticketId: string;
  messageId?: string | null;
  kind: "ticket_received" | "admin_reply";
  idempotencyKey: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<string> {
  const service = getServiceClient();
  const { data: existing } = await service
    .from("support_email_deliveries")
    .select("status")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();

  if (existing?.status === "sent") return "sent";

  const configured = isResendConfigured(envMap());
  const recipient = String(input.to || "").trim();
  if (!configured || !recipient) {
    await recordDelivery({
      ...input,
      status: "pending",
      errorCode: configured ? "missing_recipient" : "unconfigured",
    });
    return "pending";
  }

  await recordDelivery({ ...input, status: "queued" });
  const sent = await sendSupportResend({
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    idempotencyKey: input.idempotencyKey,
  });

  const status = sent.ok ? "sent" : "pending";
  await recordDelivery({
    ...input,
    status,
    providerMessageId: sent.providerMessageId,
    errorCode: sent.ok ? null : sent.errorCode || "provider_failed",
  });
  return status;
}

async function createTicket(req: Request, body: Body) {
  const authHeader = req.headers.get("Authorization");
  const userClient = getUserClient(authHeader);
  const { data, error } = await userClient.rpc("create_public_support_ticket", {
    p_email: String(body.email || "").trim(),
    p_category: String(body.category || "").trim(),
    p_subject: String(body.subject || "").trim(),
    p_message: String(body.message || "").trim(),
    p_pet_public_token: body.petPublicToken || null,
    p_page_path: body.pagePath || null,
    p_honeypot: body.honeypot || "",
  });

  if (error) {
    const message = String(error.message || "Could not create support ticket.");
    if (message.toLowerCase().includes("too many tickets")) {
      return publicError(429, "Please wait a few minutes before sending another ticket.");
    }
    return publicError(400, "We could not send your ticket. Please try again.");
  }

  const created = data as {
    ok?: boolean;
    reference?: string;
    expectedResponse?: string;
    guestToken?: string | null;
  };
  if (!created?.ok || !created.reference) {
    return publicError(400, "We could not send your ticket. Please try again.");
  }

  let confirmationStatus = "pending";
  if (created.reference !== "TDG-000000") {
    const service = getServiceClient();
    const { data: ticket } = await service
      .from("support_tickets")
      .select("id, email, public_reference")
      .eq("public_reference", created.reference)
      .maybeSingle();

    if (ticket?.id && ticket.email) {
      const payload = buildTicketReceivedEmail(created.reference, envMap());
      confirmationStatus = await deliver({
        ticketId: ticket.id,
        kind: "ticket_received",
        idempotencyKey: `ticket_received:${created.reference}`,
        to: String(ticket.email),
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
    }
  }

  return jsonResponse({
    ok: true,
    reference: created.reference,
    expectedResponse: created.expectedResponse || "We typically reply within 1–2 business days.",
    guestToken: created.guestToken ?? null,
    confirmationStatus,
  });
}

async function adminReply(req: Request, body: Body) {
  const { user } = await getAuthUser(req);
  await assertAdmin(user?.email);
  const ticketId = String(body.ticketId || "").trim();
  const reply = String(body.reply || "").trim();
  const idempotencyKey = String(body.idempotencyKey || "").trim();
  if (!ticketId || reply.length < 1) return publicError(400, "Write a reply first");
  if (reply.length > 4000) return publicError(400, "Reply is too long");
  if (!idempotencyKey || idempotencyKey.length > 80) return publicError(400, "Missing reply key");

  const service = getServiceClient();
  const { data: existing } = await service
    .from("support_email_deliveries")
    .select("id, status, message_id, ticket_id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  const { data: ticket, error: ticketError } = await service
    .from("support_tickets")
    .select("id, email, public_reference, status")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketError || !ticket) return publicError(404, "Ticket not found");
  if (ticket.status === "closed") return publicError(400, "Ticket is closed");

  let messageId = existing?.message_id as string | null;
  let messageRow: Record<string, unknown> | null = null;

  if (messageId) {
    const { data } = await service
      .from("support_ticket_messages")
      .select("id, ticket_id, sender_id, sender_type, message, created_at")
      .eq("id", messageId)
      .maybeSingle();
    messageRow = data;
  } else {
    const { data, error } = await service
      .from("support_ticket_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: user?.id ?? null,
        sender_type: "admin",
        message: reply,
      })
      .select("id, ticket_id, sender_id, sender_type, message, created_at")
      .single();
    if (error || !data) return publicError(400, "Failed to save reply");
    messageRow = data;
    messageId = String(data.id);
  }

  const nextStatus = ticket.status === "open" ? "in_progress" : ticket.status;
  await service
    .from("support_tickets")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", ticketId);

  const payload = buildAdminReplyEmail(String(ticket.public_reference || ""), reply, envMap());
  const notificationStatus = await deliver({
    ticketId,
    messageId,
    kind: "admin_reply",
    idempotencyKey,
    to: String(ticket.email || ""),
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  return jsonResponse({
    ok: true,
    message: messageRow,
    notificationStatus,
    customerNotified: notificationStatus === "sent",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return publicError(405, "Method not allowed");

  try {
    const body = await readJson<Body>(req);
    const action = String(body.action || "").trim();
    if (action === "createTicket") return await createTicket(req, body);
    if (action === "adminReply") return await adminReply(req, body);
    return publicError(400, "Unknown action");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    if (message.toLowerCase().includes("admin") || message.toLowerCase().includes("forbidden")) {
      return publicError(403, "Admin authentication required");
    }
    return publicError(400, "Request failed");
  }
});
