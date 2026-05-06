import React from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import { cn } from "@/lib/utils";
import type {
  MainCategory,
  OccasionGroup,
  TemplateDbRow,
} from "./types";
import { labelForMainCategory, normalizeMainCategory, normalizeSlug } from "./utils";

type Props = {
  loading: boolean;
  selectedSlug: string;
  selectedCollection: OccasionGroup | null;
  selectedStyleStats: {
    total: number;
    active: number;
    inactive: number;
  };
  styleSearch: string;
  setStyleSearch: (value: string) => void;
  filteredStyles: TemplateDbRow[];
  getMainCategoryForSlug: (slug: string) => MainCategory;
  openCreateStyle: () => void;
  openEditStyle: (row: TemplateDbRow) => void;
  toggleStyleActive: (row: TemplateDbRow, next: boolean) => void;
  deleteStyle: (row: TemplateDbRow) => void;
  formatLabel: (value: unknown) => string;
};

export default function StylesPanel({
  loading,
  selectedSlug,
  selectedCollection,
  selectedStyleStats,
  styleSearch,
  setStyleSearch,
  filteredStyles,
  getMainCategoryForSlug,
  openCreateStyle,
  openEditStyle,
  toggleStyleActive,
  deleteStyle,
  formatLabel,
}: Props) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50 lg:col-span-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Collection & Search</CardTitle>
            <CardDescription className="text-slate-400">
              Alege o colecție și gestionează stilurile/template-urile care apar
              în Style Select.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <Input
                    value={styleSearch}
                    onChange={(event) => setStyleSearch(event.target.value)}
                    placeholder="Search styles..."
                    className="rounded-xl border-slate-800 bg-slate-900 pl-9 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-slate-800" />

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200">
                Collection: {selectedCollection?.title || formatLabel(selectedSlug)}
              </Badge>

              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200">
                Category:{" "}
                {labelForMainCategory(
                  selectedCollection?.mainCategory ||
                    getMainCategoryForSlug(selectedSlug)
                )}
              </Badge>

              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200">
                Total: {selectedStyleStats.total}
              </Badge>

              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-emerald-200">
                Active: {selectedStyleStats.active}
              </Badge>

              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-rose-200">
                Inactive: {selectedStyleStats.inactive}
              </Badge>

              {styleSearch.trim() ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                  onClick={() => setStyleSearch("")}
                >
                  Clear search
                </Button>
              ) : (
                <span className="ml-auto text-xs text-slate-500">
                  Search filters only current collection
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50 lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tip</CardTitle>
            <CardDescription className="text-slate-400">
              Collections se salvează în <b>occasion_collections</b>. Templates
              rămân în <b>templates</b>.
            </CardDescription>
          </CardHeader>

          <CardContent className="text-sm text-slate-300">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <div className="font-medium text-slate-100">Recomandare</div>

              <div className="mt-1 text-slate-400">
                Creează întâi colecția, apoi adaugă templates/stiluri în ea.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Styles</CardTitle>

              <CardDescription className="text-slate-400">
                {selectedCollection?.title || formatLabel(selectedSlug)} •{" "}
                {filteredStyles.length} shown
              </CardDescription>
            </div>

            <Button className="rounded-xl" onClick={openCreateStyle}>
              <Plus className="mr-2 h-4 w-4" />
              New style
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="py-6 text-sm text-slate-400">Loading…</div>
          ) : filteredStyles.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
              <div className="text-sm font-semibold text-slate-100">
                No styles found
              </div>

              <div className="mt-1 text-xs text-slate-400">
                Creează primul style pentru{" "}
                <b>{selectedCollection?.title || formatLabel(selectedSlug)}</b>.
              </div>

              <div className="mt-4">
                <Button className="rounded-xl" onClick={openCreateStyle}>
                  <Plus className="mr-2 h-4 w-4" />
                  New style
                </Button>
              </div>
            </div>
          ) : (
            filteredStyles.map((row) => {
              const isActive = row.is_active ?? row.isactive ?? true;

              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-semibold text-slate-50">
                        {row.title || (
                          <span className="text-slate-500">(no title)</span>
                        )}
                      </div>

                      <Badge className="rounded-xl border border-slate-800 bg-slate-950 text-slate-200">
                        {normalizeSlug(row.occasion)}
                      </Badge>

                      <Badge className="rounded-xl border border-slate-800 bg-slate-950 text-slate-200">
                        {labelForMainCategory(
                          normalizeMainCategory(row.main_category)
                        )}
                      </Badge>

                      <Badge
                        className={cn(
                          "rounded-xl border border-slate-800",
                          isActive
                            ? "bg-emerald-950/40 text-emerald-200"
                            : "bg-rose-950/30 text-rose-200"
                        )}
                      >
                        {isActive ? "active" : "inactive"}
                      </Badge>
                    </div>

                    <div className="truncate text-xs text-slate-400">
                      style_id:{" "}
                      <span className="text-slate-200">
                        {row.style_id ?? "—"}
                      </span>{" "}
                      • id: <span className="text-slate-200">{row.id}</span>
                    </div>

                    <div className="line-clamp-2 text-xs text-slate-400">
                      {row.prompt ?? (
                        <span className="text-slate-500">(no prompt)</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                      <span className="text-xs text-slate-400">Active</span>

                      <Switch
                        checked={isActive}
                        onCheckedChange={(value) =>
                          toggleStyleActive(row, value)
                        }
                      />
                    </div>

                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                      onClick={() => openEditStyle(row)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>

                    <Button
                      variant="destructive"
                      className="rounded-xl"
                      onClick={() => deleteStyle(row)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </>
  );
}