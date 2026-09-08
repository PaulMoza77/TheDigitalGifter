import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MainPage from "@/components/MainPage";
import { PageHead } from "@/components/PageHead";
import { supabase } from "@/lib/supabase";
import {
  CHRISTMAS_CATALOG_SEED,
  ctaStateForProduct,
  hubProducts,
} from "@/features/christmas/catalog";
import { trackChristmasEventOnce } from "@/features/christmas/analytics";
import { ChristmasCountdownJoin } from "@/features/christmas-countdown/ChristmasCountdownJoin";
import {
  CHRISTMAS_COUNTDOWN_DEFAULTS,
  publicConfigFromUnknown,
  type ChristmasCountdownPublicConfig,
} from "@/features/christmas-countdown/defaults";
import { takeChristmasJoinPending } from "@/features/christmas-countdown/joinAuth";
import { captureChristmasCountdownAttribution } from "@/features/christmas-countdown/utm";

const RETURN_FLAG = "tdg.christmas.hub.seen.v1";
const RETURN_SESSION = "tdg.christmas.hub.return.session.v1";

/**
 * Christmas hub: preserves classic MainPage CTAs and adds catalog-driven suite links.
 * Copy/countdown/signup are config-driven with hardcoded fallbacks if the config request fails.
 */
export default function ChristmasPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<ChristmasCountdownPublicConfig>({ ...CHRISTMAS_COUNTDOWN_DEFAULTS });
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

  useEffect(() => {
    captureChristmasCountdownAttribution(window.location.search);
    void trackChristmasEventOnce("christmas_page_view", {
      productKey: "christmas_countdown",
      pathname: "/christmas",
    });
    try {
      const seen = window.localStorage.getItem(RETURN_FLAG);
      if (seen && !window.sessionStorage.getItem(RETURN_SESSION)) {
        window.sessionStorage.setItem(RETURN_SESSION, "1");
        void trackChristmasEventOnce("christmas_return_visit", {
          productKey: "christmas_countdown",
          pathname: "/christmas",
        });
      }
      window.localStorage.setItem(RETURN_FLAG, "1");
    } catch {
      /* private mode */
    }
    if (takeChristmasJoinPending()) {
      const url = new URL(window.location.href);
      url.searchParams.set("join", "google");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabase.rpc("public_christmas_countdown_config");
        if (cancelled) return;
        if (error) {
          const res = await fetch("/api/christmas-countdown-config");
          if (!res.ok) return;
          const json = (await res.json()) as { config?: unknown };
          if (!cancelled) setConfig(publicConfigFromUnknown(json.config));
          return;
        }
        setConfig(publicConfigFromUnknown(data));
      } catch {
        if (!cancelled) setConfig({ ...CHRISTMAS_COUNTDOWN_DEFAULTS });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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
        headline={config.headline}
        supportingCopy={config.supportingCopy}
        ctaText={config.ctaText}
        belowCta={<ChristmasCountdownJoin config={config} />}
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
