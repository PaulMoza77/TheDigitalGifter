// FILE: src/domains/admin/components/CreateTemplateDialog.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ImagePlus, Loader2, Mail, Sparkles } from "lucide-react";

import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OCCASIONS: Array<{ value: string; label: string }> = [
  { value: "christmas", label: "Christmas" },
  { value: "birthday", label: "Birthday" },
  { value: "anniversary", label: "Anniversary" },
  { value: "thanksgiving", label: "Thanksgiving" },
  { value: "thank_you", label: "Thank You" },
  { value: "new_born", label: "New Born" },
  { value: "baby_reveal", label: "Baby Reveal" },
  { value: "new_years_eve", label: "New Year’s Eve" },
  { value: "valentines_day", label: "Valentine’s Day" },
  { value: "mothers_day", label: "Mother’s Day" },
  { value: "fathers_day", label: "Father’s Day" },
  { value: "graduation", label: "Graduation" },
];

const OCCASION_STYLES: Record<string, Array<{ value: string; label: string }>> = {
  new_born: [
    { value: "soft_pastel", label: "Soft Pastel" },
    { value: "cozy_blanket", label: "Cozy Blanket" },
    { value: "angel_sleep", label: "Angel Sleep" },
    { value: "first_light", label: "First Light" },
    { value: "minimal_studio", label: "Minimal Studio" },
    { value: "golden_memory", label: "Golden Memory" },
  ],
};

type TemplateType = "image" | "video";
type Orientation = "portrait" | "landscape";

type TemplateDbRow = {
  id: string;
  title: string | null;
  occasion: string | null;
  category: string | null;
  sub_category: string | null;
  type: string | null;
  scene: string | null;
  orientation: string | null;
  prompt: string | null;
  text_default: string | null;
  credit_cost: number | null;
  tags: string[] | null;
  preview_url: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  style_id: string | null;
  default_duration: number | null;
  default_aspect_ratio: string | null;
  default_resolution: string | null;
  generate_audio_default: boolean | null;
  is_active: boolean | null;
};

const BUCKET = "templates";
const ALL_STYLES_SENTINEL = "__all__";

function safeTagsToString(tags: string[] | null | undefined) {
  return (tags || []).join(", ");
}

