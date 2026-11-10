import { describe, it, expect, vi } from "vitest";
import { alerts } from "../../../../supabase/functions/support-conversation/alerts";
function fixture() {
  const updates: any[] = [];
  const db = {
    rpc: vi
      .fn()
      .mockResolvedValue({ data: [{ id: "job-1", ticket_id: "ticket-1" }] }),
    from: vi.fn((table: string) =>
      table === "support_tickets"
        ? {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: "ticket-1", public_reference: "TDG-123456" },
                }),
              }),
            }),
          }
        : {
            update: (data: any) => ({
              eq: async () => {
                updates.push(data);
                return { error: null };
              },
            }),
          },
    ),
  };
  return { db, updates };
}
const env = (key: string) =>
  ({
    SUPPORT_ADMIN_EMAILS: "thedigitalgifter@gmail.com",
    SUPPORT_FROM_EMAIL: "Support <support@example.com>",
    RESEND_API_KEY: "test-key",
    SITE_URL: "https://example.com",
  })[key] || "";
describe("support admin notification delivery", () => {
  it("uses the configured admin, stable idempotency key and authenticated ticket link", async () => {
    const { db, updates } = fixture();
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "resend-1" })));
    await alerts(db, env, "ticket-1", fetcher);
    const args = fetcher.mock.calls[0][1];
    const body = JSON.parse(args.body);
    expect(body.to).toEqual(["thedigitalgifter@gmail.com"]);
    expect(body.text).toContain("/admin/support-tickets?ticket=ticket-1");
    expect(args.headers["Idempotency-Key"]).toBe("support-admin-job-1");
    expect(updates[0]).toMatchObject({
      status: "sent",
      provider_id: "resend-1",
    });
  });
  it("records a retryable failure instead of claiming a sent email", async () => {
    const { db, updates } = fixture();
    await alerts(
      db,
      env,
      undefined,
      vi.fn().mockResolvedValue(new Response("{}", { status: 503 })),
    );
    expect(updates[0]).toMatchObject({
      status: "failed",
      error_code: "resend_503",
    });
    expect(updates[0].retry_at).toBeTruthy();
  });
  it("does not send when sender configuration is absent", async () => {
    const { db, updates } = fixture();
    const fetcher = vi.fn();
    await alerts(db, () => "", undefined, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({
      status: "failed",
      error_code: "email_not_configured",
    });
  });
});
