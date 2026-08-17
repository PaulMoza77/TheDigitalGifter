import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  inferSupportCategoryFromPath,
  isHoneypotFilled,
  parseSupportCategory,
  publicSupportErrorMessage,
  sanitizeSupportPagePath,
  supportFormPath,
  supportUrlContainsSecrets,
  validateSupportForm,
} from "./guards";
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from "./types";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("support ticket flow", () => {
  it("uses the five public categories and five admin statuses", () => {
    expect(SUPPORT_CATEGORIES.map((item) => item.label)).toEqual([
      "Pet order",
      "Generation issue",
      "Billing or refund",
      "Account",
      "Other",
    ]);
    expect(SUPPORT_STATUSES.map((item) => item.label)).toEqual([
      "Open",
      "In progress",
      "Waiting for customer",
      "Resolved",
      "Closed",
    ]);
  });

  it("validates email, category, subject and message lengths", () => {
    expect(
      validateSupportForm({
        email: "",
        category: "",
        subject: "",
        message: "",
        website: "",
        attachPetOrder: false,
      }),
    ).toMatchObject({
      email: "Enter your email so we can reply.",
      category: "Choose a category.",
      subject: "Add a short subject.",
      message: "Tell us a bit more so we can help.",
    });
    expect(
      validateSupportForm({
        email: "not-an-email",
        category: "pet_order",
        subject: "Help",
        message: "My portraits did not look like my dog.",
        website: "",
        attachPetOrder: false,
      }).email,
    ).toBe("Enter a valid email address.");
    expect(
      Object.keys(
        validateSupportForm({
          email: "you@email.com",
          category: "billing",
          subject: "Refund question",
          message: "I need help with a refund for my order.",
          website: "",
          attachPetOrder: false,
        }),
      ),
    ).toHaveLength(0);
  });

  it("treats a filled honeypot as bot traffic", () => {
    expect(isHoneypotFilled("")).toBe(false);
    expect(isHoneypotFilled("   ")).toBe(false);
    expect(isHoneypotFilled("http://spam.test")).toBe(true);
  });

  it("never puts tokens, emails or order ids on the support URL", () => {
    expect(supportFormPath({ category: "pet_order" })).toBe("/support?category=pet_order");
    expect(supportFormPath({ pathname: "/pet/order" })).toBe("/support?category=pet_order");
    expect(supportFormPath({ pathname: "/account/dashboard" })).toBe("/support?category=account");
    expect(supportUrlContainsSecrets("/support?category=pet_order")).toBe(false);
    expect(supportUrlContainsSecrets("/support?token=secret-order-token")).toBe(true);
    expect(supportUrlContainsSecrets("/support?email=you@email.com")).toBe(true);
    expect(supportUrlContainsSecrets("/support?orderId=11111111-2222-4333-8333-444444444444")).toBe(true);
    expect(parseSupportCategory("pet_order")).toBe("pet_order");
    expect(parseSupportCategory("token")).toBe("");
    expect(inferSupportCategoryFromPath("/generator")).toBe("generation");
  });

  it("strips query strings and secrets from stored page paths", () => {
    expect(sanitizeSupportPagePath("/pet/order?token=abc")).toBe("/pet/order");
    expect(sanitizeSupportPagePath("https://www.thedigitalgifter.com/support?email=a@b.com")).toBe(
      "/support",
    );
    expect(sanitizeSupportPagePath("/pet/checkout")).toBe("/pet/checkout");
  });

  it("maps RPC errors without echoing emails or messages", () => {
    expect(publicSupportErrorMessage({ message: "too many tickets" })).toContain("wait a few minutes");
    expect(publicSupportErrorMessage({ message: "you@email.com secret body" })).toBe(
      "We could not send your ticket. Please try again.",
    );
  });

  it("reuses support_tickets instead of creating a second tickets table", () => {
    const sql = readSrc("supabase/migrations/20260817190000_support_ticket_flow.sql");
    expect(sql).toContain("alter table public.support_tickets");
    expect(sql).not.toMatch(/create table public\.\w*tickets/i);
    expect(sql).toContain("add column if not exists category");
    expect(sql).toContain("add column if not exists public_reference");
    expect(sql).toContain("add column if not exists pet_order_id");
    expect(sql).toContain("add column if not exists guest_access_hash");
  });

  it("creates tickets through a guest-safe security definer RPC with rate limit and honeypot", () => {
    const sql = readSrc("supabase/migrations/20260817190000_support_ticket_flow.sql");
    expect(sql).toContain("create or replace function public.create_public_support_ticket");
    expect(sql).toContain("security definer");
    expect(sql).toContain("p_honeypot");
    expect(sql).toContain("too many tickets");
    expect(sql).toContain("interval '15 minutes'");
    expect(sql).toContain("public_token_hash");
    expect(sql).toContain("guest_access_hash");
    expect(sql).toContain("load_own_support_ticket");
    expect(sql).toContain("revoke select on public.support_tickets from anon");
    expect(sql).toContain("revoke update on public.support_tickets from anon");
    expect(sql).not.toContain("grant select on public.support_tickets to anon");
  });

  it("does not let guests list tickets and requires a guest token to read one", () => {
    const sql = readSrc("supabase/migrations/20260817190000_support_ticket_flow.sql");
    expect(sql).toContain("ticket.guest_access_hash = token_hash");
    expect(sql).not.toMatch(/from public\.support_tickets[\s\S]{0,80}user_id is null/);
    const form = readSrc("src/features/support/api.ts");
    expect(form).toContain("createTicket");
    expect(form).toContain("support-tickets");
    expect(form).not.toMatch(/from\("support_tickets"\)\s*\.select/);
  });

  it("keeps service-role credentials out of the browser client", () => {
    const client = readSrc("src/lib/supabase.ts");
    expect(client).toContain("anon");
    expect(client).not.toMatch(/SERVICE_ROLE|service_role/);
    expect(readSrc("src/features/support/api.ts")).not.toMatch(/SERVICE_ROLE|service_role/);
    expect(readSrc("src/domains/admin/pages/SupportTicketsPage.tsx")).not.toMatch(
      /SERVICE_ROLE|service_role/,
    );
  });

  it("replaces public mailto CTAs with the ticket form", () => {
    expect(readSrc("src/pages/website/SupportPage.tsx")).toContain("SupportTicketForm");
    expect(readSrc("src/pages/website/SupportPage.tsx")).not.toContain("mailto:");
    expect(readSrc("src/pages/website/SupportPage.tsx")).not.toContain("Email us");
    expect(readSrc("src/components/Footer.tsx")).not.toContain("mailto:support@");
    expect(readSrc("src/components/SupportTicketWidget.tsx")).toContain("supportFormPath");
    expect(readSrc("src/components/SupportTicketWidget.tsx")).not.toContain("create_support_ticket");
    expect(readSrc("src/features/pet/components/SamePetGuarantee.tsx")).toContain("capturePetSupportContext");
    expect(readSrc("src/features/pet/PetOrderPage.tsx")).toContain("capturePetSupportContext");
    expect(readSrc("src/components/client/NeedHelpCard.tsx")).toContain("/support?category=account");
    expect(readSrc("src/components/client/NeedHelpCard.tsx")).not.toContain("support@yourproject.com");
  });

  it("does not pretend admin replies were emailed unless delivery succeeded", () => {
    const admin = readSrc("src/domains/admin/pages/SupportTicketsPage.tsx");
    expect(admin).toContain("adminNotificationLabel");
    expect(admin).toContain("adminReplyToast");
    expect(readSrc("src/features/support/emailDelivery.ts")).toContain("Customer not notified");
    expect(admin).not.toMatch(/toast\.success\(["'`]Email sent/i);
    expect(admin).toContain("public_reference");
    expect(admin).toContain("pet_order_id");
    expect(admin).toContain("SUPPORT_STATUSES");
    expect(admin).toContain("waiting_for_customer");
    expect(readSrc("src/features/support/types.ts")).toContain("Waiting for customer");
  });

  it("sends support mail from the Edge function with Resend secrets only", () => {
    const fn = readSrc("supabase/functions/support-tickets/index.ts");
    const email = readSrc("supabase/functions/_shared/support/email.ts");
    expect(fn).toContain("createTicket");
    expect(fn).toContain("adminReply");
    expect(fn).toContain("assertAdmin");
    expect(fn).toContain("support_email_deliveries");
    expect(fn).toContain("ticket_received");
    expect(email).toContain("RESEND_API_KEY");
    expect(email).toContain("PET_EMAIL_FROM");
    expect(email).toContain("TRANSACTIONAL_EMAIL_FROM");
    expect(email).not.toContain("mailto:");
    expect(email).toContain("redactSupportEmailSecrets");
    expect(readSrc("src/features/support/api.ts")).not.toMatch(/SERVICE_ROLE|service_role/);
    expect(readSrc("src/features/support/SupportTicketForm.tsx")).not.toMatch(/fbq|gtag|console\.(log|info|debug)/);
    expect(readSrc("src/domains/admin/pages/SupportTicketsPage.tsx")).not.toMatch(/console\.(log|info|debug|error)/);
  });
});
