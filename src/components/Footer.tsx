import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className=" border-t border-white/10 bg-gradient-to-b from-[#060a12] to-[#0a0e18]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Logo & About Section */}
          <div className="md:col-span-1">
            <Link
              to="/"
              className="flex items-center gap-3 font-extrabold text-[1.1rem] cursor-pointer select-none mb-4"
            >
              <div className="w-10 h-10 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff,#ffe39d_35%,#ffb85b_70%)] shadow-[0_0_12px_rgba(255,195,90,.8)] grid place-items-center text-black text-base border border-white/60 flex-shrink-0">
                ★
              </div>
              <span className="text-[#fff8e7] drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] hidden sm:block">
                TheDigitalGifter
              </span>
            </Link>
            <p className="text-[#c1c8d8] text-sm leading-relaxed mt-3">
              Create stunning AI-powered holiday cards with personalized magic.
              Spreading Christmas joy with cutting-edge technology.
            </p>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-1">
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
              Quick Links
            </h3>
            <nav className="space-y-3">
              <Link
                to="/"
                className="text-[#c1c8d8] hover:text-[#ffd976] transition-colors text-sm flex items-center gap-2"
              >
                <span className="w-1 h-1 bg-[#ffd976] rounded-full"></span>
                Home
              </Link>
              <Link
                to="/generator"
                className="text-[#c1c8d8] hover:text-[#ffd976] transition-colors text-sm flex items-center gap-2"
              >
                <span className="w-1 h-1 bg-[#ffd976] rounded-full"></span>
                Generator
              </Link>
              <Link
                to="/templates"
                className="text-[#c1c8d8] hover:text-[#ffd976] transition-colors text-sm flex items-center gap-2"
              >
                <span className="w-1 h-1 bg-[#ffd976] rounded-full"></span>
                Templates
              </Link>
            </nav>
          </div>

          {/* Legal Links */}
          <div className="md:col-span-1">
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
              Legal
            </h3>
            <nav className="space-y-3">
              <Link
                to="/privacy"
                className="text-[#c1c8d8] hover:text-[#ffd976] transition-colors text-sm flex items-center gap-2"
              >
                <span className="w-1 h-1 bg-[#ffd976] rounded-full"></span>
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="text-[#c1c8d8] hover:text-[#ffd976] transition-colors text-sm flex items-center gap-2"
              >
                <span className="w-1 h-1 bg-[#ffd976] rounded-full"></span>
                Terms & Conditions
              </Link>
              <Link
                to="/refunds"
                className="text-[#c1c8d8] hover:text-[#ffd976] transition-colors text-sm flex items-center gap-2"
              >
                <span className="w-1 h-1 bg-[#ffd976] rounded-full"></span>
                Refund Policy
              </Link>
            </nav>
          </div>

          {/* Contact Section */}
          <div className="md:col-span-1">
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
              Contact & Support
            </h3>
            <div className="space-y-3">
              <a
                href="mailto:support@thedigitalgifter.com"
                className="text-[#c1c8d8] hover:text-[#ffd976] transition-colors text-sm flex items-center gap-2"
              >
                <span className="w-1 h-1 bg-[#ffd976] rounded-full"></span>
                support@thedigitalgifter.com
              </a>
              <div className="text-[#c1c8d8] text-sm flex items-start gap-2">
                <span className="w-1 h-1 bg-[#ffd976] rounded-full mt-1.5 flex-shrink-0"></span>
                <span>Available 24/7 for your assistance</span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-8"></div>

        {/* Bottom Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p className="text-[#8892a8] text-xs">
            © 2024 TheDigitalGifter. All rights reserved. Spreading Christmas
            joy with AI.
          </p>
          <div className="flex items-center gap-1 text-[#8892a8] text-xs">
            <span>Made with</span>
            <Heart size={14} className="text-red-500 mx-0.5" fill="red" />
            <span>for the holidays</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
