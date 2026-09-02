import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import type { ChristmasRouteShellDef } from "../routes";
import { shellExposesCheckout } from "../routes";

const STATUS_LABEL: Record<ChristmasRouteShellDef["status"], string> = {
  live_hub: "Available",
  foundation: "In development",
  coming_soon: "Coming soon",
};

export function ChristmasFeatureShell({ shell }: { shell: ChristmasRouteShellDef }) {
  const showCheckout = shellExposesCheckout(shell);

  return (
    <>
      <PageHead
        title={shell.title}
        description={shell.description}
        exactTitle={false}
      />
      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-6 py-16 text-slate-900">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          The Digital Gifter · Christmas
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{shell.title}</h1>
        <p className="mt-2 inline-flex w-fit rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
          {STATUS_LABEL[shell.status]}
        </p>
        <p className="mt-6 text-base leading-relaxed text-slate-600">{shell.description}</p>
        {!showCheckout ? (
          <p className="mt-4 text-sm text-slate-500">
            Checkout and AI generation are not available on this page yet.
          </p>
        ) : null}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/christmas"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Back to Christmas
          </Link>
          <Link
            to="/generator?occasion=christmas"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Use classic Christmas generator
          </Link>
        </div>
      </main>
    </>
  );
}
