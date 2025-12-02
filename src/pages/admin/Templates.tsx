import React, { useState, useMemo } from "react";
import { CreateTemplateDialog } from "@/domains/admin/components/CreateTemplateDialog";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
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
import { EllipsisVerticalIcon, PenBoxIcon, Search, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const categories = [
  "All categories",
  "Christmas",
  "Birthday",
  "Anniversary",
  "Thank you",
];

function StatusSwitch({
  templateId,
  isActive,
}: {
  templateId: string;
  isActive: boolean;
}) {
  const updateTemplate = useMutation(api.templates.update);

  const handleToggle = async () => {
    try {
      await updateTemplate({
        id: templateId as any,
        isActive: !isActive,
      });
      toast.success(isActive ? "Template deactivated" : "Template activated");
    } catch (error) {
      toast.error("Failed to update status");
      console.error(error);
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        void handleToggle();
      }}
      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-800/50 transition-colors"
    >
      <span
        className={
          "relative inline-flex h-4 w-7 items-center rounded-full transition " +
          (isActive ? "bg-emerald-500/80" : "bg-slate-600")
        }
      >
        <span
          className={
            "absolute h-3 w-3 rounded-full bg-white shadow-sm transition-transform " +
            (isActive ? "translate-x-3" : "translate-x-0.5")
          }
        />
      </span>
      <span className={isActive ? "text-emerald-400" : "text-slate-400"}>
        {isActive ? "Active" : "Inactive"}
      </span>
    </button>
  );
}

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

function TemplatesAdminPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Get filter values from URL
  const categoryFilter = searchParams.get("category") || "All categories";
  const typeFilter = searchParams.get("type") || "All types";
  const searchQuery = searchParams.get("search") || "";

  // Fetch all templates from Convex (Admin view)
  const allTemplates = useQuery(api.templates.listAdmin);
  const deleteTemplate = useMutation(api.templates.deleteTemplate);

  // Filter templates based on URL params
  const filteredTemplates = useMemo(() => {
    if (!allTemplates) return [];

    let filtered = [...allTemplates];

    // Filter by category
    if (categoryFilter && categoryFilter !== "All categories") {
      filtered = filtered.filter(
        (t) =>
          t.category?.toLowerCase() === categoryFilter.toLowerCase() ||
          t.occasion?.toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    // Filter by type
    if (typeFilter && typeFilter !== "All types") {
      const normalizedType = typeFilter.toLowerCase().replace(/s$/, ""); // Remove trailing 's'
      filtered = filtered.filter(
        (t) => t.type?.toLowerCase() === normalizedType
      );
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title?.toLowerCase().includes(query) ||
          t.prompt?.toLowerCase().includes(query) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [allTemplates, categoryFilter, typeFilter, searchQuery]);

  // Update URL params
  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);

    if (value === "All categories" || value === "All types" || !value) {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }

    setSearchParams(newParams);
  };

  // Handle dialog close and cleanup
  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      // Clear templateId from URL when dialog closes
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("templateId");
      setSearchParams(newParams);
      // Ensure dropdown is closed
      setOpenDropdownId(null);
    }
  };

  // Show loading state
  if (allTemplates === undefined) {
    return (
      <div className="bg-slate-950 px-4 py-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-slate-400">Loading templates...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 px-4 py-6 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">Templates</h1>
            <p className="mt-1 text-sm text-slate-400">
              Manage image and video templates, prompts, and categories for
              TheDigitalGifter.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* <button className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800">
              Preview store
            </button> */}
            <button
              onClick={() => {
                // Clear templateId from URL to ensure we're in create mode
                const newParams = new URLSearchParams(searchParams);
                newParams.delete("templateId");
                setSearchParams(newParams);
                setIsDialogOpen(true);
              }}
              className="rounded-full bg-indigo-500 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-400"
            >
              Create Template
            </button>
          </div>
        </header>

        {/* Templates list */}
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm md:p-6">
          {/* Filters */}
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
              <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 h-8">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-medium text-slate-400">
                  {filteredTemplates.length} templates
                </span>
              </div>
              <Select
                value={categoryFilter}
                onValueChange={(value) => updateFilter("category", value)}
              >
                <SelectTrigger className="w-[140px] rounded-full border-slate-700 bg-slate-800/50 text-xs text-slate-300 hover:bg-slate-800 h-8">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                  {categories.map((cat) => (
                    <SelectItem
                      key={cat}
                      value={cat}
                      className="focus:bg-slate-800 focus:text-slate-50"
                    >
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={typeFilter}
                onValueChange={(value) => updateFilter("type", value)}
              >
                <SelectTrigger className="w-[110px] rounded-full border-slate-700 bg-slate-800/50 text-xs text-slate-300 hover:bg-slate-800 h-8">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                  <SelectItem
                    value="All types"
                    className="focus:bg-slate-800 focus:text-slate-50"
                  >
                    All types
                  </SelectItem>
                  <SelectItem
                    value="Images"
                    className="focus:bg-slate-800 focus:text-slate-50"
                  >
                    Images
                  </SelectItem>
                  <SelectItem
                    value="Videos"
                    className="focus:bg-slate-800 focus:text-slate-50"
                  >
                    Videos
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400">
              <Search size={14} />
              <input
                value={searchQuery}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="h-6 flex-1 border-none bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-500"
                placeholder="Search templates by name or prompt..."
              />
            </div>
            <button className="rounded-full border border-slate-700 px-3 py-1.5 text-[11px] font-medium text-slate-400 hover:bg-slate-800 h-8">
              Sort by usage
            </button>
          </div>

          {/* Templates grid */}
          <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((template) => (
              <article
                key={template._id}
                className="flex flex-col rounded-2xl border border-slate-700 bg-slate-800/40 p-3 text-xs text-slate-300 relative"
              >
                {/* Thumbnail */}
                <div className="mb-2 flex h-48 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 via-slate-600 to-slate-500 text-[10px] font-medium text-slate-100 overflow-hidden">
                  {template.thumbnailUrl || template.previewUrl ? (
                    <img
                      src={template.thumbnailUrl || template.previewUrl}
                      alt={template.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[10px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {template.type} template
                      </span>
                      <span className="line-clamp-2 px-4 opacity-90">
                        {template.title}
                      </span>
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="line-clamp-1 text-xs font-semibold text-slate-50">
                        {template.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="inline-flex items-center rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] text-slate-200">
                          {template.category ||
                            template.occasion ||
                            "Uncategorized"}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-slate-700 px-2 py-0.5 text-[9px] uppercase tracking-wide text-slate-400">
                          {template.type}
                        </span>
                      </div>
                    </div>
                    <StatusSwitch
                      templateId={template._id}
                      isActive={template.isActive !== false}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                    <span>
                      Usage:{" "}
                      <span className="font-semibold text-slate-200">N/A</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {template.creditCost} credits
                    </span>
                  </div>

                  <DropdownMenu
                    open={openDropdownId === template._id}
                    onOpenChange={(open) =>
                      setOpenDropdownId(open ? template._id : null)
                    }
                  >
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-full border border-slate-700 p-1 bg-slate-800 inline-flex items-center gap-1 absolute top-1 right-1 hover:bg-slate-700 transition-colors">
                        <EllipsisVerticalIcon className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-slate-900 border-slate-700"
                    >
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          // Close dropdown first
                          setOpenDropdownId(null);
                          // Small delay to ensure dropdown closes before dialog opens
                          setTimeout(() => {
                            setSearchParams({ templateId: template._id });
                            setIsDialogOpen(true);
                          }, 50);
                        }}
                        className="text-slate-200 focus:bg-slate-800 focus:text-slate-50 cursor-pointer"
                      >
                        <PenBoxIcon className=" h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setOpenDropdownId(null);
                          setTemplateToDelete(template._id);
                        }}
                        className="text-red-400 focus:bg-slate-800 focus:text-red-300 cursor-pointer"
                      >
                        <Trash2 className=" h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </article>
            ))}
          </div>

          {/* Empty state */}
          {filteredTemplates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-slate-400">No templates found</p>
              <p className="mt-1 text-xs text-slate-500">
                {searchQuery ||
                categoryFilter !== "All categories" ||
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
        open={!!templateToDelete}
        onOpenChange={(open) => !open && setTemplateToDelete(null)}
      >
        <AlertDialogContent className="bg-slate-900 border-slate-800">
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
            <AlertDialogCancel className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white border-none"
              onClick={() => {
                if (templateToDelete) {
                  deleteTemplate({ id: templateToDelete as any })
                    .then(() => toast.success("Template deleted"))
                    .catch(() => toast.error("Failed to delete template"));
                  setTemplateToDelete(null);
                }
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

export default TemplatesAdminPage;
