import { useMemo, useState } from "react";
import { Download, LockOpen, PawPrint, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ClientEmptyState from "@/components/client/ClientEmptyState";
import { petFunnelApi } from "@/features/pet/supabaseApi";
import { PortraitUpsellSheet } from "@/features/pet/components/PortraitUpsellSheet";
import type {
  PetAccountGallery,
  PetAccountPortrait,
  PetSceneResult,
  PetSceneUpsellView,
} from "@/features/pet/types";
import { downloadFromUrl, sharePortrait } from "@/features/pet/shareDownload";
import { UPSELL_UNLOCK_LABEL } from "@/features/pet/upsellUi";

function orderPath(orderUrl: string) {
  try {
    const parsed = new URL(orderUrl, "https://www.thedigitalgifter.com");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/account/dashboard";
  }
}

function toSceneResult(portrait: PetAccountPortrait): PetSceneResult {
  return {
    sceneId: portrait.sceneId,
    title: portrait.title,
    status: "ready",
    previewUrl: portrait.previewUrl,
    assets: [
      {
        format: "high_res",
        label: "Portrait",
        url: portrait.downloadUrl,
        mimeType: "image/jpeg",
        width: portrait.width,
        height: portrait.height,
        dpi: null,
        ready: true,
      },
    ],
  };
}

export default function PetsGenerations({
  galleries,
  loading,
  onRefresh,
}: {
  galleries: PetAccountGallery[];
  loading?: boolean;
  onRefresh?: () => void | Promise<void>;
}) {
  const [active, setActive] = useState<{
    gallery: PetAccountGallery;
    portrait: PetAccountPortrait;
  } | null>(null);

  const activeSceneUpsell = useMemo((): PetSceneUpsellView | null => {
    if (!active) return null;
    return (
      active.gallery.upsells?.sceneUpsells.find((item) => item.sceneKey === active.portrait.sceneId) ??
      null
    );
  }, [active]);

  if (loading && galleries.length === 0) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-zinc-950/70 p-5 text-sm text-zinc-400">
        Loading pet portraits…
      </div>
    );
  }

  if (galleries.length === 0) {
    return (
      <ClientEmptyState
        title="No pet portraits yet"
        description="Sign in with the same email used at checkout. Your portraits appear here with download, share, and unlock options."
        ctaLabel="Create pet portraits"
        ctaTo="/pet"
      />
    );
  }

  return (
    <section className="rounded-[24px] border border-white/10 bg-zinc-950/70 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] sm:rounded-[28px] sm:p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">
            <PawPrint className="h-3.5 w-3.5" />
            Pets generations
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">Your pet portraits</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Tap <span className="font-medium text-amber-200">{UPSELL_UNLOCK_LABEL}</span> for gift
            packs, print files, or a 3-scene retry.
          </p>
        </div>
        <Button
          asChild
          variant="secondary"
          className="rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15"
        >
          <Link to="/pet">New pet order</Link>
        </Button>
      </div>

      <div className="space-y-8">
        {galleries.map((gallery) => (
          <article key={gallery.orderId} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-white">{gallery.petName}’s gallery</h3>
                <p className="text-xs text-zinc-500">
                  {gallery.portraits.length} portraits
                  {gallery.clips.some((clip) => clip.ready)
                    ? ` · ${gallery.clips.filter((clip) => clip.ready).length} clips`
                    : ""}
                </p>
              </div>
              <Link to={orderPath(gallery.orderUrl)} className="text-sm text-amber-200 hover:underline">
                Open order
              </Link>
            </div>

            {gallery.portraits.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {gallery.portraits.map((portrait) => (
                  <figure
                    key={`${gallery.orderId}-${portrait.sceneId}`}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                  >
                    <div className="relative">
                      <img
                        src={portrait.previewUrl}
                        alt={`${portrait.title} portrait of ${gallery.petName}`}
                        className="aspect-[3/4] w-full object-cover"
                      />
                      {gallery.publicToken && gallery.upsells ? (
                        <button
                          type="button"
                          onClick={() => setActive({ gallery, portrait })}
                          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-zinc-950 shadow-lg transition hover:bg-amber-300"
                        >
                          <LockOpen className="h-3 w-3" aria-hidden="true" />
                          {UPSELL_UNLOCK_LABEL}
                        </button>
                      ) : null}
                    </div>
                    <figcaption className="space-y-2 p-2">
                      <p className="truncate text-xs font-medium text-white">{portrait.title}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200"
                          onClick={() => void downloadFromUrl(portrait.downloadUrl, portrait.fileName)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 rounded-xl border border-white/10 bg-white/10 text-white hover:bg-white/15"
                          onClick={async () => {
                            const result = await sharePortrait({
                              url: portrait.previewUrl,
                              title: `${gallery.petName} — ${portrait.title}`,
                              text: `${gallery.petName}’s ${portrait.title} portrait`,
                              fileName: portrait.fileName,
                              pageUrl: gallery.orderUrl,
                            });
                            if (result === "copied") toast.success("Link copied");
                            if (result === "shared") toast.success("Ready to share");
                          }}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          Share
                        </Button>
                      </div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Portraits are still generating.</p>
            )}

            {gallery.clips.some((clip) => clip.ready) ? (
              <div className="grid gap-3 md:grid-cols-2">
                {gallery.clips.filter((clip) => clip.ready && clip.previewUrl).map((clip) => (
                  <article key={clip.id} className="overflow-hidden rounded-2xl border border-white/10">
                    <video
                      src={clip.previewUrl || undefined}
                      controls
                      playsInline
                      className="aspect-video w-full bg-black"
                    />
                    <div className="flex items-center justify-between gap-2 p-3">
                      <p className="text-sm text-white">{clip.title}</p>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200"
                        onClick={() => clip.downloadUrl && void downloadFromUrl(clip.downloadUrl, clip.fileName)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Save
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {active?.gallery.publicToken ? (
        <PortraitUpsellSheet
          open={Boolean(active)}
          onOpenChange={(open) => {
            if (!open) setActive(null);
          }}
          scene={toSceneResult(active.portrait)}
          sceneUpsell={activeSceneUpsell}
          petName={active.gallery.petName}
          publicToken={active.gallery.publicToken}
          api={petFunnelApi}
          upsells={active.gallery.upsells}
          allScenes={active.gallery.portraits.map(toSceneResult)}
          onPurchased={onRefresh}
        />
      ) : null}
    </section>
  );
}
