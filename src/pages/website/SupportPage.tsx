import { Link } from "react-router-dom";
import { Mail, MessageCircle, Clock, FileText, Shield, Scale } from "lucide-react";
import { PageHead } from "@/components/PageHead";
import { productTruth } from "@/config/productTruth";

const SUPPORT_EMAIL = productTruth.supportEmail;

export function SupportPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#060a12] to-[#0b1220]">
      <PageHead
        title="Support"
        description="Contact The Digital Gifter support. Email support@thedigitalgifter.com for help with your account, generations, billing, or refunds."
      />

      <div className="border-b border-white/10">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2">
              <MessageCircle size={28} className="text-[#ffd976]" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white">
              Support
            </h1>
          </div>
          <p className="text-sm font-medium text-white/60">
            Support for The Digital Gifter
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        <section className="rounded-lg border border-white/10 bg-white/5 p-8">
          <p className="leading-relaxed text-white/80">
            Need help with your account, AI generations, billing, or a refund?
            Reach us directly. {productTruth.copy.supportResponseSentence}
          </p>
        </section>

        <section className="rounded-lg border border-[#ffd976]/20 bg-gradient-to-r from-[#ffd976]/10 to-[#ffd976]/5 p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg border border-[#ffd976]/20 bg-white/5 p-2">
              <Mail size={20} className="text-[#ffd976]" />
            </div>
            <h2 className="text-xl font-bold text-white">Email us</h2>
          </div>
          <p className="mb-6 leading-relaxed text-white/70">
            Send your question to our support team. Include your account email
            and any order or generation details so we can help faster.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Support%20request%20%E2%80%94%20The%20Digital%20Gifter`}
            className="inline-flex items-center justify-center rounded-lg border border-[#ffd976]/30 bg-[#ffd976]/20 px-6 py-3 font-medium text-[#ffd976] transition-all hover:bg-[#ffd976]/30"
          >
            <Mail size={16} className="mr-2" />
            {SUPPORT_EMAIL}
          </a>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/5 p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2">
              <Clock size={20} className="text-[#ffd976]" />
            </div>
            <h2 className="text-xl font-bold text-white">How to contact us</h2>
          </div>
          <ol className="ml-1 list-decimal space-y-3 pl-5 text-[15px] leading-relaxed text-white/70">
            <li>
              Email{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-[#ffd976] hover:text-[#ffed9f]"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              with a short description of the issue.
            </li>
            <li>
              Include the email on your account and screenshots if something
              failed (generation error, payment, login).
            </li>
            <li>
              You can also use the in-app chat widget on thedigitalgifter.com
              for quicker help while browsing the site.
            </li>
          </ol>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/5 p-8">
          <h2 className="mb-4 text-xl font-bold text-white">Policies</h2>
          <p className="mb-6 text-[15px] leading-relaxed text-white/70">
            Related documents for account holders and App Store reviewers:
          </p>
          <nav className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to="/privacy"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:border-white/25 hover:bg-white/10"
            >
              <Shield size={16} className="text-[#ffd976]" />
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:border-white/25 hover:bg-white/10"
            >
              <Scale size={16} className="text-[#ffd976]" />
              Terms &amp; Conditions
            </Link>
            <Link
              to="/refunds"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:border-white/25 hover:bg-white/10"
            >
              <FileText size={16} className="text-[#ffd976]" />
              Refund Policy
            </Link>
            <Link
              to="/cookies"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:border-white/25 hover:bg-white/10"
            >
              <FileText size={16} className="text-[#ffd976]" />
              Cookie Policy
            </Link>
          </nav>
        </section>
      </div>
    </main>
  );
}
