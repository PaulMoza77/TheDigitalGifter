export function verifyCleanupPage(args: {
  requested: number;
  deleted: number;
}): { verified: boolean; remaining: number } {
  const remaining = Math.max(0, args.requested - args.deleted);
  return { verified: remaining === 0, remaining };
}
