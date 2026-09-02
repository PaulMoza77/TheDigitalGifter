import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function requiredEnv(name: string): string {
  const value = String(
    process.env[name] || (name === "SUPABASE_URL" ? process.env.VITE_SUPABASE_URL : "") || "",
  ).trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

let cachedClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  cachedClient = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

function optionalEnv(name: string): string {
  return String(process.env[name] || "").trim();
}

export async function getAuthUser(authHeader: string | null | undefined): Promise<{
  user: Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"];
}> {
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || isServiceRoleRequest(authHeader)) return { user: null };
  const anonKey = optionalEnv("SUPABASE_ANON_KEY") || optionalEnv("VITE_SUPABASE_ANON_KEY");
  const supabaseUrl = optionalEnv("SUPABASE_URL") || optionalEnv("VITE_SUPABASE_URL");
  if (!anonKey || !supabaseUrl) return { user: null };
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { user: null };
  return { user: data.user };
}

/** Matches supabase/functions/_shared/supabase.ts#isServiceRoleRequest so internal
 * Vercel-to-Vercel calls (e.g. christmas-funnel enqueueing christmas-generate) can
 * authenticate with the shared service-role key. */
export function isServiceRoleRequest(authHeader: string | null | undefined): boolean {
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (serviceKey && token === serviceKey) return true;
  try {
    const payload = token.split(".")[1] || "";
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { role?: string };
    return json.role === "service_role";
  } catch {
    return false;
  }
}
