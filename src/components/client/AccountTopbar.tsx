import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Wand2,
  Sparkles,
  Menu,
  Shield,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function mobileNavClass(active: boolean) {
  return [
    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
    active
      ? "bg-white/10 text-white"
      : "text-zinc-400 hover:bg-white/5 hover:text-white",
  ].join(" ");
}

type TopbarItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
};

export default function AccountTopbar() {
  const navigate = useNavigate();

  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [credits, setCredits] = React.useState<number>(0);
  const [creditsLoading, setCreditsLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        alert(`USER ID: ${user?.id ?? "no-user"}`);

        if (!mounted) return;

        if (userError || !user) {
          console.error("[AccountTopbar] getUser error:", userError);
          setIsAdmin(false);
          setCredits(0);
          setLoading(false);
          setCreditsLoading(false);
          return;
        }

        const email = user.email?.trim().toLowerCase() ?? "";

        if (email) {
          const { data: adminRow, error: adminError } = await supabase
            .from("admin_users")
            .select("email")
            .eq("email", email)
            .maybeSingle();

          if (!mounted) return;

          if (adminError) {
            console.error("[AccountTopbar] admin check error:", adminError);
            setIsAdmin(false);
          } else {
            setIsAdmin(Boolean(adminRow?.email));
          }
        } else {
          setIsAdmin(false);
        }

        const { data: creditRow, error: creditsError } = await supabase
          .from("user_credits_balance_view")
          .select("credits_balance")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!mounted) return;

        if (creditsError) {
          console.error("[AccountTopbar] credits error:", creditsError);
          setCredits(0);
        } else {
          setCredits(Number(creditRow?.credits_balance ?? 0));
        }

        setLoading(false);
        setCreditsLoading(false);
      } catch (e) {
        console.error("[AccountTopbar] fatal:", e);

        if (!mounted) return;

        setIsAdmin(false);
        setCredits(0);
        setLoading(false);
        setCreditsLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const items: TopbarItem[] = React.useMemo(() => {
    const base: TopbarItem[] = [
      {
        label: "Dashboard",
        to: "/account/dashboard",
        icon: LayoutGrid,
      },
    ];

    if (isAdmin) {
      base.push({
        label: "Admin Panel",
        to: "/admin",
        icon: Shield,
      });
    }

    base.push({
      label: "Generator",
      to: "/account/generator",
      icon: Wand2,
    });

    return base;
  }, [isAdmin]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 xl:px-8">
        <div className="flex items-center gap-3">
          <Link to="/account/dashboard" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
              <Sparkles className="h-4 w-4 text-white" />
            </span>

            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-white">
                {isAdmin ? "My Account + Admin" : "My Account"}
              </div>
              <div className="text-xs text-zinc-500">
                {isAdmin ? "Client + admin workspace" : "Client workspace"}
              </div>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          {!loading &&
            items.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink key={item.to} to={item.to}>
                  {({ isActive }) => (
                    <span
                      className={[
                        "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition-all",
                        isActive
                          ? "border-white/10 bg-white/10 text-white"
                          : "border-transparent bg-transparent text-zinc-400 hover:border-white/10 hover:bg-white/5 hover:text-white",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                  )}
                </NavLink>
              );
            })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/pricing")}
            className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/90 md:flex"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Credits:</span>
            <span className="font-bold text-[#ffd976]">
              {creditsLoading ? "..." : credits}
            </span>
          </button>

          <Button
            asChild
            variant="secondary"
            className="hidden rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15 md:inline-flex"
          >
            <Link to="/generator">Open Generator</Link>
          </Button>

          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>

              <SheetContent
                side="right"
                className="border-l border-white/10 bg-zinc-950 text-white"
              >
                <SheetHeader>
                  <SheetTitle className="text-left text-white">
                    {isAdmin ? "Client + Admin Account" : "Client Account"}
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => navigate("/pricing")}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white/90"
                  >
                    <Plus size={18} />
                    <span>Credits:</span>
                    <span className="font-bold text-[#ffd976]">
                      {creditsLoading ? "..." : credits}
                    </span>
                  </button>

                  {!loading &&
                    items.map((item) => {
                      const Icon = item.icon;

                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) => mobileNavClass(isActive)}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </NavLink>
                      );
                    })}

                  <Link
                    to="/generator"
                    className="mt-3 flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
                  >
                    Open Generator
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}