import { supabase } from "@/lib/supabase";

export type SocialAccountPublic = {
  id: string;
  provider: "meta" | "tiktok" | "youtube";
  account_id: string;
  account_name: string;
  status: string;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SocialPublicationRow = {
  id: string;
  library_asset_id: string;
  asset_title: string | null;
  asset_src: string | null;
  status: string;
  scheduled_at: string;
  timezone: string;
  caption: string;
  hashtags: string;
  created_at: string;
  updated_at: string;
  targets: Array<{
    id: string;
    provider: string;
    platform: string;
    status: string;
    attempts: number;
    remote_post_id: string | null;
    remote_url: string | null;
    published_at: string | null;
    last_error: string | null;
    next_retry_at: string | null;
  }>;
};

async function invoke<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("social-publisher", {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error?: string }).error));
  }
  return data as T;
}

export const socialPublisherApi = {
  bootstrap: () =>
    invoke<{
      timezone: string;
      livePostsEnabled: boolean;
      oauthConfigured: Record<string, boolean>;
      accounts: SocialAccountPublic[];
      providerReadiness: Record<
        string,
        { ui: true; oauth: boolean; publishing: string; missing: string[] }
      >;
    }>("bootstrap"),
  connectUrl: (provider: "meta" | "tiktok" | "youtube") =>
    invoke<{ url: string; waitingForApproval?: boolean; missing?: string[] }>("connect_url", {
      provider,
    }),
  disconnect: (accountId: string) => invoke<{ ok: true }>("disconnect", { account_id: accountId }),
  connectionHealth: (provider: "meta" | "youtube" = "meta") =>
    invoke<{
      ok: true;
      valid: boolean;
      status: string;
      provider?: string;
      missing_permissions?: string[];
      missing_scopes?: string[];
      scopes?: string[];
      facebook_page_name?: string | null;
      instagram_username?: string | null;
      instagram_is_professional?: boolean;
      instagram_linked?: boolean;
      youtube_channel_id?: string | null;
      youtube_channel_title?: string | null;
      youtube_channel_handle?: string | null;
      oauth_app_status?: string | null;
      refresh_token_warning?: string | null;
      has_refresh_token?: boolean;
      error?: string | null;
    }>("connection_health", { provider }),
  publishTest: (provider: "meta" | "youtube" = "meta") =>
    invoke<{
      ok: true;
      published: false;
      executed: false;
      ready: boolean;
      prepared?: boolean;
      upload_started?: boolean;
      blockers: string[];
      facebook_page_name?: string | null;
      instagram_username?: string | null;
      granted_permissions?: string[];
      missing_permissions?: string[];
      youtube_channel_id?: string | null;
      youtube_channel_title?: string | null;
      youtube_channel_handle?: string | null;
      granted_scopes?: string[];
      missing_scopes?: string[];
      oauth_app_status?: string | null;
      refresh_token_warning?: string | null;
      message: string;
    }>("publish_test", { provider }),
  prepareTestUpload: () =>
    invoke<{
      ok: true;
      published: false;
      executed: false;
      upload_started: false;
      prepared: boolean;
      ready: boolean;
      blockers: string[];
      youtube_channel_id?: string | null;
      youtube_channel_title?: string | null;
      youtube_channel_handle?: string | null;
      granted_scopes?: string[];
      missing_scopes?: string[];
      oauth_app_status?: string | null;
      refresh_token_warning?: string | null;
      message: string;
    }>("prepare_test_upload", { provider: "youtube" }),
  listPublications: (tab: "upcoming" | "published" | "failed" | "calendar") =>
    invoke<{ items: SocialPublicationRow[] }>("list_publications", { tab }),
  createPublication: (payload: Record<string, unknown>) =>
    invoke<{ publication: SocialPublicationRow; issues?: unknown }>("create_publication", payload),
  bulkSchedule: (payload: Record<string, unknown>) =>
    invoke<{ publications: SocialPublicationRow[]; preview?: unknown }>("bulk_schedule", payload),
  previewBulk: (payload: Record<string, unknown>) =>
    invoke<{ slots: unknown[]; error?: string }>("preview_bulk", payload),
  cancel: (publicationId: string) => invoke<{ ok: true }>("cancel_publication", { publication_id: publicationId }),
  reschedule: (publicationId: string, scheduledAt: string, timezone: string) =>
    invoke<{ publication: SocialPublicationRow }>("reschedule_publication", {
      publication_id: publicationId,
      scheduled_at: scheduledAt,
      timezone,
    }),
  retryTarget: (targetId: string) => invoke<{ ok: true }>("retry_target", { target_id: targetId }),
  getPublication: (publicationId: string) =>
    invoke<{ publication: SocialPublicationRow }>("get_publication", { publication_id: publicationId }),
};
