import React from "react";
import { LifeBuoy, Mail, MessageSquareText } from "lucide-react";

export default function NeedHelpCard() {
  return (
    <div className="rounded-[24px] border border-white/10 bg-zinc-950/70 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur sm:rounded-[28px] sm:p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white sm:h-12 sm:w-12">
        <LifeBuoy className="h-5 w-5" />
      </div>

      <h3 className="mt-5 text-lg font-semibold text-white">Need Help?</h3>

      <p className="mt-2 text-sm leading-6 text-zinc-400">
        Support, troubleshooting and account assistance can be connected here.
      </p>

      <div className="mt-5 space-y-3">
        <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
          <Mail className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="min-w-0 truncate">support@yourproject.com</span>
        </div>

        <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
          <MessageSquareText className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="min-w-0 truncate">Help center coming soon</span>
        </div>
      </div>
    </div>
  );
}