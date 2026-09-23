import { Link } from "react-router-dom";
import { Trash2, Settings, Mail, Clock, Shield, Scale } from "lucide-react";
import { PageHead } from "@/components/PageHead";

const SUPPORT_EMAIL = "support@thedigitalgifter.com";

export function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#060a12] to-[#0b1220]">
      <PageHead
        title="User Data Deletion Instructions"
        description="How to delete your Facebook or Instagram integration data from The Digital Gifter. Remove the app from Facebook Settings or email support for deletion within 30 days."
        noindex
      />

      <div className="border-b border-white/10">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2">
              <Trash2 size={28} className="text-[#ffd976]" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white">
              User Data Deletion Instructions
            </h1>
          </div>
          <p className="text-sm font-medium text-white/60">
            How to remove Facebook / Instagram connected data from The Digital
            Gifter
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        <section className="rounded-lg border border-white/10 bg-white/5 p-8">
          <p className="leading-relaxed text-white/80">
            If you connected a Facebook or Instagram account to The Digital
            Gifter, you can revoke that integration and request deletion of the
            related data at any time. No login is required to follow these
            instructions.
          </p>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/5 p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2">
              <Settings size={20} className="text-[#ffd976]" />
            </div>
            <h2 className="text-xl font-bold text-white">
              Remove the integration in Facebook
            </h2>
          </div>
          <p className="mb-4 leading-relaxed text-white/70">
            You can disconnect The Digital Gifter from your Facebook account
            yourself:
          </p>
          <ol className="ml-1 list-decimal space-y-3 pl-5 text-[15px] leading-relaxed text-white/70">
            <li>
              Open Facebook and go to{" "}
              <strong className="font-medium text-white/90">Settings</strong>{" "}
              →{" "}
              <strong className="font-medium text-white/90">
                Business Integrations
              </strong>{" "}
              (or Settings &amp; privacy → Settings → Apps and websites /
              Business integrations, depending on your Facebook interface).
            </li>
            <li>
              Find <strong className="font-medium text-white/90">The Digital Gifter</strong>{" "}
              in the list of connected apps or integrations.
            </li>
            <li>
              Remove or revoke access. This disconnects the integration on
              Facebook&apos;s side.
            </li>
          </ol>
        </section>

        <section className="rounded-lg border border-[#ffd976]/20 bg-gradient-to-r from-[#ffd976]/10 to-[#ffd976]/5 p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg border border-[#ffd976]/20 bg-white/5 p-2">
              <Mail size={20} className="text-[#ffd976]" />
            </div>
            <h2 className="text-xl font-bold text-white">
              Request deletion by email
            </h2>
          </div>
          <p className="mb-6 leading-relaxed text-white/70">
            Alternatively, email our support team to request deletion of your
            Facebook/Instagram-related data. Include the email address associated
            with your account and, if available, your Facebook or Instagram user
            ID so we can locate the correct records.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=User%20data%20deletion%20request%20%E2%80%94%20The%20Digital%20Gifter`}
            className="inline-flex items-center justify-center rounded-lg border border-[#ffd976]/30 bg-[#ffd976]/20 px-6 py-3 font-medium text-[#ffd976] transition-all hover:bg-[#ffd976]/30"
          >
            <Mail size={16} className="mr-2" />
            {SUPPORT_EMAIL}
          </a>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/5 p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2">
              <Trash2 size={20} className="text-[#ffd976]" />
            </div>
            <h2 className="text-xl font-bold text-white">What we delete</h2>
          </div>
          <p className="mb-4 leading-relaxed text-white/70">
            When we process a deletion request for a Facebook or Instagram
            integration, we remove:
          </p>
          <ul className="ml-1 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-white/70">
            <li>OAuth access and refresh tokens</li>
            <li>Facebook and Instagram user identifiers stored for the connection</li>
            <li>Account connection records linking your Meta identity to The Digital Gifter</li>
          </ul>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/5 p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2">
              <Clock size={20} className="text-[#ffd976]" />
            </div>
            <h2 className="text-xl font-bold text-white">Processing time</h2>
          </div>
          <p className="leading-relaxed text-white/70">
            We process data deletion requests within a maximum of{" "}
            <strong className="font-medium text-white/90">30 days</strong> of
            receiving a valid request. You will receive a confirmation email when
            the deletion is complete when contact details are available.
          </p>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/5 p-8">
          <h2 className="mb-4 text-xl font-bold text-white">Related policies</h2>
          <p className="mb-6 text-[15px] leading-relaxed text-white/70">
            For full details on how we handle personal information and use of the
            service, see:
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
          </nav>
        </section>
      </div>
    </main>
  );
}
