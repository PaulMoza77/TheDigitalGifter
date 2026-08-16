export function claimIncludedRegeneration(args: {
  used: number;
  allowed: number;
  hasActiveJob: boolean;
  expectedUsed: number;
}): { ok: true; nextUsed: number } | { ok: false; reason: "exhausted" | "in_flight" | "conflict" } {
  if (args.hasActiveJob) return { ok: false, reason: "in_flight" };
  if (args.used !== args.expectedUsed) return { ok: false, reason: "conflict" };
  if (args.used >= args.allowed) return { ok: false, reason: "exhausted" };
  return { ok: true, nextUsed: args.used + 1 };
}

export function simulateTwoSimultaneousRegenerations(args: {
  used: number;
  allowed: number;
}) {
  const first = claimIncludedRegeneration({
    ...args,
    hasActiveJob: false,
    expectedUsed: args.used,
  });
  const second = claimIncludedRegeneration({
    used: first.ok ? first.nextUsed : args.used,
    allowed: args.allowed,
    hasActiveJob: first.ok,
    expectedUsed: args.used,
  });
  return { first, second };
}
