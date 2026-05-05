import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { EllipsisVerticalIcon, PenBoxIcon, Search, Trash2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { CreateTemplateDialog } from "@/domains/admin/components/CreateTemplateDialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type MainCategory = "occasions" | "personal" | "spiritual" | "pets";

type TemplateDbRow = {
  id: string;
  created_at: string | null;
  updated_at: string | null;

  title: string | null;
  prompt: string | null;

  main_category?: MainCategory | null;
  occasion: string | null;
  category: string | null;
  subcategory?: string | null;
  sub_category?: string | null;

  type: string | null;
  orientation: string | null;

  preview_url: string | null;
  thumbnail_url: string | null;
  video_url?: string | null;

  textdefault?: string | null;
  text_default?: string | null;

  defaultduration?: number | null;
  default_duration?: number | null;

  defaultaspectratio?: string | null;
  default_aspect_ratio?: string | null;

  defaultresolution?: string | null;
  default_resolution?: string | null;

  generateaudiodefault?: boolean | null;
  generate_audio_default?: boolean | null;

  negativepromptdefault?: string | null;
  negative_prompt_default?: string | null;

  creditcost?: number | null;
  credit_cost?: number | null;

  tags?: unknown;

  isactive?: boolean | null;
  is_active?: boolean | null;
};

type TemplateRow = {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;

  title: string;
  prompt: string;

  mainCategory: MainCategory | null;
  occasion: string | null;
  category: string | null;
  subCategory: string | null;

  type: "image" | "video" | string;
  orientation: "portrait" | "landscape" | string;

  previewUrl: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;

  textDefault: string | null;

  defaultDuration: number | null;
  defaultAspectRatio: string | null;
  defaultResolution: string | null;
  generateAudioDefault: boolean | null;
  negativePromptDefault: string | null;

  creditCost: number;
  tags: string[];

  isActive: boolean;
};

const MAIN_CATEGORY_OPTIONS: Array<"All categories" | MainCategory> = [
  "All categories",
  "occasions",
  "personal",
  "spiritual",
  "pets",
];

const TYPE_OPTIONS = ["All types", "Images", "Videos"];

function coerceTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeMainCategory(value: unknown): MainCategory | null {
  const key = String(value ?? "").trim().toLowerCase();

  if (
    key === "occasions" ||
    key === "personal" ||
    key === "spiritual" ||
    key === "pets"
  ) {
    return key;
  }

  return null;
}

function label(value: string | null | undefined) {
  const raw = String(value || "").trim();

  if (!raw || raw === "All categories") return raw || "Uncategorized";

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapTemplate(db: TemplateDbRow): TemplateRow {
  return {
    id: db.id,
    createdAt: db.created_at ?? null,
    updatedAt: db.updated_at ?? null,

    title: db.title ?? "",
    prompt: db.prompt ?? "",

    mainCategory: normalizeMainCategory(db.main_category),
    occasion: db.occasion,
    category: db.category,
    subCategory: db.sub_category ?? db.subcategory ?? null,

    type: (db.type ?? "image").toLowerCase(),
    orientation: (db.orientation ?? "portrait").toLowerCase(),

    previewUrl: db.preview_url ?? "",
    thumbnailUrl: db.thumbnail_url ?? null,
    videoUrl: db.video_url ?? null,

    textDefault: db.text_default ?? db.textdefault ?? null,

    defaultDuration: db.default_duration ?? db.defaultduration ?? null,
    defaultAspectRatio: db.default_aspect_ratio ?? db.defaultaspectratio ?? null,
    defaultResolution: db.default_resolution ?? db.defaultresolution ?? null,
    generateAudioDefault:
      db.generate_audio_default ?? db.generateaudiodefault ?? null,
    negativePromptDefault:
      db.negative_prompt_default ?? db.negativepromptdefault ?? null,

    creditCost:
      typeof db.credit_cost === "number"
        ? db.credit_cost
        : typeof db.creditcost === "number"
          ? db.creditcost
          : 0,

    tags: coerceTags(db.tags),

    isActive: (db.is_active ?? db.isactive) !== false,
  };
}

function StatusSwitch({
  templateId,
  isActive,
  onToggle,
  disabled,
}: {
  templateId: string;
  isActive: boolean;
  onToggle: (id: string, next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={Boolean(disabled)}
      onClick={() => onToggle(templateId, !isActive)}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-medium transition-colors",
        "border-slate-300 hover:bg-slate-800/50",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "relative inline-flex h-4 w-7 items-center rounded-full transition",
          isActive ? "bg-emerald-500/80" : "bg-slate-600",
        ].join(" ")}
      >
        <span
          className={[
            "absolute h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
            isActive ? "translate-x-3" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>

      <span className={isActive ? "text-emerald-400" : "text-slate-400"}>
        {isActive ? "Active" : "Inactive"}
      </span>
    </button>
  );
}

export default function TemplatesAdminPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const mainCategoryFilter =
    searchParams.get("main_category") || "All categories";
  const typeFilter = searchParams.get("type") || "All types";
  const searchQuery = searchParams.get("search") || "";

  async function fetchTemplates() {
    setLoading(true);

    const { data, error } = await supabase
      .from("templates")
      .select(
        [
          "id",
          "created_at",
          "updated_at",
          "title",
          "prompt",
          "main_category",
          "occasion",
          "category",
          "subcategory",
          "sub_category",
          "type",
          "orientation",
          "preview_url",
          "thumbnail_url",
          "video_url",
          "textdefault",
          "text_default",
          "defaultduration",
          "default_duration",
          "defaultaspectratio",
          "default_aspect_ratio",
          "defaultresolution",
          "default_resolution",
          "generateaudiodefault",
          "generate_audio_default",
          "negativepromptdefault",
          "negative_prompt_default",
          "creditcost",
          "credit_cost",
          "tags",
          "isactive",
          "is_active",
        ].join(",")
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[TemplatesAdminPage] fetch templates error:", error);
      toast.error("Failed to load templates");
      setTemplates([]);
      setLoading(false);
      return;
    }

    setTemplates((data ?? []).map((row) => mapTemplate(row as unknown as TemplateDbRow)));
    setLoading(false);
  }

  useEffect(() => {
    void fetchTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    let filtered = [...templates];

    if (mainCategoryFilter !== "All categories") {
      filtered = filtered.filter(
        (template) => template.mainCategory === mainCategoryFilter
      );
    }

    if (typeFilter !== "All types") {
      const normalizedType = typeFilter.toLowerCase().replace(/s$/, "");

      filtered = filtered.filter(
        (template) => template.type.toLowerCase() === normalizedType
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();

      filtered = filtered.filter((template) => {
        const title = template.title.toLowerCase();
        const prompt = template.prompt.toLowerCase();
        const occasion = String(template.occasion || "").toLowerCase();
        const category = String(template.category || "").toLowerCase();
        const mainCategory = String(template.mainCategory || "").toLowerCase();
        const subCategory = String(template.subCategory || "").toLowerCase();
        const tags = template.tags.map((tag) => tag.toLowerCase());

        return (
          title.includes(q) ||
          prompt.includes(q) ||
          occasion.includes(q) ||
          category.includes(q) ||
          mainCategory.includes(q) ||
          subCategory.includes(q) ||
          tags.some((tag) => tag.includes(q))
        );
      });
    }

    return filtered;
  }, [templates, mainCategoryFilter, typeFilter, searchQuery]);

  function updateFilter(key: string, value: string) {
    const newParams = new URLSearchParams(searchParams);

    if (
      value === "All categories" ||
      value === "All types" ||
      value.trim() === ""
    ) {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }

    setSearchParams(newParams);
  }

  function openCreateDialog() {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("templateId");
    setSearchParams(newParams);
    setIsDialogOpen(true);
  }

  function openEditDialog(templateId: string) {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("templateId", templateId);
    setSearchParams(newParams);
    setOpenDropdownId(null);
    setIsDialogOpen(true);
  }

  function closeDialogAndCleanup() {
    setIsDialogOpen(false);

    const newParams = new URLSearchParams(searchParams);
    newParams.delete("templateId");
    setSearchParams(newParams);

    setOpenDropdownId(null);
  }

  function handleDialogChange(open: boolean) {
    setIsDialogOpen(open);

    if (!open) {
      closeDialogAndCleanup();
      void fetchTemplates();
    }
  }

  async function handleToggleActive(id: string, next: boolean) {
    setUpdatingId(id);

    try {
      const { error } = await supabase
        .from("templates")
        .update({
          isactive: next,
          is_active: next,
        })
        .eq("id", id);

      if (error) throw error;

      setTemplates((prev) =>
        prev.map((template) =>
          template.id === id ? { ...template, isActive: next } : template
        )
      );

      toast.success(next ? "Template activated" : "Template deactivated");
    } catch (error) {
      console.error("[TemplatesAdminPage] toggle error:", error);
      toast.error("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(id: string) {
    setUpdatingId(id);

    try {
      const { error } = await supabase.from("templates").delete().eq("id", id);

      if (error) throw error;

      setTemplates((prev) => prev.filter((template) => template.id !== id));
      toast.success("Template deleted");
    } catch (error) {
      console.error("[TemplatesAdminPage] delete error:", error);
      toast.error("Failed to delete template");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-950 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-slate-400">Loading templates...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">
              Templates
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Manage image and video templates, prompts, occasions, styles and
              categories for TheDigitalGifter.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateDialog}
            className="rounded-full bg-indigo-500 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-400"
          >
            Create Template
          </button>
        </header>

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-50">
                Templates library
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                View all templates, toggle availability, and track usage.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-8 items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-medium text-slate-400">
                  {filteredTemplates.length} templates
                </span>
              </div>

              <Select
                value={mainCategoryFilter}
                onValueChange={(value) => updateFilter("main_category", value)}
              >
                <SelectTrigger className="h-8 w-[150px] rounded-full border-slate-700 bg-slate-800/50 text-xs text-slate-300 hover:bg-slate-800">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>

                <SelectContent className="border-slate-700 bg-slate-900 text-slate-200">
                  {MAIN_CATEGORY_OPTIONS.map((category) => (
                    <SelectItem
                      key={category}
                      value={category}
                      className="focus:bg-slate-800 focus:text-slate-50"
                    >
                      {label(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={typeFilter}
                onValueChange={(value) => updateFilter("type", value)}
              >
                <SelectTrigger className="h-8 w-[110px] rounded-full border-slate-700 bg-slate-800/50 text-xs text-slate-300 hover:bg-slate-800">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>

                <SelectContent className="border-slate-700 bg-slate-900 text-slate-200">
                  {TYPE_OPTIONS.map((type) => (
                    <SelectItem
                      key={type}
                      value={type}
                      className="focus:bg-slate-800 focus:text-slate-50"
                    >
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400">
              <Search size={14} />

              <input
                value={searchQuery}
                onChange={(event) => updateFilter("search", event.target.value)}
                className="h-6 flex-1 border-none bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-500"
                placeholder="Search templates by name, prompt, category, occasion or tag..."
              />
            </div>
          </div>

          <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((template) => {
              const typeLabel = (template.type || "image").toLowerCase();
              const imgSrc = template.thumbnailUrl || template.previewUrl || "";

              return (
                <article
                  key={template.id}
                  className="relative flex flex-col rounded-2xl border border-slate-700 bg-slate-800/40 p-3 text-xs text-slate-300"
                >
                  <div className="mb-2 flex h-48 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 via-slate-600 to-slate-500 text-[10px] font-medium text-slate-100">
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={template.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[10px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          {typeLabel} template
                        </span>

                        <span className="line-clamp-2 px-4 opacity-90">
                          {template.title}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <h3 className="line-clamp-1 text-xs font-semibold text-slate-50">
                          {template.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-1">
                          <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] text-indigo-200">
                            {label(template.mainCategory)}
                          </span>

                          <span className="inline-flex items-center rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] text-slate-200">
                            {label(template.occasion)}
                          </span>

                          <span className="inline-flex items-center rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] text-slate-200">
                            {label(template.category)}
                          </span>

                          {template.subCategory ? (
                            <span className="inline-flex items-center rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] text-slate-300">
                              {label(template.subCategory)}
                            </span>
                          ) : null}

                          <span className="inline-flex items-center rounded-full bg-slate-700 px-2 py-0.5 text-[9px] uppercase tracking-wide text-slate-400">
                            {typeLabel}
                          </span>
                        </div>
                      </div>

                      <StatusSwitch
                        templateId={template.id}
                        isActive={template.isActive}
                        onToggle={handleToggleActive}
                        disabled={updatingId === template.id}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                      <span>
                        Usage:{" "}
                        <span className="font-semibold text-slate-200">
                          N/A
                        </span>
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {template.creditCost} credits
                      </span>
                    </div>

                    <DropdownMenu
                      open={openDropdownId === template.id}
                      onOpenChange={(open) =>
                        setOpenDropdownId(open ? template.id : null)
                      }
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="absolute right-1 top-1 inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 p-1 transition-colors hover:bg-slate-700"
                        >
                          <EllipsisVerticalIcon className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        align="end"
                        className="border-slate-700 bg-slate-900"
                      >
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            openEditDialog(template.id);
                          }}
                          className="cursor-pointer text-slate-200 focus:bg-slate-800 focus:text-slate-50"
                        >
                          <PenBoxIcon className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            setOpenDropdownId(null);
                            setTemplateToDelete(template.id);
                          }}
                          className="cursor-pointer text-red-400 focus:bg-slate-800 focus:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-slate-400">No templates found</p>

              <p className="mt-1 text-xs text-slate-500">
                {searchQuery ||
                mainCategoryFilter !== "All categories" ||
                typeFilter !== "All types"
                  ? "Try adjusting your filters or search query"
                  : "Create your first template to get started"}
              </p>
            </div>
          )}
        </section>
      </div>

      <CreateTemplateDialog
        open={isDialogOpen}
        onOpenChange={handleDialogChange}
      />

      <AlertDialog
        open={Boolean(templateToDelete)}
        onOpenChange={(open) => {
          if (!open) setTemplateToDelete(null);
        }}
      >
        <AlertDialogContent className="border-slate-800 bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-50">
              Are you absolutely sure?
            </AlertDialogTitle>

            <AlertDialogDescription className="text-slate-400">
              By confirming you will permanently delete this template. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-50">
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              className="border-none bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (!templateToDelete) return;
                void handleDelete(templateToDelete);
                setTemplateToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}