function parseTags(input: string) {
  return String(input || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function safeExt(name: string) {
  const parts = String(name || "").split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";

  if (ext && ext.length <= 6) return ext;

  return "bin";
}

function rand6() {
  return Math.random().toString(16).slice(2, 8);
}

async function uploadToSupabaseStorage(file: File, folder: string) {
  const ext = safeExt(file.name);
  const path = `${folder}/${Date.now()}-${rand6()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
    cacheControl: "3600",
  });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function getOccasionLabel(value: string | null) {
  return OCCASIONS.find((item) => item.value === value)?.label || value || "";
}

function buildAiPreviewPrompt(input: {
  title: string;
  occasion: string | null;
  category: string;
  subCategory: string;
  scene: string;
  orientation: Orientation;
  prompt: string;
}) {
  const occasionLabel = getOccasionLabel(input.occasion) || "general occasion";

  return [
    "Create a premium preview image for an AI gift/card template.",
    `Template title: ${input.title || "Untitled template"}.`,
    `Occasion: ${occasionLabel}.`,
    `Category: ${input.category || "General"}.`,
    input.subCategory ? `Sub-category: ${input.subCategory}.` : "",
    input.scene ? `Scene: ${input.scene}.` : "",
    `Orientation: ${input.orientation}.`,
    "The image should look polished, high-end, emotional, gift-ready, clean, and suitable as a marketplace template preview.",
    "Do not include readable UI text, watermarks, logos, distorted faces, or messy artifacts.",
    input.prompt ? `Template generation prompt context: ${input.prompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function getGeneratedUrl(data: unknown) {
  if (!data || typeof data !== "object") return "";

  const row = data as Record<string, unknown>;

  return String(
    row.preview_url ||
      row.previewUrl ||
      row.image_url ||
      row.imageUrl ||
      row.publicUrl ||
      row.url ||
      ""
  ).trim();
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
}: CreateTemplateDialogProps) {
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("templateId");
  const isEditing = !!templateId;

  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  const [title, setTitle] = useState("");
  const [occasion, setOccasion] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");

  const [type, setType] = useState<TemplateType>("image");
  const [scene, setScene] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("portrait");

  const [prompt, setPrompt] = useState("");
  const [textDefault, setTextDefault] = useState("");
  const [creditCost, setCreditCost] = useState<number>(6);
  const [tags, setTags] = useState("");

  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  const [styleId, setStyleId] = useState<string | null>(null);

  const [previewImageFile, setPreviewImageFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [existingPreviewUrl, setExistingPreviewUrl] = useState("");
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState("");
  const [aiPreviewUrl, setAiPreviewUrl] = useState("");

  const [generateAudioDefault, setGenerateAudioDefault] = useState<boolean>(true);
  const [defaultDuration] = useState<number>(8);
  const [defaultAspectRatio] = useState<string>("16:9");
  const [defaultResolution] = useState<string>("1080p");

  const styleOptions = useMemo(() => {
    const key = occasion || "";
    return OCCASION_STYLES[key] || [];
  }, [occasion]);

  const shouldShowStyle = styleOptions.length > 0;

  const visiblePreviewUrl = aiPreviewUrl || existingPreviewUrl || existingThumbnailUrl;

  useEffect(() => {
    if (!shouldShowStyle) {
      setStyleId(null);
      return;
    }

    if (styleId && !styleOptions.some((s) => s.value === styleId)) {
      setStyleId(null);
    }
  }, [occasion, shouldShowStyle, styleId, styleOptions]);

  function handleOccasionChange(value: string) {
    const label = getOccasionLabel(value);

    setOccasion(value);

    if (!category.trim()) {
      setCategory(label);
    }
  }

  const resetForm = () => {
    setTitle("");
    setOccasion(null);
    setCategory("");
    setSubCategory("");
    setType("image");
    setScene("");
    setOrientation("portrait");
    setPrompt("");
    setTextDefault("");
    setCreditCost(6);
    setTags("");
    setSendEmailNotification(true);
    setStyleId(null);

    setPreviewImageFile(null);
    setThumbnailFile(null);
    setVideoFile(null);

    setExistingPreviewUrl("");
    setExistingThumbnailUrl("");
    setAiPreviewUrl("");

    setGenerateAudioDefault(true);

    setUploadProgress(0);
    setIsUploading(false);
    setSaving(false);
    setLoadingTemplate(false);
    setGeneratingPreview(false);
  };

  useEffect(() => {
    if (!open) return;

    if (!templateId) {
      resetForm();
      return;
    }

    let cancelled = false;

    async function loadTemplate() {
      try {
        setLoadingTemplate(true);

        const { data, error } = await supabase
          .from("templates")
          .select(
            [
              "id",
              "title",
              "occasion",
              "category",
              "sub_category",
              "type",
              "scene",
              "orientation",
              "prompt",
              "text_default",
              "credit_cost",
              "tags",
              "preview_url",
              "thumbnail_url",
              "video_url",
              "style_id",
              "default_duration",
              "default_aspect_ratio",
              "default_resolution",
              "generate_audio_default",
              "is_active",
            ].join(",")
          )
          .eq("id", templateId)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;

        if (!data) {
          toast.error("Template not found");
          return;
        }

        const t = data as unknown as TemplateDbRow;

        setTitle(t.title || "");
        setOccasion(t.occasion || null);
        setCategory(t.category || "");
        setSubCategory(t.sub_category || "");
        setType((t.type === "video" ? "video" : "image") as TemplateType);
        setScene(t.scene || "");
        setOrientation(
          (t.orientation === "landscape" ? "landscape" : "portrait") as Orientation
        );
        setPrompt(t.prompt || "");
        setTextDefault(t.text_default || "");
        setCreditCost(Number(t.credit_cost || 6));
        setTags(safeTagsToString(t.tags));
        setStyleId(t.style_id || null);
        setGenerateAudioDefault(t.generate_audio_default ?? true);

        setExistingPreviewUrl(t.preview_url || "");
        setExistingThumbnailUrl(t.thumbnail_url || "");
        setAiPreviewUrl("");

        setPreviewImageFile(null);
        setThumbnailFile(null);
        setVideoFile(null);
      } catch (e) {
        console.error("[CreateTemplateDialog] load error:", e);
        toast.error("Failed to load template data");
      } finally {
        if (!cancelled) setLoadingTemplate(false);
      }
    }

    void loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [open, templateId]);

  const validate = () => {
    if (!title.trim()) return "Template Title is required";
    if (!occasion) return "Occasion is required";
    if (!category.trim()) return "Category is required";
    if (!scene.trim()) return "Scene is required";
    if (!orientation) return "Orientation is required";
    if (!prompt.trim()) return "Prompt is required";

    if (!creditCost || Number.isNaN(Number(creditCost)) || Number(creditCost) < 1) {
      return "Credit Cost must be >= 1";
    }

    if (!isEditing) {
      if (type === "image" && !previewImageFile && !aiPreviewUrl) {
        return "Please upload or generate a preview image";
      }

      if (type === "video" && (!thumbnailFile || !videoFile)) {
        return "Please upload thumbnail and video files";
      }
    }

    return null;
  };

  async function handleGenerateAiPreview() {
    if (!title.trim()) {
      toast.error("Add a template title first");
      return;
    }

    if (!occasion) {
      toast.error("Select an occasion first");
      return;
    }

    if (!category.trim()) {
      toast.error("Add a category first");
      return;
    }

    try {
      setGeneratingPreview(true);

      const aiPrompt = buildAiPreviewPrompt({
        title,
        occasion,
        category,
        subCategory,
        scene,
        orientation,
        prompt,
      });

      const { data, error } = await supabase.functions.invoke(
        "generate-template-preview",
        {
          body: {
            prompt: aiPrompt,
            title: title.trim(),
            occasion,
            category: category.trim(),
            sub_category: subCategory.trim() || null,
            scene: scene.trim() || null,
            orientation,
            type: "image",
          },
        }
      );

      if (error) throw error;

      const generatedUrl = getGeneratedUrl(data);

      if (!generatedUrl) {
        throw new Error(
          "AI generation finished, but no image URL was returned by the Edge Function."
        );
      }

      setAiPreviewUrl(generatedUrl);
      setPreviewImageFile(null);

      toast.success("AI preview generated");
    } catch (error: any) {
      console.error("[CreateTemplateDialog] generate AI preview error:", error);
      toast.error(
        error?.message ||
          "Failed to generate AI preview. Check the generate-template-preview Edge Function."
      );
    } finally {
      setGeneratingPreview(false);
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const err = validate();

    if (err) {
      toast.error(err);
      return;
    }

    setSaving(true);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      let preview_url: string | null = aiPreviewUrl || null;
      let thumbnail_url: string | null = aiPreviewUrl || null;
      let video_url: string | null = null;

      if (type === "image" && previewImageFile) {
        setUploadProgress(20);
        preview_url = await uploadToSupabaseStorage(previewImageFile, "previews");
        thumbnail_url = preview_url;
        setUploadProgress(60);
      }

      if (type === "video") {
        if (thumbnailFile) {
          setUploadProgress(15);
          thumbnail_url = await uploadToSupabaseStorage(thumbnailFile, "thumbnails");
        }

        if (videoFile) {
          setUploadProgress(45);
          video_url = await uploadToSupabaseStorage(videoFile, "videos");
        }

        setUploadProgress(70);
      }

      const payload: Record<string, any> = {
        title: title.trim(),
        occasion: (occasion || "").trim(),
        category: category.trim(),
        sub_category: subCategory ? subCategory.trim() : null,
        type,
        scene: scene.trim(),
        orientation,
        prompt: prompt.trim(),
        text_default: textDefault || null,
        credit_cost: Number(creditCost),
        tags: parseTags(tags),
        style_id: styleId || null,
        is_active: true,
      };

      if (type === "video") {
        payload.default_duration = defaultDuration;
        payload.default_aspect_ratio = defaultAspectRatio;
        payload.default_resolution = defaultResolution;
        payload.generate_audio_default = generateAudioDefault;
      } else {
        payload.default_duration = null;
        payload.default_aspect_ratio = null;
        payload.default_resolution = null;
        payload.generate_audio_default = null;
      }

      if (preview_url) payload.preview_url = preview_url;
      if (thumbnail_url) payload.thumbnail_url = thumbnail_url;
      if (video_url) payload.video_url = video_url;

      if (!isEditing) {
        if (type === "image" && !payload.preview_url) {
          toast.error("Missing preview image");
          return;
        }

        if (type === "video" && (!payload.thumbnail_url || !payload.video_url)) {
          toast.error("Missing video/thumbnail upload");
          return;
        }
      }

      if (isEditing && templateId) {
        const { error } = await supabase
          .from("templates")
          .update(payload)
          .eq("id", templateId);

        if (error) throw error;

        toast.success("Template updated successfully!");
      } else {
        const { error } = await supabase.from("templates").insert(payload);

        if (error) throw error;

        toast.success("Template created successfully!");
      }

      setUploadProgress(100);

      if (!isEditing && sendEmailNotification) {
        toast.message("Email notification is not wired yet.");
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error("[CreateTemplateDialog] save error:", error);
      toast.error(error?.message || "Failed to save template");
    } finally {
      setSaving(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-3xl border-slate-800 bg-slate-900 text-slate-50">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-50">
            {isEditing ? "Edit Template" : "Create New Template"}
          </DialogTitle>
        </DialogHeader>

        {loadingTemplate ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
              <p className="text-sm text-slate-400">Loading template data...</p>
            </div>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="max-h-[75vh] space-y-4 overflow-y-auto pr-2"
          >
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-300">
                  Template Title *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Cozy Fireplace Gathering"
                />
              </div>

              <div className="w-[220px]">
                <label className="text-xs font-medium text-slate-300">
                  Occasion *
                </label>
                <Select
                  value={occasion ?? undefined}
                  onValueChange={handleOccasionChange}
                >
                  <SelectTrigger className="h-[34px] w-full rounded-xl border border-slate-700 bg-slate-800/50 text-xs text-slate-200">
                    <SelectValue placeholder="Select occasion" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-900 text-slate-200">
                    {OCCASIONS.map((o) => (
                      <SelectItem
                        key={o.value}
                        value={o.value}
                        className="focus:bg-slate-800 focus:text-slate-50"
                      >
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {shouldShowStyle && (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <label className="text-xs font-medium text-slate-300">
                    Style (optional)
                  </label>

                  <Select
                    value={styleId ?? ALL_STYLES_SENTINEL}
                    onValueChange={(v) =>
                      setStyleId(v === ALL_STYLES_SENTINEL ? null : v)
                    }
                  >
                    <SelectTrigger className="h-[34px] w-full rounded-xl border border-slate-700 bg-slate-800/50 text-xs text-slate-200">
                      <SelectValue placeholder="All styles" />
                    </SelectTrigger>

                    <SelectContent className="border-slate-700 bg-slate-900 text-slate-200">
                      <SelectItem
                        value={ALL_STYLES_SENTINEL}
                        className="focus:bg-slate-800 focus:text-slate-50"
                      >
                        All styles
                      </SelectItem>

                      {styleOptions.map((s) => (
                        <SelectItem
                          key={s.value}
                          value={s.value}
                          className="focus:bg-slate-800 focus:text-slate-50"
                        >
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <p className="text-[10px] text-slate-500">
                    If set, this template will show only for that funnel style.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Category *
                </label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Classic"
                />
                <p className="text-[10px] text-slate-500">
                  Auto-filled from occasion when empty. You can change it anytime.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Sub-Category
                </label>
                <input
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Family / Group"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Template Type *
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setType("image")}
                    className={`flex-1 rounded-full border border-slate-700 px-3 py-2 text-[11px] font-medium transition-colors ${
                      type === "image"
                        ? "bg-indigo-500 text-slate-200"
                        : "bg-slate-800/50 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    Image
                  </button>

                  <button
                    type="button"
                    onClick={() => setType("video")}
                    className={`flex-1 rounded-full border border-slate-700 px-3 py-2 text-[11px] font-medium transition-colors ${
                      type === "video"
                        ? "bg-indigo-500 text-slate-200"
                        : "bg-slate-800/50 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    Video
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Scene *
                </label>
                <input
                  value={scene}
                  onChange={(e) => setScene(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., cozy living room"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Orientation *
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOrientation("portrait")}
                    className={`flex-1 rounded-full border border-slate-700 px-3 py-2 text-[11px] font-medium transition-colors ${
                      orientation === "portrait"
                        ? "bg-indigo-500 text-slate-200"
                        : "bg-slate-800/50 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    Portrait
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrientation("landscape")}
                    className={`flex-1 rounded-full border border-slate-700 px-3 py-2 text-[11px] font-medium transition-colors ${
                      orientation === "landscape"
                        ? "bg-indigo-500 text-slate-200"
                        : "bg-slate-800/50 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    Landscape
                  </button>
                </div>
              </div>
            </div>

            {type === "image" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-medium text-slate-300">
                    Preview Image {isEditing ? "(optional)" : "*"}
                  </label>

                  <button
                    type="button"
                    onClick={handleGenerateAiPreview}
                    disabled={generatingPreview || saving}
                    className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {generatingPreview ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Generate with AI Photo
                  </button>
                </div>

                {visiblePreviewUrl ? (
                  <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950/50">
                    <img
                      src={visiblePreviewUrl}
                      alt="Template preview"
                      className="max-h-[260px] w-full object-cover"
                    />
                  </div>
                ) : null}

                <input
                  type="file"
                  id="preview-image-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setPreviewImageFile(file);

                    if (file) {
                      setAiPreviewUrl("");
                      toast.success(`Selected: ${file.name}`);
                    }
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("preview-image-upload")?.click()
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-800/50 px-3 py-6 text-xs text-slate-400 transition-colors hover:bg-slate-800"
                >
                  <ImagePlus className="h-4 w-4" />
                  {previewImageFile
                    ? `Selected: ${previewImageFile.name}`
                    : "Click to upload preview image"}
                </button>

                <p className="text-[10px] text-slate-500">
                  Recommended: 4:5 or 1:1 ratio, max 5MB. AI photo generation
                  requires the Supabase Edge Function{" "}
                  <span className="text-slate-300">generate-template-preview</span>.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-slate-300">
                    Thumbnail Image {isEditing ? "(optional)" : "*"}
                  </label>

                  <input
                    type="file"
                    id="thumbnail-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setThumbnailFile(file);
                      if (file) toast.success(`Selected: ${file.name}`);
                    }}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("thumbnail-upload")?.click()
                    }
                    className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/50 px-3 py-6 text-xs text-slate-400 transition-colors hover:bg-slate-800"
                  >
                    {thumbnailFile
                      ? `Selected: ${thumbnailFile.name}`
                      : "Click to upload thumbnail"}
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-slate-300">
                    Video File {isEditing ? "(optional)" : "*"}
                  </label>

                  <input
                    type="file"
                    id="video-upload"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setVideoFile(file);
                      if (file) toast.success(`Selected: ${file.name}`);
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => document.getElementById("video-upload")?.click()}
                    className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/50 px-3 py-6 text-xs text-slate-400 transition-colors hover:bg-slate-800"
                  >
                    {videoFile ? `Selected: ${videoFile.name}` : "Click to upload video"}
                  </button>
                </div>
              </div>
            )}

            {type === "video" && (
              <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/30 p-3">
                <h3 className="text-xs font-semibold text-slate-200">
                  Video Settings (Defaults)
                </h3>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">
                      Duration
                    </label>
                    <div className="w-full rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-xs text-slate-400">
                      8 seconds
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">
                      Aspect Ratio
                    </label>
                    <div className="w-full rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-xs text-slate-400">
                      16:9 (Landscape)
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">
                      Resolution
                    </label>
                    <div className="w-full rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-xs text-slate-400">
                      1080p
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="generateAudio"
                    checked={generateAudioDefault}
                    onChange={(e) => setGenerateAudioDefault(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800"
                  />
                  <label htmlFor="generateAudio" className="text-xs text-slate-300">
                    Generate audio by default
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  Prompt *
                </label>
                <span className="text-[10px] text-slate-500">
                  Used to generate variations for this template
                </span>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px] w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none ring-0 placeholder:text-slate-500 focus:border-slate-500"
                placeholder="Describe the scene, style, and mood for this template..."
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Default Text
                </label>
                <input
                  value={textDefault}
                  onChange={(e) => setTextDefault(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Warm Holiday Moments"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Credit Cost *
                </label>
                <input
                  type="number"
                  value={creditCost}
                  onChange={(e) => setCreditCost(Number(e.target.value))}
                  min={1}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Tags</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                placeholder="cozy, family, fireplace, landscape (comma-separated)"
              />
              <p className="text-[10px] text-slate-500">
                Separate tags with commas
              </p>
            </div>

            {!isEditing && (
              <div className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={sendEmailNotification}
                  onChange={(e) => setSendEmailNotification(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
                />
                <label
                  htmlFor="sendEmail"
                  className="flex flex-1 cursor-pointer items-center text-xs text-slate-300"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  <span>
                    Send email notification to all subscribed users about this new
                    template
                  </span>
                </label>
              </div>
            )}

            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{saving ? "Saving..." : "Uploading..."}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving || generatingPreview}
                className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : isEditing ? "Update Template" : "Create Template"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CreateTemplateDialog;