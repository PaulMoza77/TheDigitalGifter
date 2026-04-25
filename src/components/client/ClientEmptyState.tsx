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
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center sm:min-h-[260px] sm:rounded-[28px] sm:px-6 sm:py-10">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 sm:h-14 sm:w-14">
        <Sparkles className="h-5 w-5 text-zinc-200" />
      </div>

      <h3 className="mt-5 text-base font-semibold text-white sm:text-lg">
        {title}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
        {description}
      </p>

      <Button
        asChild
        className="mt-6 w-full rounded-2xl border border-white/10 bg-white text-zinc-950 hover:bg-zinc-200 sm:w-auto"
      >
        <Link to={ctaTo}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}