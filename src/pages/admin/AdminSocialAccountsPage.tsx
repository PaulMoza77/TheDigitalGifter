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

  const meta = accounts.find((a) => a.provider === "meta" && a.status === "connected");
  const tiktok = accounts.find((a) => a.provider === "tiktok" && a.status === "connected");
  const youtube = accounts.find((a) => a.provider === "youtube" && a.status === "connected");

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
          label: "YouTube",
          connected: youtube?.status === "connected",
          detail: String(youtube?.metadata?.youtube_channel_title || youtube?.account_name || ""),
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
                    {anyConnected ? "Reconnect" : "Connect"}
                  </button>
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
