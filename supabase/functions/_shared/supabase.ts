import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

export function getServiceClient(): SupabaseClient {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function getUserClient(authHeader: string | null): SupabaseClient {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_ANON_KEY"),
    {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export function bearerToken(req: Request): string {
  const authHeader = req.headers.get("Authorization") || "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

export function isServiceRoleRequest(req: Request): boolean {
  const token = bearerToken(req);
  if (!token) return false;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (serviceKey && token === serviceKey) return true;
  try {
    const payload = token.split(".")[1] || "";
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as { role?: string };
    return json.role === "service_role";
  } catch {
    return false;
  }
}

export async function getAuthUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { user: null, authHeader: null };
  if (isServiceRoleRequest(req)) return { user: null, authHeader };
  const client = getUserClient(authHeader);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { user: null, authHeader };
  return { user: data.user, authHeader };
}

export async function assertAdmin(email: string | null | undefined) {
  if (!email) throw new Error("Admin authentication required");
  const service = getServiceClient();
  const normalized = email.trim().toLowerCase();
  const { data, error } = await service
    .from("admin_users")
    .select("email")
    .eq("email", normalized)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Forbidden: not an admin");
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
