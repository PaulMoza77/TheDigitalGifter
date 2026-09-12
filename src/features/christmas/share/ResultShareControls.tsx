import { useEffect, useState } from "react";
import {
  enableResultShare,
  getOwnerResultShare,
  revokeResultShare,
  type OwnerShareState,
} from "./shareApi";
import { trackResultShareEvent } from "./shareAnalytics";

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
      setHint(next.share_path ? "Fresh private capability link created. Copy it now; the server stores only its hash." : null);
      await trackResultShareEvent("result_share_enabled", {
        productKey,
        orderId,
        generationId: next.generation_id,
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
      setHint("Share revoked. The old link no longer works.");
      await trackResultShareEvent("result_share_revoked", {
        productKey,
        orderId,
        generationId: next.generation_id,
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
      setHint("Link copied. Anyone with it can view until you revoke or rotate it.");
    } catch {
      setHint(url);
    }
    await trackResultShareEvent("result_share_copied", {
      productKey,
      orderId,
      generationId: share.generation_id,
    });
  }

  const hasCopyableLink = Boolean(share?.share_enabled && share.share_path);
  const activeButTokenNotRecoverable = Boolean(share?.share_enabled && !share.share_path);

  return (
    <div className="space-y-2 rounded-xl border border-white/15 bg-black/80 p-3 text-white shadow-xl backdrop-blur">
      <p className="text-sm font-medium">Private share link</p>
      <p className="text-xs text-white/65">
        Off by default. The share token is never stored in recoverable form and can be revoked anytime.
      </p>
      {activeButTokenNotRecoverable ? (
        <p className="text-xs text-amber-200">
          A share is active. Create a fresh link to rotate the token and copy the new URL, or revoke it.
        </p>
      ) : null}
      {hasCopyableLink ? (
        <p className="break-all text-xs text-white/70">{share?.share_path}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {hasCopyableLink ? (
          <button type="button" className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-black" onClick={() => void copyLink()} disabled={busy}>
            Copy link
          </button>
        ) : null}
        <button type="button" className="rounded-md border border-white/30 px-3 py-2 text-xs font-semibold" onClick={() => void enable()} disabled={busy || !publicToken}>
          {busy ? "Working…" : share?.share_enabled ? "Create fresh link" : "Create share link"}
        </button>
        {share?.share_enabled ? (
          <button type="button" className="rounded-md border border-red-300/50 px-3 py-2 text-xs font-semibold text-red-100" onClick={() => void revoke()} disabled={busy}>
            Revoke
          </button>
        ) : null}
      </div>
      {hint ? <p className="break-all text-xs text-white/60">{hint}</p> : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
