import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gift, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import ChristmasGenerations, {
  type ChristmasAccountGallery,
} from "@/components/client/ChristmasGenerations";
import { christmasFunnelApi } from "@/features/christmas-v2/api";
import { ChristmasApiError } from "@/features/christmas-v2/api";
import { CHRISTMAS_V2_ROUTE } from "@/features/christmas-v2/config";
import { accountChristmasLinks } from "@/features/christmas/accountChristmas";
import { CHRISTMAS_CATALOG_SEED } from "@/features/christmas/catalog";
import {
  productDescription,
  productName,
} from "@/features/christmas/i18n";
import { ChristmasLocaleToggle } from "@/features/christmas/i18n/ChristmasLocaleToggle";
import { useChristmasLocale } from "@/features/christmas/i18n/useChristmasLocale";
import { PageHead } from "@/components/PageHead";

/**
 * Account Christmas hub — suite navigation + V2 galleries.
 * Out of scope: /send-a-gift (primary e6f4 loop).
 */
export default function AccountChristmasPage() {
  const { locale, setLocale, t } = useChristmasLocale();
  const links = React.useMemo(
    () => accountChristmasLinks(CHRISTMAS_CATALOG_SEED),
    [],
  );
  const [galleries, setGalleries] = React.useState<ChristmasAccountGallery[]>(
    [],
  );
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void christmasFunnelApi
      .listMyChristmasGalleries()
      .then((rows) => {
        if (!cancelled) {
          setGalleries(Array.isArray(rows) ? rows : []);
        }
      })
      .catch((error) => {
        if (
          error instanceof ChristmasApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          if (!cancelled) setGalleries([]);
          return;
        }
        console.error("[AccountChristmas] galleries error:", error);
        if (!cancelled) setGalleries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <PageHead
        title={t("account.pageTitle")}
        description={t("account.pageDescription")}
        noindex
      />

      <section className="rounded-[28px] border border-white/10 bg-zinc-950/70 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/80">
              {t("account.eyebrow")}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              {t("account.heading")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              {t("account.support")}
            </p>
          </div>
          <ChristmasLocaleToggle
            locale={locale}
            onChange={setLocale}
            tone="dark"
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            asChild
            className="rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200"
          >
            <Link to={`/christmas?lang=${locale}`}>
              {t("account.hubCta")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            className="rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15"
          >
            <Link to={CHRISTMAS_V2_ROUTE}>
              <Sparkles className="mr-2 h-4 w-4" />
              {t("account.v2Cta")}
            </Link>
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-amber-300/80" />
          <h2 className="text-lg font-semibold text-white">
            {t("account.shortcutsHeading")}
          </h2>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((item) => (
            <li key={item.productKey}>
              <Link
                to={`${item.to}?lang=${locale}`}
                className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <span className="font-medium text-white">
                  {productName(locale, item.productKey, item.title)}
                </span>
                <span className="mt-1 text-sm leading-5 text-zinc-400">
                  {productDescription(locale, item.productKey, item.description)}
                </span>
                <span className="mt-3 text-xs font-medium text-amber-300/90">
                  {t("account.openArrow")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
          {t("account.kidsNote")}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          {t("account.packsHeading")}
        </h2>
        <ChristmasGenerations
          galleries={galleries}
          loading={loading}
          locale={locale}
        />
      </section>
    </div>
  );
}
