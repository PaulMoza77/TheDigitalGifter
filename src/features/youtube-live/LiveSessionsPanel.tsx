import React from "react";
import { toast } from "sonner";

import { isActiveLiveStatus, liveElapsedLabel, type PublicYoutubeLiveSession } from "./policy";
import { youtubeLiveApi } from "./api";

export default function LiveSessionsPanel() {
  const [sessions, setSessions] = React.useState<PublicYoutubeLiveSession[]>([]);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const data = await youtubeLiveApi.list();
      setSessions(data.sessions || []);
    } catch {
      /* admin page can render without live history */
    }
  }, []);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function stop(session: PublicYoutubeLiveSession) {
    if (!window.confirm("Stop this YouTube Live and complete the broadcast?")) return;
    setBusyId(session.id);
    try {
      await youtubeLiveApi.stop(session.id);
      toast.success("Live stop requested.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not stop live.");
    } finally {
      setBusyId(null);
    }
  }

  const current = sessions.filter((item) => isActiveLiveStatus(item.status));
  const completed = sessions.filter((item) => item.status === "completed");
  const failed = sessions.filter((item) => item.status === "failed");

  return (
    <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="text-sm font-semibold tracking-[0.18em] text-slate-400">LIVE SESSIONS</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <SessionColumn title="Current live" empty="None running." items={current}>
          {(item) => (
            <div className="space-y-1">
              <p className="text-sm text-red-200">LIVE · {item.title}</p>
              <p className="text-[11px] text-slate-400">
                Elapsed {liveElapsedLabel(item.started_at) || "—"} · Stop {item.planned_end_at?.slice(11, 16) || "—"} UTC
              </p>
              {item.youtube_url ? (
                <a href={item.youtube_url} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-300">
                  Open on YouTube
                </a>
              ) : null}
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => void stop(item)}
                className="mt-2 rounded-lg border border-red-400/40 px-2 py-1 text-[11px] text-red-100"
              >
                STOP LIVE
              </button>
            </div>
          )}
        </SessionColumn>
        <SessionColumn title="Completed" empty="No completed lives." items={completed.slice(0, 6)}>
          {(item) => (
            <div>
              <p className="text-sm text-slate-200">{item.title}</p>
              {item.youtube_url ? (
                <a href={item.youtube_url} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-300">
                  Archive
                </a>
              ) : null}
            </div>
          )}
        </SessionColumn>
        <SessionColumn title="Failed" empty="No failed lives." items={failed.slice(0, 6)}>
          {(item) => (
            <div>
              <p className="text-sm text-rose-200">{item.title}</p>
              <p className="text-[11px] text-slate-500">{item.last_error || "Failed"}</p>
            </div>
          )}
        </SessionColumn>
      </div>
    </section>
  );
}

function SessionColumn({
  title,
  empty,
  items,
  children,
}: {
  title: string;
  empty: string;
  items: PublicYoutubeLiveSession[];
  children: (item: PublicYoutubeLiveSession) => React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      {items.length === 0 ? <p className="mt-3 text-xs text-slate-500">{empty}</p> : null}
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={item.id}>{children(item)}</div>
        ))}
      </div>
    </div>
  );
}
