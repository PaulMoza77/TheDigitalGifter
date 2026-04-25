import React from "react";
import type { AdminListItem } from "@/hooks/useAdminOverview";

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

type MoneyMiniCardProps = {
  label: string;
  count: number;
  revenue: number;
};

export function MoneyMiniCard({ label, count, revenue }: MoneyMiniCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-sm font-semibold text-slate-100">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">€{revenue.toFixed(2)}</p>
      <p className="mt-1 text-xs text-slate-500">{count} orders</p>
    </div>
  );
}

type SectionCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/35 p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-50">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>

      {children}
    </section>
  );
}

type ListCardProps = {
  title: string;
  subtitle?: string;
  items: AdminListItem[];
  emptyLabel?: string;
};

export function ListCard({
  title,
  subtitle,
  items,
  emptyLabel = "No data yet",
}: ListCardProps) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              className="flex items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">
                  {item.label}
                </p>
                {item.helper ? (
                  <p className="mt-1 text-xs text-slate-500">{item.helper}</p>
                ) : null}
              </div>

              <p className="shrink-0 text-sm font-semibold text-slate-50">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-500">
          {emptyLabel}
        </div>
      )}
    </SectionCard>
  );
}