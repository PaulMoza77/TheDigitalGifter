import React from "react";
import { LifeBuoy, Mail, MessageSquareText } from "lucide-react";
import { productTruth } from "@/config/productTruth";

export default function NeedHelpCard() {
  return (
    <div className="rounded-[24px] border border-white/10 bg-zinc-950/70 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur sm:rounded-[28px] sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
          <LifeBuoy className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Need help?</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-400">
            {productTruth.copy.supportResponseSentence}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
          <Mail className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="min-w-0 truncate">{productTruth.supportEmail}</span>
        </div>

        <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">
          <MessageSquareText className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="min-w-0 truncate">Help center coming soon</span>
        </div>
      </div>
    </div>
  );
}
