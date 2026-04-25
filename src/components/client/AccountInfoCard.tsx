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
      ? String(user.app_metadata.providers[0])
      : String(user?.app_metadata?.provider || "email");

  const rows = [
    {
      icon: User2,
      label: "Name",
      value: fullName,
    },
    {
      icon: Mail,
      label: "Email",
      value: email,
    },
    {
      icon: ShieldCheck,
      label: "Provider",
      value: provider,
      capitalize: true,
    },
  ];

  return (
    <div className="rounded-[24px] border border-white/10 bg-zinc-950/70 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur sm:rounded-[28px] sm:p-5">
      <h3 className="text-lg font-semibold text-white">Account</h3>
      <p className="mt-1 text-sm text-zinc-400">Your profile and access summary.</p>

      <div className="mt-5 space-y-3">
        {rows.map((row) => {
          const Icon = row.icon;

          return (
            <div
              key={row.label}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <Icon className="h-4 w-4 text-white" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {row.label}
                </div>

                <div
                  className={[
                    "truncate text-sm font-medium text-white",
                    row.capitalize ? "capitalize" : "",
                  ].join(" ")}
                >
                  {row.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}