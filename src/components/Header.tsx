import { useConvexAuth } from "convex/react";
import { CreditsDisplay } from "./CreditsDisplay";
import { SignInButton } from "./SignInButton";
import { Link } from "react-router-dom";
import UserMenu from "./UserMenu";
import { Logo } from "./ui/logo";

interface HeaderProps {
  onBuyCredits?: () => void;
}

export default function Header({ onBuyCredits }: HeaderProps) {
  const { isAuthenticated } = useConvexAuth();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[rgba(255,255,255,0.04)] border-b border-[rgba(255,255,255,0.15)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between p-4">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-3">
          {isAuthenticated ? <UserMenu /> : <SignInButton />}
          <CreditsDisplay onBuyCredits={onBuyCredits} />
        </div>
      </div>
    </header>
  );
}
