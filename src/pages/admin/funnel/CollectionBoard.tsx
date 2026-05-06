import React from "react";
import {
  Eye,
  EyeOff,
  GripVertical,
  LayoutGrid,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
} from "lucide-react";

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
import type { MainCategory, MainCategoryConfig, OccasionGroup } from "./types";

type Props = {
  loading: boolean;
  boardSearch: string;
  setBoardSearch: (value: string) => void;
  mainCategories: MainCategoryConfig[];
  collectionsByCategory: Record<MainCategory, OccasionGroup[]>;
  draggedSlug: string | null;
  setDraggedSlug: (slug: string | null) => void;
  savingCollectionSlug: string | null;
  setSelectedSlug: (slug: string) => void;
  openCreateCollection: (category?: MainCategory) => void;
  openEditCollection: (slug: string) => void;
  moveCollectionToCategory: (slug: string, category: MainCategory) => void;
  toggleCollectionActive: (slug: string, next: boolean) => void;
  toggleCollectionTrending: (slug: string, next: boolean) => void;
};

export default function CollectionBoard({
  loading,
  boardSearch,
  setBoardSearch,
  mainCategories,
  collectionsByCategory,
  draggedSlug,
  setDraggedSlug,
  savingCollectionSlug,
  setSelectedSlug,
  openCreateCollection,
  openEditCollection,
  moveCollectionToCategory,
  toggleCollectionActive,
  toggleCollectionTrending,
}: Props) {
  return (
    <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutGrid className="h-4 w-4 text-[#ffd976]" />
          Category Board
        </CardTitle>

        <CardDescription className="text-slate-400">
          Drag & drop o colecție între coloane pentru a o muta între Occasions,
          Personal, Spiritual și Pets.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

          <Input
            value={boardSearch}
            onChange={(event) => setBoardSearch(event.target.value)}
            placeholder="Search collection or category..."
            className="rounded-xl border-slate-800 bg-slate-900 pl-9 text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          {mainCategories.map((column) => {
            const Icon = column.icon;
            const items = collectionsByCategory[column.key];

            return (
              <Card
                key={column.key}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();

                  const droppedSlug =
                    draggedSlug ||
                    event.dataTransfer.getData("text/plain") ||
                    "";

                  setDraggedSlug(null);

                  if (!droppedSlug) return;

                  moveCollectionToCategory(droppedSlug, column.key);
                }}
                className="min-h-[460px] rounded-2xl border-slate-800 bg-slate-900/40 text-slate-50"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Icon className="h-4 w-4 text-[#ffd976]" />
                        {column.label}
                      </CardTitle>

                      <CardDescription className="mt-1 text-slate-400">
                        {column.description}
                      </CardDescription>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                      onClick={() => openCreateCollection(column.key)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <Badge className="mt-2 w-fit rounded-xl border border-slate-800 bg-slate-950 text-slate-200">
                    {items.length} collections
                  </Badge>
                </CardHeader>

                <CardContent className="space-y-3">
                  {loading ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-400">
                      Loading...
                    </div>
                  ) : items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 p-6 text-center text-sm text-slate-500">
                      Drop collections here
                    </div>
                  ) : (
                    items.map((item) => {
                      const isSaving = savingCollectionSlug === item.slug;

                      return (
                        <div
                          key={item.slug}
                          draggable
                          onDragStart={(event) => {
                            setDraggedSlug(item.slug);
                            event.dataTransfer.setData("text/plain", item.slug);
                            event.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDraggedSlug(null)}
                          className={cn(
                            "group cursor-grab rounded-2xl border border-slate-800 bg-slate-950/80 p-3 transition active:cursor-grabbing",
                            "hover:border-slate-700 hover:bg-slate-950",
                            isSaving && "opacity-60"
                          )}
                        >
                          <div className="flex gap-3">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                              {item.previewUrl ? (
                                <img
                                  src={item.previewUrl}
                                  alt={item.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Sparkles className="h-5 w-5 text-slate-500" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedSlug(item.slug)}
                                  className="min-w-0 text-left"
                                >
                                  <div className="truncate text-sm font-semibold text-slate-50">
                                    {item.title}
                                  </div>

                                  <div className="truncate text-xs text-slate-500">
                                    {item.slug}
                                  </div>
                                </button>

                                <GripVertical className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-slate-300" />
                              </div>

                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <Badge className="rounded-lg border border-slate-800 bg-slate-900 text-[10px] text-slate-300">
                                  {item.total} templates
                                </Badge>

                                <Badge className="rounded-lg border border-slate-800 bg-emerald-950/30 text-[10px] text-emerald-200">
                                  {item.active} active
                                </Badge>

                                {item.isTrending ? (
                                  <Badge className="rounded-lg border border-amber-500/20 bg-amber-950/30 text-[10px] text-amber-200">
                                    trending
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <Separator className="my-3 bg-slate-800" />

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              {item.isActive ? (
                                <Eye className="h-3.5 w-3.5 text-emerald-300" />
                              ) : (
                                <EyeOff className="h-3.5 w-3.5 text-rose-300" />
                              )}
                              {item.isActive ? "Visible" : "Hidden"}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleCollectionTrending(
                                    item.slug,
                                    !item.isTrending
                                  )
                                }
                                className={cn(
                                  "rounded-lg border px-2 py-1 text-xs transition",
                                  item.isTrending
                                    ? "border-amber-400/30 bg-amber-500/15 text-amber-200"
                                    : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                                )}
                              >
                                <Star className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => openEditCollection(item.slug)}
                                className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              <Switch
                                checked={item.isActive}
                                onCheckedChange={(value) =>
                                  toggleCollectionActive(item.slug, value)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}