import React from "react";
import { Save, Sparkles } from "lucide-react";

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

import { cn } from "@/lib/utils";
import type {
  MainCategoryConfig,
  StyleFormState,
  TemplateDbRow,
} from "./types";
import {
  makeStyleIdFromTitle,
  normalizeMainCategory,
  normalizeSlug,
} from "./utils";

type CollectionOption = {
  value: string;
  label: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingStyle: TemplateDbRow | null;
  styleForm: StyleFormState;
  setStyleForm: React.Dispatch<React.SetStateAction<StyleFormState>>;
  collectionOptions: CollectionOption[];
  mainCategories: MainCategoryConfig[];
  savingStyle: boolean;
  aiGenerating: boolean;
  getMainCategoryForSlug: (slug: string) => StyleFormState["main_category"];
  onSave: () => void;
  onGenerateWithAI: () => void;
};

export default function StyleDialog({
  open,
  onOpenChange,
  editingStyle,
  styleForm,
  setStyleForm,
  collectionOptions,
  mainCategories,
  savingStyle,
  aiGenerating,
  getMainCategoryForSlug,
  onSave,
  onGenerateWithAI,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
        <DialogHeader>
          <DialogTitle>
            {editingStyle ? "Edit style" : "Create style"}
          </DialogTitle>

          <DialogDescription className="text-slate-400">
            Aceste valori se folosesc în FunnelStyleSelect.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-slate-300">Collection</Label>

              <Select
                value={styleForm.occasion}
                onValueChange={(value) => {
                  const slug = normalizeSlug(value);

                  setStyleForm((state) => ({
                    ...state,
                    occasion: slug,
                    main_category: getMainCategoryForSlug(slug),
                  }));
                }}
              >
                <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 text-slate-100">
                  <SelectValue placeholder="Select collection" />
                </SelectTrigger>

                <SelectContent className="z-50 max-h-[360px] rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
                  {collectionOptions.map((item) => (
                    <SelectItem
                      key={item.value}
                      value={item.value}
                      className="focus:bg-slate-800 focus:text-slate-50 data-[highlighted]:bg-slate-800 data-[highlighted]:text-slate-50"
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Main Category</Label>

              <Select
                value={styleForm.main_category}
                onValueChange={(value) =>
                  setStyleForm((state) => ({
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

            <div className="space-y-2">
              <Label className="text-slate-300">Active</Label>

              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                <span className="text-sm text-slate-200">
                  {styleForm.isactive ? "Enabled" : "Disabled"}
                </span>

                <Switch
                  checked={!!styleForm.isactive}
                  onCheckedChange={(value) =>
                    setStyleForm((state) => ({
                      ...state,
                      isactive: value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-slate-300">AI notes optional</Label>

              <Input
                value={styleForm.ai_notes}
                onChange={(event) =>
                  setStyleForm((state) => ({
                    ...state,
                    ai_notes: event.target.value,
                  }))
                }
                placeholder='e.g. "warm golden light, film look, joyful family, premium, clean background"'
                className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2 sm:col-span-1">
              <Label className="text-slate-300">Generate</Label>

              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                onClick={onGenerateWithAI}
                disabled={aiGenerating}
              >
                <Sparkles
                  className={cn("mr-2 h-4 w-4", aiGenerating && "animate-pulse")}
                />
                {aiGenerating ? "Generating..." : "Generate with AI"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Title</Label>

              <Input
                value={styleForm.title}
                onChange={(event) => {
                  const title = event.target.value;

                  setStyleForm((state) => ({
                    ...state,
                    title,
                    style_id:
                      state.style_id || (title ? makeStyleIdFromTitle(title) : ""),
                  }));
                }}
                placeholder="Golden Memory"
                className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">style_id slug</Label>

              <Input
                value={styleForm.style_id}
                onChange={(event) =>
                  setStyleForm((state) => ({
                    ...state,
                    style_id: normalizeSlug(event.target.value),
                  }))
                }
                placeholder="golden_memory"
                className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Prompt</Label>

            <Textarea
              value={styleForm.prompt}
              onChange={(event) =>
                setStyleForm((state) => ({
                  ...state,
                  prompt: event.target.value,
                }))
              }
              placeholder="Write the exact prompt here..."
              className={cn(
                "min-h-[240px] rounded-xl font-mono text-xs",
                "border border-slate-700 bg-white text-slate-900",
                "placeholder:text-slate-500",
                "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-0"
              )}
            />

            <div className="text-xs text-slate-500">
              Tip: păstrează prompturile consistente per colecție.
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
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
              disabled={savingStyle}
            >
              <Save className="mr-2 h-4 w-4" />
              {savingStyle ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}