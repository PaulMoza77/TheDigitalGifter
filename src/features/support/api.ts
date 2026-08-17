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

function asCreateResult(data: unknown): CreateSupportTicketResult | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.ok !== true || typeof row.reference !== "string") return null;
  return {
    ok: true,
    reference: row.reference,
    expectedResponse:
      typeof row.expectedResponse === "string"
        ? row.expectedResponse
        : "We typically reply within 1–2 business days.",
    guestToken: typeof row.guestToken === "string" ? row.guestToken : null,
  };
}

export async function createPublicSupportTicket(
  args: CreatePublicSupportTicketArgs,
): Promise<CreateSupportTicketResult> {
  const { data, error } = await supabase.rpc("create_public_support_ticket", {
    p_email: args.email.trim(),
    p_category: args.category,
    p_subject: args.subject.trim(),
    p_message: args.message.trim(),
    p_pet_public_token: args.petPublicToken || null,
    p_page_path: sanitizeSupportPagePath(args.pagePath),
    p_honeypot: args.honeypot || "",
  });

  if (error) throw error;

  const result = asCreateResult(data);
  if (!result) throw new Error("Could not create support ticket.");
  return result;
}
