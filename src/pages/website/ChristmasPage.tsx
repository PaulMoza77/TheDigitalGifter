import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import MainPage from "@/components/MainPage";
import { PageHead } from "@/components/PageHead";
import {
  CHRISTMAS_CATALOG_SEED,
  ctaStateForProduct,
  hubProducts,
} from "@/features/christmas/catalog";

/**
 * Christmas hub: preserves classic MainPage CTAs and adds catalog-driven suite links.
 * No fake testimonials, reviews, or purchasable Christmas checkout CTAs.
 */
export default function ChristmasPage() {
  const navigate = useNavigate();
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
      "christmas_gift_finder",
    ];
    return preferred
      .map((key) => all.find((p) => p.productKey === key))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, []);

  return (
    <>
      <PageHead
        title="Create AI Christmas Cards"
        description="Generate beautiful, personalized holiday cards and videos using AI. Choose templates, upload family photos, and create professional results in seconds."
      />
      <MainPage
        onStartCreating={() => void navigate("/generator?occasion=christmas")}
        onViewTemplates={() => void navigate("/templates?occasion=christmas")}
        createHref="/generator?occasion=christmas"
        occasion="christmas"
      />
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
