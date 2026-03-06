// FILE: src/components/Footer.tsx
import { Link } from "react-router-dom";
import { Logo } from "./ui/logo";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-gradient-to-b from-[#060a12] to-[#0a0e18]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link to="/" className="mb-4 inline-flex items-center">
              <Logo />
            </Link>

            <p className="mt-3 text-sm leading-relaxed text-[#c1c8d8]">
              Create stunning AI-powered cards and share-ready visuals for holidays,
              celebrations and meaningful moments.
            </p>
          </div>

          <div className="md:col-span-1">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Quick Links
            </h3>

            <nav className="space-y-3">
              <Link
                to="/"
                className="flex items-center gap-2 text-sm text-[#c1c8d8] transition-colors hover:text-[#ffd976]"
              >
                <span className="h-1 w-1 rounded-full bg-[#ffd976]" />
                Home
              </Link>

              <Link
                to="/generator"
                className="flex items-center gap-2 text-sm text-[#c1c8d8] transition-colors hover:text-[#ffd976]"
              >
                <span className="h-1 w-1 rounded-full bg-[#ffd976]" />
                Generator
              </Link>

              <Link
                to="/templates"
                className="flex items-center gap-2 text-sm text-[#c1c8d8] transition-colors hover:text-[#ffd976]"
              >
                <span className="h-1 w-1 rounded-full bg-[#ffd976]" />
                Templates
              </Link>
            </nav>
          </div>

          <div className="md:col-span-1">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Legal
            </h3>

            <nav className="space-y-3">
              <Link
                to="/privacy"
                className="flex items-center gap-2 text-sm text-[#c1c8d8] transition-colors hover:text-[#ffd976]"
              >
                <span className="h-1 w-1 rounded-full bg-[#ffd976]" />
                Privacy Policy
              </Link>

              <Link
                to="/terms"
                className="flex items-center gap-2 text-sm text-[#c1c8d8] transition-colors hover:text-[#ffd976]"
              >
                <span className="h-1 w-1 rounded-full bg-[#ffd976]" />
                Terms & Conditions
              </Link>

              <Link
                to="/refunds"
                className="flex items-center gap-2 text-sm text-[#c1c8d8] transition-colors hover:text-[#ffd976]"
              >
                <span className="h-1 w-1 rounded-full bg-[#ffd976]" />
                Refund Policy
              </Link>

              <Link
                to="/unsubscribe"
                className="flex items-center gap-2 text-sm text-[#c1c8d8] transition-colors hover:text-[#ffd976]"
              >
                <span className="h-1 w-1 rounded-full bg-[#ffd976]" />
                Unsubscribe
              </Link>
            </nav>
          </div>

          <div className="md:col-span-1">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Contact & Support
            </h3>

            <div className="space-y-3">
              <a
                href="mailto:support@thedigitalgifter.com"
                className="flex items-center gap-2 text-sm text-[#c1c8d8] transition-colors hover:text-[#ffd976]"
              >
                <span className="h-1 w-1 rounded-full bg-[#ffd976]" />
                support@thedigitalgifter.com
              </a>

              <div className="flex items-start gap-2 text-sm text-[#c1c8d8]">
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[#ffd976]" />
                <span>Available 24/7 for your assistance.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="my-8 border-t border-white/10" />

        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-[#8892a8]">
            © 2026 TheDigitalGifter. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}