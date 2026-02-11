import { Link } from "react-router-dom";
import { CreditsDisplay } from "./CreditsDisplay";
import { SignInButton } from "./SignInButton";
import UserMenu from "./UserMenu";
import { Logo } from "./ui/logo";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  onBuyCredits?: () => void;
}

export default function Header({ onBuyCredits }: HeaderProps) {
  const { user, loading } = useAuth();
  const isAuthenticated = !!user;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[rgba(255,255,255,0.04)] border-b border-[rgba(255,255,255,0.15)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between p-4">
        <Link to="/" aria-label="Go to homepage" className="shrink-0">
          <Logo />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {loading ? (
            <div className="h-9 w-24 rounded-full bg-white/10 border border-white/10 animate-pulse" />
          ) : isAuthenticated ? (
            <UserMenu />
          ) : (
            <SignInButton />
          )}

          <CreditsDisplay onBuyCredits={onBuyCredits} />
        </div>
      </div>
    </header>
  );
}
