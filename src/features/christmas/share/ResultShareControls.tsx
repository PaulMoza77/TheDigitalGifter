import { useEffect, useState } from "react";
import { trackChristmasEvent } from "../analytics";
import {
  enableResultShare,
  getOwnerResultShare,
  revokeResultShare,
  type OwnerShareState,
} from "./shareApi";

export function ResultShareControls(props: {
  publicToken: string | null;
  orderId: string | null;
  productKey: string;
}) {
  const { publicToken, orderId, productKey } = props;
  const [share, setShare] = useState<OwnerShareState | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicToken) return;
    let cancelled = false;
    void getOwnerResultShare(publicToken)
      .then((data) => {
        if (!cancelled) setShare(data);
      })
      .catch(() => {
        if (!cancelled) setShare({ ok: true, share_enabled: false, generation_id: null });
      });
    return () => {
      cancelled = true;
    };
  }, [publicToken]);

  async function enable() {
    if (!publicToken) return;
    setBusy(true);
    setError(null);
    try {
      const next = await enableResultShare(publicToken);
      setShare(next);
      void trackChristmasEvent("result_share_enabled", {
        productKey,
        orderId,
        metadata: { generation_id: next.generation_id },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable share");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!publicToken) return;
    setBusy(true);
    setError(null);
    try {
      const next = await revokeResultShare(publicToken);
      setShare(next);
      setHint(null);
      void trackChristmasEvent("result_share_revoked", {
        productKey,
        orderId,
        metadata: { generation_id: next.generation_id },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke share");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!share?.share_path) return;
    const url = `${window.location.origin}${share.share_path}`;
    try {
      await navigator.clipboard.writeText(url);
      setHint("Link copied. Anyone with it can view until you revoke.");
    } catch {
      setHint(url);
    }
    void trackChristmasEvent("share", {
      productKey,
      orderId,
      metadata: { generation_id: share.generation_id, channel: "link" },
    });
  }

  const enabled = Boolean(share?.share_enabled && share.share_path);

  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-900">Public share link</p>
      <p className="text-xs text-slate-500">
        Private by default. Enabling creates a tokenized `/share` link you can revoke anytime.
      </p>
      {enabled ? (
        <div className="flex flex-col gap-2">
          <p className="break-all text-xs text-slate-600">{share?.share_path}</p>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() => void copyLink()}
            disabled={busy}
          >
            Copy share link
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
            onClick={() => void revoke()}
            disabled={busy}
          >
            {busy ? "Working…" : "Revoke share"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
          onClick={() => void enable()}
          disabled={busy || !publicToken}
        >
          {busy ? "Working…" : "Create public share link"}
        </button>
      )}
      {hint ? <p className="break-all text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
