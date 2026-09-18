import { shouldSkipPublish } from "./status";
import type {
  PublishAdapterResult,
  SocialPlatform,
  SocialProvider,
  TargetStatus,
} from "./types";

export type SocialPublishAdapter = (input: {
  platform: SocialPlatform;
  videoUrl: string;
  caption: string;
  hashtags: string;
  title?: string | null;
  account: {
    provider: SocialProvider;
    accountId: string;
    status: string;
    accessToken: string;
    metadata: Record<string, unknown>;
  };
  allowLivePosts: boolean;
}) => Promise<PublishAdapterResult>;

export function claimSortKey(scheduledAtMs: number, id: string): string {
  return `${String(scheduledAtMs).padStart(15, "0")}:${id}`;
}

export function selectClaimable<T extends { id: string; scheduledAtMs: number }>(
  rows: T[],
  limit: number,
  isDue: (row: T) => boolean,
): T[] {
  return rows
    .filter(isDue)
    .sort((a, b) => claimSortKey(a.scheduledAtMs, a.id).localeCompare(claimSortKey(b.scheduledAtMs, b.id)))
    .slice(0, Math.max(0, limit));
}

export async function executeTargetPublish(input: {
  target: {
    id: string;
    platform: SocialPlatform;
    status: TargetStatus;
    remotePostId?: string | null;
    platformCaption?: string | null;
    platformTitle?: string | null;
  };
  caption: string;
  hashtags: string;
  videoUrl: string;
  account: {
    provider: SocialProvider;
    accountId: string;
    status: string;
    accessToken: string;
    metadata: Record<string, unknown>;
  } | null;
  allowLivePosts: boolean;
  adapter: SocialPublishAdapter;
}): Promise<PublishAdapterResult> {
  if (shouldSkipPublish(input.target)) {
    return {
      ok: true,
      remotePostId: String(input.target.remotePostId),
      remoteUrl: null,
      provider: input.account?.provider || "meta",
    };
  }

  if (!input.account || input.account.status !== "connected" || !input.account.accessToken) {
    const expired = input.account?.status === "expired";
    return {
      ok: false,
      code: expired ? "credentials_expired" : "account_disconnected",
      message: expired
        ? "Social credentials expired. Reconnect the account, then retry only this target."
        : "No connected account for this platform. Connect it under Social Accounts, then retry only this target.",
      retryable: true,
    };
  }

  if (!input.allowLivePosts) {
    return {
      ok: false,
      code: "live_posting_disabled",
      message:
        "IMPLEMENTED — WAITING FOR PROVIDER APPROVAL / live posting flag. No production post was made.",
      retryable: true,
      waitingForApproval: true,
    };
  }

  if (!input.videoUrl) {
    return {
      ok: false,
      code: "media_missing",
      message: "Video URL is missing. The Reel was not posted.",
      retryable: false,
    };
  }

  return input.adapter({
    platform: input.target.platform,
    videoUrl: input.videoUrl,
    caption: input.target.platformCaption || input.caption,
    hashtags: input.hashtags,
    title: input.target.platformTitle,
    account: input.account,
    allowLivePosts: input.allowLivePosts,
  });
}
