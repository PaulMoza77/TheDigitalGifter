export async function alerts(
  db: any,
  env: (key: string) => string,
  ticketId?: string,
  fetcher: typeof fetch = fetch,
) {
  const { data: jobs, error } = await db.rpc("claim_support_admin_alerts", {
    p_ticket_id: ticketId || null,
  });
  if (error) throw error;
  for (const job of jobs || []) {
    try {
      const to = env("SUPPORT_ADMIN_EMAILS")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (!to.length || !env("RESEND_API_KEY") || !env("SUPPORT_FROM_EMAIL"))
        throw new Error("email_not_configured");
      const { data: t, error: ticketError } = await db
        .from("support_tickets")
        .select("id,public_reference,subject")
        .eq("id", job.ticket_id)
        .single();
      if (ticketError) throw new Error("ticket_load_failed");
      const response = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${env("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `support-admin-${job.id}`,
        },
        body: JSON.stringify({
          from: env("SUPPORT_FROM_EMAIL"),
          to,
          subject: `[Suport] ${t.public_reference || t.id}: mesaj nou`,
          text: `Ai un mesaj nou în suport.\n\nDeschide tichetul în admin:\n${env("SITE_URL") || "https://www.thedigitalgifter.com"}/admin/support-tickets?ticket=${t.id}\n\nConținutul conversației este disponibil după autentificare.`,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.id)
        throw new Error(`resend_${response.status}`);
      const { error: saved } = await db
        .from("support_admin_alerts")
        .update({ status: "sent", provider_id: result.id, error_code: null })
        .eq("id", job.id);
      if (saved) throw new Error("delivery_record_failed");
    } catch (e) {
      await db
        .from("support_admin_alerts")
        .update({
          status: "failed",
          error_code:
            e instanceof Error ? e.message.slice(0, 80) : "send_failed",
          retry_at: new Date(Date.now() + 180000).toISOString(),
        })
        .eq("id", job.id);
    }
  }
}
