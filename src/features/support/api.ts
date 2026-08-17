import { supabase } from "@/lib/supabase";
import { sanitizeSupportPagePath } from "./guards";
import type { CreateSupportTicketResult, SupportCategory } from "./types";

type CreatePublicSupportTicketArgs = {
  email: string;
  category: SupportCategory;
  subject: string;
  message: string;
  petPublicToken?: string | null;
  pagePath?: string | null;
  honeypot?: string;
};

type AdminReplyResult = {
  ok: true;
  message: {
    id: string;
    ticket_id: string;
    sender_id: string | null;
    sender_type: "admin";
    message: string;
    created_at: string;
  };
  notificationStatus: string;
  customerNotified: boolean;
};

function asCreateResult(data: unknown): CreateSupportTicketResult | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.ok !== true || typeof row.reference !== "string") return null;
  const confirmationStatus =
    row.confirmationStatus === "sent" ||
    row.confirmationStatus === "pending" ||
    row.confirmationStatus === "failed" ||
    row.confirmationStatus === "skipped" ||
    row.confirmationStatus === "queued"
      ? row.confirmationStatus
      : null;
  return {
    ok: true,
    reference: row.reference,
    expectedResponse:
      typeof row.expectedResponse === "string"
        ? row.expectedResponse
        : "We typically reply within 1–2 business days.",
    guestToken: typeof row.guestToken === "string" ? row.guestToken : null,
    confirmationStatus,
  };
}

async function invokeSupport<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>("support-tickets", {
    body,
  });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export async function createPublicSupportTicket(
  args: CreatePublicSupportTicketArgs,
): Promise<CreateSupportTicketResult> {
  const data = await invokeSupport<CreateSupportTicketResult>({
    action: "createTicket",
    email: args.email.trim(),
    category: args.category,
    subject: args.subject.trim(),
    message: args.message.trim(),
    petPublicToken: args.petPublicToken || null,
    pagePath: sanitizeSupportPagePath(args.pagePath),
    honeypot: args.honeypot || "",
  });
  const result = asCreateResult(data);
  if (!result) throw new Error("Could not create support ticket.");
  return result;
}

export async function sendAdminSupportReply(input: {
  ticketId: string;
  reply: string;
  idempotencyKey: string;
}): Promise<AdminReplyResult> {
  return invokeSupport<AdminReplyResult>({
    action: "adminReply",
    ticketId: input.ticketId,
    reply: input.reply,
    idempotencyKey: input.idempotencyKey,
  });
}
