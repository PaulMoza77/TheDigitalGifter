import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MainPage from "@/components/MainPage";
import { PageHead } from "@/components/PageHead";
import {
  CHRISTMAS_CATALOG_SEED,
  ctaStateForProduct,
  hubProducts,
} from "@/features/christmas/catalog";
import { writeSantaNameHandoff } from "@/features/christmas/santa/santaHandoff";
import { trackChristmasEvent } from "@/features/christmas/analytics";

/**
 * Christmas hub: preserves classic MainPage CTAs and adds catalog-driven suite links.
 * Includes Santa name handoff into /christmas/santa-video.
 */
export default function ChristmasPage() {
  const navigate = useNavigate();
  const [santaName, setSantaName] = useState("");
  const [santaError, setSantaError] = useState<string | null>(null);
  const products = useMemo(() => {
    const all = hubProducts(CHRISTMAS_CATALOG_SEED);
    const preferred = [
      "christmas_photo",
      "christmas_family",
      "christmas_couple",
      "christmas_pet",
      "christmas_santa_video",
      "christmas_tree",
      "christmas_advent",
      "christmas_wishlist",
      "christmas_gift_finder",
      "christmas_card",
      "christmas_messages",
    ];
    return preferred
      .map((key) => all.find((p) => p.productKey === key))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, []);

  function startSanta(e: FormEvent) {
    e.preventDefault();
    const handoff = writeSantaNameHandoff(santaName, "christmas_hub");
    if (!handoff) {
      setSantaError("Enter a first name using letters only.");
      return;
    }
    setSantaError(null);
    void trackChristmasEvent("product_selected", {
      productKey: "christmas_santa_video",
      pathname: "/christmas",
      metadata: { handoff: "name_only" },
    });
    void navigate("/christmas/santa-video");
  }

  return (
    <>
      <PageHead
        title="Christmas at The Digital Gifter"
        description="Personalized Christmas cards, free message generator, portraits, Santa video, wishlist, and gift finder — create something worth sending."
      />
      <MainPage
        onStartCreating={() => void navigate("/generator?occasion=christmas")}
        onViewTemplates={() => void navigate("/templates?occasion=christmas")}
        createHref="/generator?occasion=christmas"
        occasion="christmas"
      />

      <section
        aria-labelledby="santa-handoff-heading"
        className="mx-auto max-w-5xl px-6 pb-10"
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-[#132a22] to-[#1a0a10] p-6 text-[#F5EDE0] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/90">
            Personalized Santa Video
          </p>
          <h2
            id="santa-handoff-heading"
            className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Who should Santa talk to?
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#F5EDE0]/75 sm:text-base">
            Enter a name to start a personalized Christmas message from Santa — we’ll carry it into
            the next step so you don’t have to type it again.
          </p>
          <form className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start" onSubmit={startSanta}>
            <label className="block flex-1 text-sm">
              <span className="sr-only">Child’s first name</span>
              <input
                value={santaName}
                onChange={(e) => setSantaName(e.target.value)}
                placeholder="Emma"
                maxLength={40}
                autoComplete="off"
                className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-[#F5EDE0] placeholder:text-white/40 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/30"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-amber-300 px-6 text-sm font-semibold text-slate-950 hover:bg-amber-200"
            >
              Create their Santa message
            </button>
          </form>
          {santaError ? (
            <p role="alert" className="mt-3 text-sm text-red-200">
              {santaError}
            </p>
          ) : null}
          <p className="mt-4 text-xs text-[#F5EDE0]/55">
            Or open the{" "}
            <Link className="underline underline-offset-2" to="/christmas/santa-video">
              full Santa Video experience
            </Link>
            .
          </p>
        </div>
      </section>

      <section
        aria-label="Christmas product suite"
        className="mx-auto max-w-5xl px-6 pb-16"
      >
        <h2 className="text-xl font-semibold text-slate-900">Christmas suite</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Portrait experiences are available to try (upload → style → blurred preview). Checkout stays
          off until a production price is configured. Coming-soon items are not purchasable.
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {products.map((product) => {
            const cta = ctaStateForProduct(product);
            return (
              <li
                key={product.productKey}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-slate-900">{product.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{product.description}</p>
                    {product.productKey === "christmas_pet" ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Prefer{" "}
                        <Link className="underline" to="/christmas/dogs">
                          Dogs
                        </Link>{" "}
                        or{" "}
                        <Link className="underline" to="/christmas/cats">
                          Cats
                        </Link>{" "}
                        for species-checked uploads.
                      </p>
                    ) : null}
                    {cta === "open" && !product.packages.some((p) => p.purchasable) ? (
                      <p className="mt-2 text-xs text-amber-800">
                        {product.productKey === "christmas_santa_video"
                          ? "Preview / not yet available to purchase"
                          : product.productKey === "christmas_advent"
                            ? "Starts December 1 · claims gated until season"
                            : product.productKey === "christmas_tree"
                              ? "Free experience · shareable after you enable it"
                              : product.productKey === "christmas_wishlist"
                                ? "Create Your Christmas Wishlist"
                                : product.productKey === "christmas_gift_finder"
                                  ? "Find the Perfect Christmas Gift"
                                  : product.productKey === "christmas_card"
                                    ? "Create a card with your photo and message"
                                    : product.productKey === "christmas_messages"
                                      ? "Find the right words for anyone on your Christmas list"
                                      : "Experience open · purchase not enabled yet"}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-500">
                    {cta === "open" ? "Open" : "Soon"}
                  </span>
                </div>
                <Link
                  to={product.routePath}
                  className="mt-4 inline-flex text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
                >
                  {cta === "open" ? "Open" : "View status"} →
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
