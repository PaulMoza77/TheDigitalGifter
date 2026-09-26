#!/usr/bin/env node
/** Preset wrapper — same behavior as the original NYC Winter Time 1990 pack. */
import { runPremiumContentOrchestrator } from "./tdg-premium-content-orchestrator.mjs";

await runPremiumContentOrchestrator({
  theme: process.env.TDG_THEME || "New York Winter Time 1990",
  style:
    process.env.TDG_STYLE ||
    "Nostalgic 1990s Manhattan Christmas — cinematic, cozy, magical, premium, timeless luxury memory; subtle film grain; warm holiday tones with cool winter contrast.",
});
