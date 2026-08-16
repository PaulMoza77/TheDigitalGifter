export async function assertRateLimit(
  service: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }> },
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await service.rpc("touch_edge_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.warn("[rate-limit] rpc failed", error.message);
    return true;
  }
  return data !== false;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
  return forwarded.split(",")[0]?.trim() || "unknown";
}
