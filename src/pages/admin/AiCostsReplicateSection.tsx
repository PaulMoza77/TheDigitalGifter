import React from "react";
import { ExternalLink, Info } from "lucide-react";
import { StatCard, SectionCard } from "@/components/admin/overview/AdminOverviewCards";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AI_COST_SCOPE_LABEL,
  AI_COST_TOOLTIP,
  GROSS_AFTER_AI_DISCLAIMER,
  REPLICATE_BILLING_URL,
  formatUsd,
  type AdminAiCostReport,
} from "@/features/pet/aiCost";

type Props = {
  loading: boolean;
  report: Pick<AdminAiCostReport, "cards" | "breakdown" | "scope" | "tooltip" | "disclaimer" | "billingUrl"> | null;
};

function BreakdownTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string>>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={`${row[0]}-${index}`} className="border-t border-slate-800">
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`} className="px-3 py-2 text-slate-200">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-3 text-slate-500" colSpan={headers.length}>
                No tracked pet-funnel Replicate usage in this range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AiCostsReplicateSection({ loading, report }: Props) {
  const cards = report?.cards;
  const breakdown = report?.breakdown;

  return (
    <section className="mb-6 rounded-3xl border border-cyan-400/20 bg-slate-900/40 p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-50">AI Costs — Replicate</h2>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full p-1 text-slate-400 hover:text-slate-200"
                    aria-label={AI_COST_TOOLTIP}
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm bg-slate-800 text-slate-100">
                  {AI_COST_TOOLTIP}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {AI_COST_SCOPE_LABEL}. Amounts below are USD and are not mixed with the EUR credit-pack metrics.
          </p>
        </div>
        <a
          href={REPLICATE_BILLING_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:underline"
        >
          Replicate billing
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Replicate cost — selected period"
          value={loading || !cards ? "..." : formatUsd(cards.replicateCostPeriodUsd)}
          helper="USD · tracked pet-funnel usage"
        />
        <StatCard
          label="Replicate cost — today"
          value={loading || !cards ? "..." : formatUsd(cards.replicateCostTodayUsd)}
          helper="USD · UTC today"
        />
        <StatCard
          label="Pet revenue — selected period"
          value={loading || !cards ? "..." : formatUsd(cards.petRevenuePeriodUsd)}
          helper="USD · paid pet orders"
        />
        <StatCard
          label="Gross after AI cost"
          value={loading || !cards ? "..." : formatUsd(cards.grossAfterAiUsd)}
          helper={GROSS_AFTER_AI_DISCLAIMER}
        />
        <StatCard
          label="Average AI cost per paid pet order"
          value={loading || !cards ? "..." : formatUsd(cards.avgAiCostPerPaidPetOrderUsd)}
          helper="USD · paid pet orders in range"
        />
        <StatCard
          label="Average cost per successful portrait"
          value={loading || !cards ? "..." : formatUsd(cards.avgCostPerSuccessfulPortraitUsd)}
          helper="USD · succeeded predictions"
        />
        <StatCard
          label="Retry/regeneration cost"
          value={loading || !cards ? "..." : formatUsd(cards.retryRegenerationCostUsd)}
          helper="USD · attempt number > 1"
        />
        <StatCard
          label="Image generation spend"
          value={loading || !cards ? "..." : formatUsd(cards.imageGenerationSpendUsd ?? cards.replicateCostPeriodUsd)}
          helper="USD · Kontext Pro portraits"
        />
        <StatCard
          label="Video generation spend"
          value={loading || !cards ? "..." : formatUsd(cards.videoGenerationSpendUsd ?? 0)}
          helper="USD · Seedance clips"
        />
        <StatCard
          label="Combined Replicate spend"
          value={loading || !cards ? "..." : formatUsd(cards.combinedSpendUsd ?? cards.replicateCostPeriodUsd)}
          helper="USD · images + videos"
        />
        <StatCard
          label="Successful video clips"
          value={loading || !cards ? "..." : String(cards.successfulVideoClips ?? 0)}
          helper="Succeeded Seedance predictions"
        />
        <StatCard
          label="Failed/canceled video attempts"
          value={loading || !cards ? "..." : String(cards.failedCanceledVideoAttempts ?? 0)}
          helper="Video predictions that did not succeed"
        />
        <StatCard
          label="Average cost per completed pet pack"
          value={loading || !cards ? "..." : formatUsd(cards.avgCostPerCompletedPetPackUsd ?? cards.avgAiCostPerPaidPetOrderUsd)}
          helper="USD · complete paid orders"
        />
        <StatCard
          label="Projected full pack cost"
          value={loading || !cards ? "..." : formatUsd(cards.projectedStandardPackCostUsd)}
          helper="USD · $0.48 images + $0.25 videos = $0.73"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="By date" subtitle="USD totals for tracked pet-funnel predictions.">
          <BreakdownTable
            headers={["Date", "Predictions", "USD"]}
            rows={(breakdown?.byDate || []).map((row) => [row.date, String(row.count), formatUsd(row.costUsd)])}
          />
        </SectionCard>
        <SectionCard title="By model" subtitle="Tariff snapshot is stored per prediction.">
          <BreakdownTable
            headers={["Model", "Predictions", "USD"]}
            rows={(breakdown?.byModel || []).map((row) => [row.model, String(row.count), formatUsd(row.costUsd)])}
          />
        </SectionCard>
        <SectionCard title="Succeeded / failed / canceled" subtitle="Provider status from the signed webhook.">
          <BreakdownTable
            headers={["Status", "Predictions", "USD"]}
            rows={(breakdown?.byStatus || []).map((row) => [row.status, String(row.count), formatUsd(row.costUsd)])}
          />
        </SectionCard>
        <SectionCard title="Original vs retries" subtitle="Every retry is a separate prediction and cost.">
          <BreakdownTable
            headers={["Kind", "Predictions", "USD"]}
            rows={(breakdown?.byAttemptKind || []).map((row) => [row.kind, String(row.count), formatUsd(row.costUsd)])}
          />
        </SectionCard>
      </div>

      <div className="mt-5">
        <SectionCard title="By order" subtitle="Pet revenue minus tracked Replicate cost for that order.">
          <BreakdownTable
            headers={["Pet", "Email", "Revenue USD", "Replicate USD", "Gross after AI"]}
            rows={(breakdown?.byOrder || []).map((row) => [
              row.petName || row.orderId,
              row.email,
              formatUsd(row.revenueUsd),
              formatUsd(row.costUsd),
              formatUsd(row.grossAfterAiUsd),
            ])}
          />
        </SectionCard>
      </div>
    </section>
  );
}
