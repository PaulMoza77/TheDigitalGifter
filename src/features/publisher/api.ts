import { supabase } from "@/lib/supabase";

async function invoke<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sign in required");
  const response = await fetch("/api/publisher", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(json.message || json.error || `Publisher request failed (${response.status})`);
  }
  if (json && typeof json === "object" && "error" in json && json.error && !("overview" in json)) {
    throw new Error(String(json.message || json.error));
  }
  return json;
}

export const publisherApi = {
  bootstrap: () => invoke<Record<string, unknown>>("bootstrap"),
  previewRule: (payload: Record<string, unknown>) => invoke<{ slots: Array<{ scheduledAt: string; timezone: string }> }>("preview_rule", payload),
  saveRule: (payload: Record<string, unknown>) => invoke<{ id: string }>("save_rule", payload),
  pauseRule: (id: string) => invoke("pause_rule", { id }),
  resumeRule: (id: string) => invoke("resume_rule", { id }),
  deleteRule: (id: string) => invoke("delete_rule", { id }),
  createManual: (payload: Record<string, unknown>) => invoke("create_manual", payload),
  approve: (publicationId: string) => invoke("approve", { publication_id: publicationId }),
  cancel: (publicationId: string) => invoke("cancel", { publication_id: publicationId }),
  lock: (publicationId: string) => invoke("lock", { publication_id: publicationId }),
  returnToPool: (publicationId: string) => invoke("return_to_pool", { publication_id: publicationId }),
  replaceContent: (publicationId: string, libraryAssetId: string, lock = false) =>
    invoke("replace_content", { publication_id: publicationId, library_asset_id: libraryAssetId, lock }),
  reschedule: (publicationId: string, scheduledAt: string) =>
    invoke("reschedule", { publication_id: publicationId, scheduled_at: scheduledAt }),
  excludeAsset: (libraryAssetId: string) => invoke("exclude_asset", { library_asset_id: libraryAssetId }),
  tick: () => invoke("tick"),
  setAutopilot: (enabled: boolean, confirmed: boolean) =>
    invoke("set_autopilot", { enabled, confirmed }),
};
