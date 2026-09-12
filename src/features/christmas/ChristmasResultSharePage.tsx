import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { getSharedResult, type SharedResult } from "./share/shareApi";
import { isGenerationId, productCtaForShare } from "./share/shareLogic";
import { readResultShareToken } from "./share/shareTokenStore";
import { trackResultShareEvent } from "./share/shareAnalytics";

type Mode = "loading" | "ready" | "unavailable";

export default function ChristmasResultSharePage() {
  const route = useParams<{ generationId?: string; slug?: string }>();
  const generationId = (route.generationId || route.slug || "").trim();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>("loading");
  const [result, setResult] = useState<SharedResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = isGenerationId(generationId)
      ? readResultShareToken(generationId, params.toString())
      : null;
    if (!isGenerationId(generationId) || !token) {
      setMode("unavailable");
      return;
    }
    void getSharedResult(generationId, token)
      .then((data) => {
        if (cancelled || !data.resultUrl) return;
        setResult(data);
        setMode("ready");
        void trackResultShareEvent("shared_result_view", {
          productKey: data.product_key,
          generationId: data.generation_id,
          metadata: {
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
  }, [generationId, params]);

  const cta = productCtaForShare(result?.product_key);
  const isVideo = result?.asset_kind === "video";

  if (mode === "unavailable") {
    return (
      <>
        <PageHead title="Shared result unavailable" description="This Christmas result is private or the share link was revoked." exactTitle noindex />
        <main className="mx-auto min-h-[60vh] max-w-lg px-4 py-16 text-center text-white">
          <h1 className="text-2xl font-semibold">This share is unavailable</h1>
          <p className="mt-3 text-sm text-white/70">The result is private by default. Ask the sender for a fresh link, or create your own.</p>
          <Link to="/christmas/photo-generator" className="mt-6 inline-block rounded-md bg-white px-4 py-3 text-sm font-medium text-black">
            Create your Christmas portrait
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHead title="A Christmas result is waiting" description="Someone shared a private Christmas creation from The Digital Gifter." exactTitle noindex />
      <main className="mx-auto min-h-[60vh] max-w-lg px-4 py-10 text-white">
        <p className="text-xs font-medium uppercase tracking-wide text-white/50">The Digital Gifter · Shared result</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">A Christmas result</h1>
        <p className="mt-2 text-sm text-white/70">Private capability share · the creator can revoke or rotate this link anytime.</p>
        {mode === "loading" ? (
          <p className="mt-8 text-sm text-white/50">Loading…</p>
        ) : result?.resultUrl ? (
          <section className="mt-8 space-y-4">
            {isVideo ? (
              <video src={result.resultUrl} controls playsInline className="aspect-video w-full rounded-lg bg-black" />
            ) : (
              <img src={result.resultUrl} alt="Shared Christmas result" className="w-full rounded-lg" referrerPolicy="no-referrer" />
            )}
            {result.style_key ? <p className="text-sm text-white/70">Style: {result.style_key.replace(/_/g, " ")}</p> : null}
            <Link to={cta.to} className="block rounded-md bg-white px-4 py-3 text-center text-sm font-medium text-black">
              {cta.label}
            </Link>
          </section>
        ) : null}
      </main>
    </>
  );
}
