import React, { useRef, useState } from "react";
import { Save, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

import type {
  CollectionFormState,
  MainCategory,
  MainCategoryConfig,
  OccasionCollectionRow,
  OccasionGroup,
} from "./types";
import { normalizeMainCategory, normalizeSlug, uploadCollectionImage } from "./utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCollection: OccasionCollectionRow | null;
  collectionForm: CollectionFormState;
  setCollectionForm: React.Dispatch<React.SetStateAction<CollectionFormState>>;
  mainCategories: MainCategoryConfig[];
  savingCollection: boolean;
  groupedCollections: OccasionGroup[];
  onSave: () => void;
  onDelete: (collection: OccasionGroup) => void;
};

export default function CollectionDialog({
  open,
  onOpenChange,
  editingCollection,
  collectionForm,
  setCollectionForm,
  mainCategories,
  savingCollection,
  groupedCollections,
  onSave,
  onDelete,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  async function handleImageUpload(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image is too large. Max 8MB.");
      return;
    }

    const slug = normalizeSlug(collectionForm.slug || collectionForm.title);

    if (!slug) {
      toast.error("Add a title or slug before uploading image.");
      return;
    }

    setUploadingImage(true);

    try {
      const publicUrl = await uploadCollectionImage(file, slug);

      setCollectionForm((state) => ({
        ...state,
        image_url: publicUrl,
      }));

      toast.success("Image uploaded");
    } catch (error: any) {
      toast.error(error?.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
        <DialogHeader>
          <DialogTitle>
            {editingCollection ? "Edit collection" : "Create collection"}
          </DialogTitle>

          <DialogDescription className="text-slate-400">
            Colecțiile controlează ce apare în Home, Templates și Generator.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-slate-300">Title</Label>

              <Input
                value={collectionForm.title}
                onChange={(event) => {
                  const title = event.target.value;

                  setCollectionForm((state) => ({
                    ...state,
                    title,
                    slug: state.slug || (title ? normalizeSlug(title) : ""),
                    label: state.label || title,
                  }));
                }}
                placeholder="Bible Verses"
                className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Main Category</Label>

              <Select
                value={collectionForm.main_category}
                onValueChange={(value) =>
                  setCollectionForm((state) => ({
                    ...state,
                    main_category: normalizeMainCategory(value),
                  }))
                }
              >
                <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 text-slate-100">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>

                <SelectContent className="z-50 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
                  {mainCategories.map((item) => (
                    <SelectItem
                      key={item.key}
                      value={item.key}
                      className="focus:bg-slate-800 focus:text-slate-50 data-[highlighted]:bg-slate-800 data-[highlighted]:text-slate-50"
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Slug</Label>

              <Input
                value={collectionForm.slug}
                onChange={(event) =>
                  setCollectionForm((state) => ({
                    ...state,
                    slug: normalizeSlug(event.target.value),
                  }))
                }
                placeholder="bible_verses"
                className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Label</Label>

              <Input
                value={collectionForm.label}
                onChange={(event) =>
                  setCollectionForm((state) => ({
                    ...state,
                    label: event.target.value,
                  }))
                }
                placeholder="Faith & hope"
                className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Description</Label>

            <Textarea
              value={collectionForm.description}
              onChange={(event) =>
                setCollectionForm((state) => ({
                  ...state,
                  description: event.target.value,
                }))
              }
              placeholder="Beautiful spiritual cards with meaningful Bible-inspired messages."
              className="min-h-[100px] rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Collection image</Label>

            {collectionForm.image_url ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <img
                  src={collectionForm.image_url}
                  alt={collectionForm.title || "Collection image"}
                  className="h-48 w-full object-cover"
                />

                <button
                  type="button"
                  onClick={() =>
                    setCollectionForm((state) => ({ ...state, image_url: "" }))
                  }
                  className="absolute right-3 top-3 rounded-xl bg-black/70 p-2 text-white hover:bg-black"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                void handleImageUpload(file);
              }}
            />

            <Button
              type="button"
              variant="outline"
              disabled={uploadingImage}
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl border-dashed border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              {uploadingImage ? "Uploading..." : "Upload picture"}
            </Button>

            <Input
              value={collectionForm.image_url}
              onChange={(event) =>
                setCollectionForm((state) => ({
                  ...state,
                  image_url: event.target.value,
                }))
              }
              placeholder="Or paste image URL..."
              className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-slate-300">Gradient From</Label>

              <Input
                value={collectionForm.gradient_from}
                onChange={(event) =>
                  setCollectionForm((state) => ({
                    ...state,
                    gradient_from: event.target.value,
                  }))
                }
                className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Gradient To</Label>

              <Input
                value={collectionForm.gradient_to}
                onChange={(event) =>
                  setCollectionForm((state) => ({
                    ...state,
                    gradient_to: event.target.value,
                  }))
                }
                className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Sort Order</Label>

              <Input
                type="number"
                value={collectionForm.sort_order}
                onChange={(event) =>
                  setCollectionForm((state) => ({
                    ...state,
                    sort_order: Number(event.target.value || 999),
                  }))
                }
                className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
              <span className="text-sm text-slate-200">Visible</span>

              <Switch
                checked={collectionForm.is_active}
                onCheckedChange={(value) =>
                  setCollectionForm((state) => ({
                    ...state,
                    is_active: value,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
              <span className="text-sm text-slate-200">Trending</span>

              <Switch
                checked={collectionForm.is_trending}
                onCheckedChange={(value) =>
                  setCollectionForm((state) => ({
                    ...state,
                    is_trending: value,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            {editingCollection ? (
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => {
                  const group = groupedCollections.find(
                    (item) => normalizeSlug(item.slug) === normalizeSlug(editingCollection.slug)
                  );

                  if (group) {
                    onDelete(group);
                    onOpenChange(false);
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>

              <Button
                className="rounded-xl"
                onClick={onSave}
                disabled={savingCollection || uploadingImage}
              >
                <Save className="mr-2 h-4 w-4" />
                {savingCollection ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}