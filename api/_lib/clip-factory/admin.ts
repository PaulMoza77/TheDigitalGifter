import { getAuthUser, getServiceClient, isServiceRoleRequest } from "../christmas/supabaseClient";

export async function requireClipFactoryAdmin(authHeader: string | null | undefined) {
  if (isServiceRoleRequest(authHeader)) {
    return { email: "service@internal", userId: null as string | null, service: true };
  }
  const { user } = await getAuthUser(authHeader);
  const email = String(user?.email || "").trim().toLowerCase();
  if (!email) {
    const err = new Error("Admin authentication required");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  const service = getServiceClient();
  const { data, error } = await service.from("admin_users").select("email").eq("email", email).maybeSingle();
  if (error) throw error;
  if (!data) {
    const err = new Error("Forbidden: not an admin");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return { email, userId: user?.id || null, service: false };
}
