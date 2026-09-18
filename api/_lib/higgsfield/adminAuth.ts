import { getAuthUser, getServiceClient, isServiceRoleRequest } from "../christmas/supabaseClient";

export async function requireAdmin(authHeader: string | null | undefined): Promise<{
  email: string | null;
  service: ReturnType<typeof getServiceClient>;
  isService: boolean;
}> {
  const service = getServiceClient();
  if (isServiceRoleRequest(authHeader)) {
    return { email: "service-role", service, isService: true };
  }
  const { user } = await getAuthUser(authHeader);
  const email = String(user?.email || "").trim().toLowerCase();
  if (!email) {
    const err = new Error("Admin authentication required");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  const { data, error } = await service.from("admin_users").select("email").eq("email", email).maybeSingle();
  if (error) throw error;
  if (!data?.email) {
    const err = new Error("Forbidden: not an admin");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return { email, service, isService: false };
}
