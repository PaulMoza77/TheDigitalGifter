import React from "react";
import { toast } from "sonner";

import { socialPublisherApi, type SocialAccountPublic } from "@/features/social-publisher/api";

type CardSpec = {
  provider: "meta" | "tiktok" | "youtube";
  title: string;
  lines: Array<{ label: string; connected: boolean; detail?: string }>;
};

function statusLabel(connected: boolean) {
  return connected ? "Connected" : "Not connected";
}

export default function AdminSocialAccountsPage() {
  const [loading, setLoading] = React.useState(true);
  const [accounts, setAccounts] = React.useState<SocialAccountPublic[]>([]);
  const [readiness, setReadiness] = React.useState<Record<string, { oauth: boolean; publishing: string; missing: string[] }>>(
    {},
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await socialPublisherApi.bootstrap();
      setAccounts(data.accounts);
      setReadiness(data.providerReadiness);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load social accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    const message = params.get("message");
    if (!oauth) return;
    const known: Record<string, string> = {
      access_denied: "Login was cancelled.",
      invalid_state: "The login session expired. Connect again.",
      expired_state: "The login session expired. Connect again.",
      exchange_failed: "Token exchange failed. No token was stored.",
      no_pages: "No Facebook Page was available for this login.",
      instagram_not_linked: "The Facebook Page has no linked Instagram professional account.",
      instagram_not_professional: "The Instagram account is not a professional account.",
      missing_permissions: "Not every permission required to publish was granted.",
      missing_scopes: "YouTube did not grant youtube.upload and youtube.readonly.",
      missing_live_scopes: "Reconnect YouTube to grant Live API (youtube.force-ssl).",
      no_channel: "No YouTube channel was available for this Google account.",
      reconnect_required: "YouTube refresh token is invalid. Connect YouTube again.",
      invalid_redirect_uri: "YouTube redirect URI did not match the configured callback.",
      oauth_failed: "Social login failed.",
    };
    if (oauth === "meta" && params.get("ok") === "1") {
      toast.success("Facebook Page and Instagram were saved. Tokens stayed on the server.");
    } else if (oauth === "youtube" && params.get("ok") === "1") {
      toast.success("YouTube channel was saved. Tokens stayed on the server.");
    } else if (oauth === "error") {
      toast.error(known[message || ""] || "Social login failed.");
    }
    window.history.replaceState({}, "", "/admin/social-accounts");
  }, []);

  const meta =
    accounts.find((a) => a.provider === "meta" && a.status === "connected") ||
    accounts.find((a) => a.provider === "meta" && a.status !== "revoked");
  const tiktok = accounts.find((a) => a.provider === "tiktok" && a.status === "connected");
  const youtube =
    accounts.find((a) => a.provider === "youtube" && a.status === "connected") ||
    accounts.find((a) => a.provider === "youtube" && a.status !== "revoked");

  const cards: CardSpec[] = [
    {
      provider: "meta",
      title: "META",
      lines: [
        {
          label: "Instagram",
          connected: Boolean(meta?.metadata?.instagram_user_id) && meta?.status === "connected",
          detail: String(meta?.metadata?.instagram_username || ""),
        },
        {
          label: "Facebook Page",
          connected: Boolean(meta?.metadata?.facebook_page_id) && meta?.status === "connected",
          detail: String(meta?.metadata?.facebook_page_name || meta?.account_name || ""),
        },
      ],
    },
    {
      provider: "tiktok",
      title: "TIKTOK",
      lines: [
        {
          label: "TikTok",
          connected: tiktok?.status === "connected",
          detail: String(tiktok?.metadata?.tiktok_username || tiktok?.account_name || ""),
        },
      ],
    },
    {
      provider: "youtube",
      title: "YOUTUBE",
      lines: [
        {
          label: "YouTube Upload",
          connected: Boolean(youtube?.metadata?.youtube_channel_id) && youtube?.status === "connected" && youtube?.metadata?.youtube_upload_ready !== false,
          detail: [
            youtube?.metadata?.youtube_channel_title || youtube?.account_name || "",
            youtube?.metadata?.youtube_channel_handle || "",
          ]
            .filter(Boolean)
            .join(" · "),
        },
        {
          label: "YouTube Live API",
          connected: Boolean(youtube?.metadata?.youtube_live_ready),
          detail: youtube?.metadata?.youtube_live_ready
            ? "Live scope present"
            : youtube?.metadata?.youtube_channel_id
              ? "Reconnect required for Live"
              : "",
        },
      ],
    },
  ];

  async function connect(provider: CardSpec["provider"]) {
    try {
      const result = await socialPublisherApi.connectUrl(provider);
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      toast.message(
        `IMPLEMENTED — WAITING FOR PROVIDER APPROVAL. Missing: ${(result.missing || []).join(", ") || "app credentials"}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connect failed.");
    }
  }

  async function checkConnection(provider: "meta" | "youtube") {
    try {
      const health = await socialPublisherApi.connectionHealth(provider);
      if (health.valid && health.status === "connected") {
        toast.success(provider === "youtube" ? "YouTube token is valid." : "Meta token is valid.");
      } else {
        toast.message(`Connection ${health.status || "needs attention"}. Nothing was published.`);
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check the connection.");
    }
  }

  async function publishTest() {
    try {
      const report = await socialPublisherApi.publishTest("meta");
      if (report.published || report.executed) {
        toast.error("Publish test refused to run.");
        return;
      }
      toast.message(report.ready ? "Ready for your approval. No post was sent." : report.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish test failed.");
    }
  }

  async function prepareYouTubeTestUpload() {
    try {
      const report = await socialPublisherApi.prepareTestUpload();
      if (report.published || report.executed || report.upload_started) {
        toast.error("Prepare test upload refused to run an upload.");
        return;
      }
      toast.message(
        report.prepared
          ? "YouTube test upload is prepared. No bytes were uploaded. Approve live posting before a real test."
          : report.message,
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Prepare test upload failed.");
    }
  }

  async function disconnect(provider: CardSpec["provider"]) {
    const row = accounts.find((a) => a.provider === provider);
    if (!row) return;
    try {
      await socialPublisherApi.disconnect(row.id);
      toast.success("Disconnected. Tokens were removed server-side.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Disconnect failed.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Admin Panel</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Social Accounts</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Official OAuth only. Access tokens stay encrypted on the server and are never sent to this page.
        </p>

        {loading ? <p className="mt-8 text-sm text-slate-400">Loading…</p> : null}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {cards.map((card) => {
            const info = readiness[card.provider];
            const anyConnected = card.lines.some((line) => line.connected);
            return (
              <article key={card.provider} className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                <h2 className="text-sm font-semibold tracking-[0.2em] text-slate-400">{card.title}</h2>
                <div className="mt-4 space-y-3">
                  {card.lines.map((line) => (
                    <div key={line.label}>
                      <p className="text-sm text-slate-100">
                        {line.label}:{" "}
                        <span className={line.connected ? "text-emerald-300" : "text-slate-400"}>
                          {statusLabel(line.connected)}
                        </span>
                      </p>
                      {line.detail ? <p className="text-xs text-slate-500">{line.detail}</p> : null}
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void connect(card.provider)}
                    className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium"
                  >
                    {card.provider === "meta"
                      ? anyConnected
                        ? "Reconnect Facebook & Instagram"
                        : "Connect Facebook & Instagram"
                      : card.provider === "youtube"
                        ? anyConnected
                          ? "Reconnect YouTube"
                          : "Connect YouTube"
                        : anyConnected
                          ? "Reconnect"
                          : "Connect"}
                  </button>
                  {card.provider === "meta" && anyConnected ? (
                    <button
                      type="button"
                      onClick={() => void checkConnection("meta")}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-sm"
                    >
                      Check connection
                    </button>
                  ) : null}
                  {card.provider === "youtube" && anyConnected ? (
                    <button
                      type="button"
                      onClick={() => void checkConnection("youtube")}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-sm"
                    >
                      Test connection
                    </button>
                  ) : null}
                  {card.provider === "meta" ? (
                    <button
                      type="button"
                      onClick={() => void publishTest()}
                      className="rounded-xl border border-amber-500/40 px-3 py-2 text-sm text-amber-100"
                    >
                      Publish test
                    </button>
                  ) : null}
                  {card.provider === "youtube" ? (
                    <button
                      type="button"
                      onClick={() => void prepareYouTubeTestUpload()}
                      className="rounded-xl border border-amber-500/40 px-3 py-2 text-sm text-amber-100"
                    >
                      Prepare test upload
                    </button>
                  ) : null}
                  {anyConnected ? (
                    <button
                      type="button"
                      onClick={() => void disconnect(card.provider)}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-sm"
                    >
                      Disconnect
                    </button>
                  ) : null}
                </div>
                {card.provider === "meta" && meta ? (
                  <div className="mt-4 space-y-1 text-[11px] leading-4 text-slate-400">
                    <p>Status: {String(meta.status)}</p>
                    <p>
                      Permissions:{" "}
                      {Array.isArray(meta.metadata?.granted_permissions)
                        ? (meta.metadata.granted_permissions as string[]).join(", ") || "none recorded"
                        : "not recorded yet"}
                    </p>
                    {Array.isArray(meta.metadata?.missing_permissions) &&
                    (meta.metadata.missing_permissions as string[]).length ? (
                      <p>Missing: {(meta.metadata.missing_permissions as string[]).join(", ")}</p>
                    ) : null}
                    <p>
                      Instagram{" "}
                      {meta.metadata?.instagram_is_professional ? "professional" : "not confirmed professional"}
                      {meta.metadata?.instagram_linked ? " and linked to the Page" : ""}.
                    </p>
                  </div>
                ) : null}
                {card.provider === "youtube" && youtube ? (
                  <div className="mt-4 space-y-1 text-[11px] leading-4 text-slate-400">
                    <p>Status: {String(youtube.status)}</p>
                    <p>Channel ID: {String(youtube.metadata?.youtube_channel_id || "not detected")}</p>
                    <p>
                      Scopes:{" "}
                      {Array.isArray(youtube.metadata?.granted_scopes)
                        ? (youtube.metadata.granted_scopes as string[]).join(", ") || "none recorded"
                        : Array.isArray(youtube.metadata?.granted_permissions)
                          ? (youtube.metadata.granted_permissions as string[]).join(", ") || "none recorded"
                          : "not recorded yet"}
                    </p>
                    {Array.isArray(youtube.metadata?.missing_live_scopes) &&
                    (youtube.metadata.missing_live_scopes as string[]).length ? (
                      <p>YouTube Live API: not ready · Reconnect required</p>
                    ) : youtube.metadata?.youtube_live_ready ? (
                      <p>YouTube Live API: ready</p>
                    ) : (
                      <p>YouTube Live API: not ready</p>
                    )}
                    <p>
                      YouTube Upload:{" "}
                      {youtube.metadata?.youtube_upload_ready === false
                        ? "not ready"
                        : youtube.metadata?.youtube_upload_ready
                          ? "ready"
                          : "not recorded yet"}
                    </p>
                    <p>
                      Token health:{" "}
                      {youtube.metadata?.token_valid === false
                        ? "invalid"
                        : youtube.metadata?.has_refresh_token === false
                          ? "access only (reconnect for refresh)"
                          : "encrypted server-side"}
                    </p>
                    <p className="text-amber-200/90">
                      OAuth app is in Testing. Refresh tokens may expire after 7 days until the app is published.
                    </p>
                  </div>
                ) : null}
                {info ? (
                  <p className="mt-4 text-[11px] leading-4 text-slate-500">
                    Publishing: {info.publishing}
                    {info.missing?.length ? ` · ${info.missing.join(", ")}` : ""}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
