import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import MainPage from "@/components/MainPage";
import { PageHead } from "@/components/PageHead";
import {
  CHRISTMAS_CATALOG_SEED,
  ctaStateForProduct,
  hubProducts,
} from "@/features/christmas/catalog";
import { ChristmasLocaleToggle } from "@/features/christmas/i18n/ChristmasLocaleToggle";
import { useChristmasLocale } from "@/features/christmas/i18n/useChristmasLocale";
import {
  productDescription,
  productName,
} from "@/features/christmas/i18n";

/**
 * Christmas hub: preserves classic MainPage CTAs and adds catalog-driven suite links.
 * No fake testimonials, reviews, or purchasable Christmas checkout CTAs.
 */
export default function ChristmasPage() {
  const navigate = useNavigate();
  const { locale, setLocale, t } = useChristmasLocale();
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

  return (
    <>
      <PageHead
        title={t("hub.pageTitle")}
        description={t("hub.pageDescription")}
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {t("hub.suiteHeading")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {t("hub.suiteSupport")}
            </p>
          </div>
          <ChristmasLocaleToggle locale={locale} onChange={setLocale} />
        </div>
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">{t("hub.guidesHeading")}</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            <li>
              <Link className="underline" to="/christmas/gifts-for-mom">
                Gifts for Mom
              </Link>
            </li>
            <li>
              <Link className="underline" to="/christmas/messages-for-mom">
                Messages for Mom
              </Link>
            </li>
            <li>
              <Link className="underline" to="/christmas/funny-christmas-messages">
                Funny Christmas messages
              </Link>
            </li>
            <li>
              <Link className="underline" to="/christmas/family-christmas-photos">
                Family Christmas photos
              </Link>
            </li>
            <li>
              <Link className="underline" to="/christmas/personalized-christmas-cards">
                Personalized Christmas cards
              </Link>
            </li>
            <li>
              <Link className="underline" to="/christmas/personalized-santa-video">
                Personalized Santa video
              </Link>
            </li>
            <li>
              <Link className="underline" to="/ro/christmas/cadouri-de-craciun-pentru-mama">
                Cadouri pentru mama (RO)
              </Link>
            </li>
          </ul>
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {products.map((product) => {
            const cta = ctaStateForProduct(product);
            const name = productName(locale, product.productKey, product.name);
            const description = productDescription(
              locale,
              product.productKey,
              product.description,
            );
            return (
              <li
                key={product.productKey}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-slate-900">{name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{description}</p>
                    {product.productKey === "christmas_pet" ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {locale === "ro" ? "Preferă " : "Prefer "}
                        <Link className="underline" to={`/christmas/dogs?lang=${locale}`}>
                          {t("hub.dogs")}
                        </Link>{" "}
                        {locale === "ro" ? "sau " : "or "}
                        <Link className="underline" to={`/christmas/cats?lang=${locale}`}>
                          {t("hub.cats")}
                        </Link>{" "}
                        {locale === "ro"
                          ? "pentru verificarea speciilor."
                          : "for species-checked uploads."}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-500">
                    {cta === "open" ? t("common.open") : t("common.soon")}
                  </span>
                </div>
                <Link
                  to={`${product.routePath}?lang=${locale}`}
                  className="mt-4 inline-flex text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
                >
                  {cta === "open" ? t("common.open") : t("common.viewStatus")} →
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
