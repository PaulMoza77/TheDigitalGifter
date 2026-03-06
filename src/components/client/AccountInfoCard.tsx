// FILE: src/components/client/AccountInfoCard.tsx
import React from "react";
import { Mail, ShieldCheck, User2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

type Props = {
  user: User | null;
};

export default function AccountInfoCard({ user }: Props) {
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    "Your account";

  const email = user?.email ?? "No email";
  const provider =
    Array.isArray(user?.app_metadata?.providers) && user?.app_metadata?.providers.length
      ? user?.app_metadata?.providers[0]
      : user?.app_metadata?.provider || "email";

  return (
    <div className="rounded-[28px] border border-white/10 bg-zinc-950/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur">
      <h3 className="text-lg font-semibold text-white">Account</h3>
      <p className="mt-1 text-sm text-zinc-400">Your profile and access summary.</p>

      <div className="mt-5 space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <User2 className="h-4 w-4 text-white" />
          </span>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Name</div>
            <div className="truncate text-sm font-medium text-white">{fullName}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <Mail className="h-4 w-4 text-white" />
          </span>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Email</div>
            <div className="truncate text-sm font-medium text-white">{email}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <ShieldCheck className="h-4 w-4 text-white" />
          </span>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Provider</div>
            <div className="truncate text-sm font-medium capitalize text-white">{provider}</div>
          </div>
        </div>
      </div>
    </div>
  );
}