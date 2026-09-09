import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { trackChristmasEvent } from "./analytics";
import { getSharedResult, type SharedResult } from "./share/shareApi";
import {
  isGenerationId,
  parseShareTokenFromSearch,
  productCtaForShare,
} from "./share/shareLogic";

type Mode = "loading" | "ready" | "unavailable";

export default function ChristmasResultSharePage() {
  const { generationId = "" } = useParams<{ generationId: string }>();
  const [params] = useSearchParams();
  const token = parseShareTokenFromSearch(params.toString());
  const [mode, setMode] = useState<Mode>("loading");
  const [result, setResult] = useState<SharedResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isGenerationId(generationId) || !token) {
      setMode("unavailable");
      return;
    }
    void getSharedResult(generationId, token)
      .then((data) => {
        if (cancelled) return;
        if (!data.resultUrl) {
          setMode("unavailable");
          return;
        }
        setResult(data);
        setMode("ready");
        void trackChristmasEvent("shared_result_view", {
          productKey: data.product_key,
          pathname: `/share/${generationId}`,
          metadata: {
            generation_id: data.generation_id,
            asset_kind: data.asset_kind,
            style_key: data.style_key,
          },
        });
      })
      .catch(() => {
        if (!cancelled) setMode("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [generationId, token]);

  const cta = productCtaForShare(result?.product_key);
  const isVideo = result?.asset_kind === "video";

  if (mode === "unavailable") {
    return (
      <>
        <PageHead
          title="Shared result unavailable"
          description="This Christmas result is private or the share link was revoked."
          exactTitle
          noindex
        />
        <main className="mx-auto min-h-[60vh] max-w-lg px-4 py-16 text-center text-slate-900">
          <h1 className="text-2xl font-semibold">This share is unavailable</h1>
          <p className="mt-3 text-sm text-slate-600">
            The result is private by default. Ask the sender for a fresh link, or create your own.
          </p>
          <Link
            to="/christmas/photo-generator"
            className="mt-6 inline-block rounded-md bg-slate-900 px-4 py-3 text-sm font-medium text-white"
          >
            Create your Christmas portrait
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="A Christmas result is waiting"
        description="Someone shared a Christmas creation from The Digital Gifter."
        exactTitle
        noindex
      />
      <main className="mx-auto min-h-[60vh] max-w-lg px-4 py-10 text-slate-900">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          The Digital Gifter · Shared result
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">A Christmas result</h1>
        <p className="mt-2 text-sm text-slate-600">
          Private share · links can be revoked anytime by the creator.
        </p>
        {mode === "loading" ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : result?.resultUrl ? (
          <section className="mt-8 space-y-4">
            {isVideo ? (
              <video
                src={result.resultUrl}
                controls
                playsInline
                className="aspect-video w-full rounded-lg bg-black"
              />
            ) : (
              <img
                src={result.resultUrl}
                alt="Shared Christmas result"
                className="w-full rounded-lg"
              />
            )}
            {result.style_key ? (
              <p className="text-sm text-slate-600">Style: {result.style_key.replace(/_/g, " ")}</p>
            ) : null}
            <Link
              to={cta.to}
              className="block rounded-md bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white"
            >
              {cta.label}
            </Link>
          </section>
        ) : null}
      </main>
    </>
  );
}
