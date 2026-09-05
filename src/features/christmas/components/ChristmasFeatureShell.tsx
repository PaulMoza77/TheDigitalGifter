import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import type { ChristmasRouteShellDef } from "../routes";
import { shellExposesCheckout } from "../routes";
import { ChristmasLocaleToggle } from "../i18n/ChristmasLocaleToggle";
import { useChristmasLocale } from "../i18n/useChristmasLocale";
import type { ChristmasEnKey } from "../i18n/en";

export function ChristmasFeatureShell({ shell }: { shell: ChristmasRouteShellDef }) {
  const showCheckout = shellExposesCheckout(shell);
  const { locale, setLocale, t } = useChristmasLocale();

  const titleKey = `shell.${shell.productKey.replace("christmas_", "")}.title` as ChristmasEnKey;
  const descKey = `shell.${shell.productKey.replace("christmas_", "")}.description` as ChristmasEnKey;
  const title =
    shell.productKey === "christmas_kids" ? t("shell.kids.title") : t(titleKey) === titleKey
      ? shell.title
      : t(titleKey);
  const description =
    shell.productKey === "christmas_kids"
      ? t("shell.kids.description")
      : t(descKey) === descKey
        ? shell.description
        : t(descKey);

  const statusKey = `status.${shell.status}` as ChristmasEnKey;

  return (
    <>
      <PageHead title={title} description={description} exactTitle={false} />
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-6 py-16 text-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t("brand.eyebrow")}
          </p>
          <ChristmasLocaleToggle locale={locale} onChange={setLocale} />
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 inline-flex w-fit rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
          {t(statusKey)}
        </p>
        <p className="mt-6 text-base leading-relaxed text-slate-600">{description}</p>
        {!showCheckout ? (
          <p className="mt-4 text-sm text-slate-500">{t("common.checkoutNotOnPage")}</p>
        ) : null}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to={`/christmas?lang=${locale}`}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t("common.backToChristmas")}
          </Link>
          <Link
            to="/generator?occasion=christmas"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            {t("common.classicGenerator")}
          </Link>
        </div>
      </main>
    </>
  );
}
