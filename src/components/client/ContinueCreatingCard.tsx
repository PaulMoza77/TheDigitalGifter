import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ContinueCreatingCard() {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] sm:rounded-[28px] sm:p-5">
      <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-white/5 blur-3xl" />

      <div className="relative">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white sm:h-12 sm:w-12">
          <Wand2 className="h-5 w-5" />
        </div>

        <h3 className="mt-5 text-lg font-semibold text-white">
          Continue Creating
        </h3>

        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Jump back into the generator and create new visuals, gifts and special moments.
        </p>

        <Button
          asChild
          className="mt-6 w-full rounded-2xl border border-white/10 bg-white text-zinc-950 hover:bg-zinc-200 sm:w-auto"
        >
          <Link to="/generator">
            Open Generator
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}