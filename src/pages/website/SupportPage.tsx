import { MessageCircle } from "lucide-react";
import { PageHead } from "@/components/PageHead";
import { SupportTicketForm } from "@/features/support/SupportTicketForm";

export function SupportPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#060a12] to-[#0b1220]">
      <PageHead
        title="Support"
        description="Send a support ticket to The Digital Gifter. We typically reply within 1–2 business days."
      />

      <div className="border-b border-white/10">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2">
              <MessageCircle size={28} className="text-[#ffd976]" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white">Support</h1>
          </div>
          <p className="text-sm font-medium text-white/60">Tell us what you need help with</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        <section className="rounded-lg border border-white/10 bg-white/5 p-8">
          <p className="leading-relaxed text-white/80">
            Need help with a pet order, a generation, billing, or your account? Send a ticket
            and we typically reply within 1–2 business days.
          </p>
        </section>

        <SupportTicketForm />
      </div>
    </main>
  );
}
