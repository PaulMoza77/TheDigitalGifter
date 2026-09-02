import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import ClientEmptyState from "@/components/client/ClientEmptyState";
import { CHRISTMAS_V2_ROUTE } from "@/features/christmas-v2/config";

export type ChristmasAccountGallery = {
  orderId: string;
  publicToken: string;
  packKey: string;
  packName: string;
  status: string;
  createdAt: string;
  imageCount: number;
  videoCount: number;
  scenes: Array<{
    sceneKey: string;
    title: string;
    status: string;
    imageUrl?: string | null;
  }>;
  videos: Array<{
    id: string;
    sourceSceneKey: string;
    status: string;
    videoUrl?: string | null;
  }>;
};

function packLabel(packKey: string) {
  if (packKey === "magic") return "Magic Pack";
  if (packKey === "ultimate") return "Ultimate Pack";
  return "Starter Pack";
}

export default function ChristmasGenerations({
  galleries,
  loading,
}: {
  galleries: ChristmasAccountGallery[];
  loading?: boolean;
}) {
  if (loading && galleries.length === 0) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-zinc-950/70 p-5 text-sm text-zinc-400">
        Loading Christmas portraits…
      </div>
    );
  }

  if (galleries.length === 0) {
    return (
      <ClientEmptyState
        title="No Christmas packs yet"
        description="Create your first $3 Christmas portrait pack."
        ctaLabel="Try Christmas AI Photos"
        ctaTo={CHRISTMAS_V2_ROUTE}
      />
    );
  }

  return (
    <div className="space-y-4">
      {galleries.map((gallery) => (
        <article
          key={gallery.orderId}
          className="rounded-[24px] border border-white/10 bg-zinc-950/70 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-amber-300/80">Christmas</p>
              <h3 className="text-base font-semibold text-white">
                {gallery.packName || packLabel(gallery.packKey)}
              </h3>
              <p className="mt-1 text-xs text-zinc-400">
                {new Date(gallery.createdAt).toLocaleDateString()} · {gallery.status} ·{" "}
                {gallery.imageCount} photos
                {gallery.videoCount ? ` · ${gallery.videoCount} videos` : ""}
              </p>
            </div>
            <Link
              to={`/christmas-ai-photos/order?token=${encodeURIComponent(gallery.publicToken)}`}
              className="text-sm text-amber-300 underline-offset-2 hover:underline"
            >
              Open results
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {gallery.scenes
              .filter((s) => s.imageUrl)
              .slice(0, 8)
              .map((scene) => (
                <a
                  key={scene.sceneKey}
                  href={scene.imageUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative overflow-hidden rounded-xl"
                >
                  <img src={scene.imageUrl || ""} alt={scene.title} className="aspect-[3/4] w-full object-cover" />
                  <span className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100">
                    <Download className="h-3.5 w-3.5" />
                  </span>
                </a>
              ))}
          </div>
        </article>
      ))}
    </div>
  );
}
