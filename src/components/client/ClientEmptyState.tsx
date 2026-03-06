// FILE: src/components/client/ClientEmptyState.tsx
import React from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaTo?: string;
};

export default function ClientEmptyState({
  title,
  description,
  ctaLabel = "Go to Generator",
  ctaTo = "/generator",
}: Props) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <Sparkles className="h-5 w-5 text-zinc-200" />
      </div>

      <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">{description}</p>

      <Button
        asChild
        className="mt-6 rounded-2xl border border-white/10 bg-white text-zinc-950 hover:bg-zinc-200"
      >
        <Link to={ctaTo}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}