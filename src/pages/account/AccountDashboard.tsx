// FILE: src/pages/account/AccountDashboard.tsx
import React from "react";
import type { User } from "@supabase/supabase-js";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import ClientStatsCards from "@/components/client/ClientStatsCards";
import RecentGenerations from "@/components/client/RecentGenerations";
import ContinueCreatingCard from "@/components/client/ContinueCreatingCard";
import AccountInfoCard from "@/components/client/AccountInfoCard";
import NeedHelpCard from "@/components/client/NeedHelpCard";
import UsageSummaryCard from "@/components/client/UsageSummaryCard";
import { clientDashboardDemo } from "@/components/client/client-demo";

export default function AccountDashboard() {
  const [user, setUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    (user?.user_metadata?.name as string | undefined)?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent p-6 shadow-[0_20px_60px_rgba(0,0,0,0.26)] sm:p-8">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-white/[0.03] blur-3xl" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.22em] text-zinc-300">
              <Sparkles className="h-3.5 w-3.5" />
              Client Dashboard
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Welcome back, {firstName}.
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
              Access your creations, monitor credits and continue building new visuals from one premium workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              className="rounded-2xl border border-white/10 bg-white text-zinc-950 hover:bg-zinc-200"
            >
              <Link to="/generator">
                Open Generator
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              variant="secondary"
              className="rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15"
            >
              <Link to="/account/dashboard">Refresh Overview</Link>
            </Button>
          </div>
        </div>
      </section>

      <ClientStatsCards stats={clientDashboardDemo.stats} />

      <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.5fr)_420px]">
        <RecentGenerations items={clientDashboardDemo.recentGenerations} />

        <div className="space-y-6">
          <ContinueCreatingCard />
          <UsageSummaryCard />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AccountInfoCard user={user} />
        <NeedHelpCard />
      </section>
    </div>
  );
}