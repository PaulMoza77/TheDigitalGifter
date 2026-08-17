import { Download, PawPrint, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ClientEmptyState from "@/components/client/ClientEmptyState";
import type { PetAccountGallery } from "@/features/pet/types";
import { downloadFromUrl, sharePortrait } from "@/features/pet/shareDownload";

function orderPath(orderUrl: string) {
  try {
    const parsed = new URL(orderUrl, "https://www.thedigitalgifter.com");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/account/dashboard";
  }
}

export default function PetsGenerations({
  galleries,
  loading,
}: {
  galleries: PetAccountGallery[];
  loading?: boolean;
}) {
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
        description="Sign in with the same email used at checkout. Generated portraits appear here with download and share."
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
          <p className="mt-1 text-sm text-zinc-400">Download or share each portrait. Same email as checkout.</p>
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
                  {gallery.clips.some((clip) => clip.ready) ? ` · ${gallery.clips.filter((clip) => clip.ready).length} clips` : ""}
                </p>
              </div>
              <Link to={orderPath(gallery.orderUrl)} className="text-sm text-amber-200 hover:underline">
                Open order
              </Link>
            </div>

            {gallery.portraits.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {gallery.portraits.map((portrait) => (
                  <figure key={`${gallery.orderId}-${portrait.sceneId}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                    <img
                      src={portrait.previewUrl}
                      alt={`${portrait.title} portrait of ${gallery.petName}`}
                      className="aspect-[3/4] w-full object-cover"
                    />
                    <figcaption className="space-y-2 p-2">
                      <p className="truncate text-xs font-medium text-white">{portrait.title}</p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 flex-1 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200"
                          onClick={() => void downloadFromUrl(portrait.downloadUrl, portrait.fileName)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
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
                    <video src={clip.previewUrl || undefined} controls playsInline className="aspect-video w-full bg-black" />
                    <div className="flex items-center justify-between gap-2 p-3">
                      <p className="text-sm text-white">{clip.title}</p>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200"
                        onClick={() => clip.downloadUrl && void downloadFromUrl(clip.downloadUrl, clip.fileName)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
