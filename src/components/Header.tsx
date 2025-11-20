import { useConvexAuth } from "convex/react";
import { CreditsDisplay } from "./CreditsDisplay";
import SignOutButton from "./SignOutButton";
import { SignInButton } from "./SignInButton";
import { Link } from "react-router-dom";

interface HeaderProps {
  onBuyCredits?: () => void;
}

export default function Header({ onBuyCredits }: HeaderProps) {
  const { isAuthenticated } = useConvexAuth();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[rgba(255,255,255,0.04)] border-b border-[rgba(255,255,255,0.15)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between p-4">
        <Link
          to="/"
          className="flex items-center gap-3 font-extrabold text-[1.1rem] cursor-pointer select-none"
        >
          <div className="w-8 h-8 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff,#ffe39d_35%,#ffb85b_70%)] shadow-[0_0_12px_rgba(255,195,90,.8)] grid place-items-center text-black text-sm border border-white/60">
            ★
          </div>
          <span className="text-[#fff8e7] drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] hidden sm:block">
            TheDigitalGifter
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {isAuthenticated ? <SignOutButton /> : <SignInButton />}
          <CreditsDisplay onBuyCredits={onBuyCredits} />
          {/* <button
            onClick={onBuyCredits}
            className="px-4 py-2 rounded-xl text-sm font-extrabold text-[#1a1a1a] border border-white/50 bg-[conic-gradient(from_0deg,#ffc65c,#ff9f43,#ff7040,#ffc65c)] bg-[length:200%_200%] animate-[coinShimmer_5.5s_ease-in-out_infinite] shadow-[0_10px_24px_rgba(0,0,0,.35)] hover:scale-[1.05] transition will-change-transform"
          >
            Buy credits
          </button> */}
        </div>
      </div>
    </header>
  );
}
