import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Mail } from "lucide-react";

import { supabase } from "@/lib/supabase";

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

/**
 * ✅ Canonical occasion slugs (use these everywhere: admin + funnel)
 */
const OCCASIONS: Array<{ value: string; label: string }> = [
  { value: "christmas", label: "Christmas" },
  { value: "birthday", label: "Birthday" },
  { value: "anniversary", label: "Anniversary" },
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

type TemplateRow = {
  id: string;

  title: string;
  occasion: string | null;
  category: string | null;
  subCategory: string | null;

  type: string | null;
  scene: string | null;
  orientation: string | null;

  prompt: string;
  textDefault: string | null;

  creditCost: number;
  tags: string[] | null;

  previewUrl: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;

  styleId: string | null;

  defaultDuration: number | null;
  defaultAspectRatio: string | null;
  defaultResolution: string | null;
  generateAudioDefault: boolean | null;

  isActive: boolean | null;
};

function safeTagsToString(tags: string[] | null | undefined) {
  return (tags || []).join(", ");
}

function parseTags(input: string) {
  return String(input || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// Storage
const BUCKET = "templates"; // ✅ create this bucket in Supabase Storage

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

export function CreateTemplateDialog({ open, onOpenChange }: CreateTemplateDialogProps) {
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("templateId"); // uuid string

  const isEditing = !!templateId;

  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  // Upload state
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [occasion, setOccasion] = useState("");
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

  // NEW: styleId
  const [styleId, setStyleId] = useState("");

  // media files
  const [previewImageFile, setPreviewImageFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // video defaults
  const [generateAudioDefault, setGenerateAudioDefault] = useState<boolean>(true);
  const [defaultDuration] = useState<number>(8);
  const [defaultAspectRatio] = useState<string>("16:9");
  const [defaultResolution] = useState<string>("1080p");

  const styleOptions = useMemo(() => OCCASION_STYLES[occasion] || [], [occasion]);
  const shouldShowStyle = styleOptions.length > 0;

  // If occasion changes, clear styleId if it doesn't exist
  useEffect(() => {
    if (!shouldShowStyle) {
      setStyleId("");
      return;
    }
    if (styleId && !styleOptions.some((s) => s.value === styleId)) {
      setStyleId("");
    }
  }, [occasion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing template (edit mode)
  useEffect(() => {
    if (!open) return;

    // create mode reset
    if (!templateId) {
      setTitle("");
      setOccasion("");
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
      setStyleId("");

      setPreviewImageFile(null);
      setThumbnailFile(null);
      setVideoFile(null);

      setGenerateAudioDefault(true);
      setUploadProgress(0);
      setIsUploading(false);
      setSaving(false);
      setLoadingTemplate(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoadingTemplate(true);
        const { data, error } = await supabase
          .from("templates")
          .select("*")
          .eq("id", templateId)
          .maybeSingle();

        if (cancelled) return;

        if (error) throw error;
        if (!data) {
          toast.error("Template not found");
          setLoadingTemplate(false);
          return;
        }

        const t = data as TemplateRow;

        setTitle(t.title || "");
        setOccasion(t.occasion || "");
        setCategory(t.category || "");
        setSubCategory(t.subCategory || "");
        setType((t.type === "video" ? "video" : "image") as TemplateType);
        setScene(t.scene || "");
        setOrientation((t.orientation === "landscape" ? "landscape" : "portrait") as Orientation);
        setPrompt(t.prompt || "");
        setTextDefault(t.textDefault || "");
        setCreditCost(Number(t.creditCost || 6));
        setTags(safeTagsToString(t.tags));

        setStyleId(t.styleId || "");

        setGenerateAudioDefault(t.generateAudioDefault ?? true);

        // files are not pre-filled
        setPreviewImageFile(null);
        setThumbnailFile(null);
        setVideoFile(null);
      } catch (e) {
        console.error("[CreateTemplateDialog] load error:", e);
        toast.error("Failed to load template data");
      } finally {
        if (!cancelled) setLoadingTemplate(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, templateId]);

  const validate = () => {
    if (!title.trim()) return "Template Title is required";
    if (!occasion.trim()) return "Occasion is required";
    if (!category.trim()) return "Category is required";
    if (!scene.trim()) return "Scene is required";
    if (!orientation) return "Orientation is required";
    if (!prompt.trim()) return "Prompt is required";
    if (!creditCost || Number.isNaN(Number(creditCost)) || Number(creditCost) < 1)
      return "Credit Cost must be >= 1";

    if (!isEditing) {
      if (type === "image" && !previewImageFile) return "Please upload a preview image";
      if (type === "video" && (!thumbnailFile || !videoFile))
        return "Please upload thumbnail and video files";
    }
    return null;
  };

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
      // Upload (optional in edit mode)
      let previewUrl: string | null = null;
      let thumbnailUrl: string | null = null;
      let videoUrl: string | null = null;

      // For create: required media depends on type
      // For edit: upload only if a new file is selected
      if (type === "image") {
        if (previewImageFile) {
          setUploadProgress(20);
          previewUrl = await uploadToSupabaseStorage(previewImageFile, "previews");
          setUploadProgress(55);
        }
      } else {
        if (thumbnailFile) {
          setUploadProgress(15);
          thumbnailUrl = await uploadToSupabaseStorage(thumbnailFile, "thumbnails");
        }
        if (videoFile) {
          setUploadProgress(45);
          videoUrl = await uploadToSupabaseStorage(videoFile, "videos");
        }
        setUploadProgress(70);
      }

      const payload: Record<string, any> = {
        title: title.trim(),
        occasion: occasion.trim(), // slug
        category: category.trim(),
        subCategory: subCategory ? subCategory.trim() : null,
        type,
        scene: scene.trim(),
        orientation,
        prompt: prompt.trim(),
        textDefault: textDefault || "",
        creditCost: Number(creditCost),
        tags: parseTags(tags),
        styleId: styleId || "",
        isActive: true,
      };

      if (type === "video") {
        payload.defaultDuration = defaultDuration;
        payload.defaultAspectRatio = defaultAspectRatio;
        payload.defaultResolution = defaultResolution;
        payload.generateAudioDefault = generateAudioDefault;
      } else {
        payload.generateAudioDefault = null;
        payload.defaultDuration = null;
        payload.defaultAspectRatio = null;
        payload.defaultResolution = null;
      }

      // Only set URLs if we uploaded new ones
      if (previewUrl) payload.previewUrl = previewUrl;
      if (thumbnailUrl) payload.thumbnailUrl = thumbnailUrl;
      if (videoUrl) payload.videoUrl = videoUrl;

      // Create vs Update
      if (isEditing && templateId) {
        const { error } = await supabase.from("templates").update(payload).eq("id", templateId);
        if (error) throw error;
        toast.success("Template updated successfully!");
      } else {
        // For create, we must ensure previewUrl exists for image or videoUrl+thumbnailUrl for video
        if (type === "image" && !payload.previewUrl) {
          toast.error("Missing preview upload");
          return;
        }
        if (type === "video" && (!payload.thumbnailUrl || !payload.videoUrl)) {
          toast.error("Missing video/thumbnail upload");
          return;
        }

        const { error } = await supabase.from("templates").insert(payload);
        if (error) throw error;

        toast.success("Template created successfully!");
      }

      setUploadProgress(100);

      // Email notification left as a future step (needs backend/edge function)
      if (!isEditing && sendEmailNotification) {
        toast.message("Email notification is not wired yet (we’ll add later).");
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
      <DialogContent className="max-w-3xl bg-slate-900 border-slate-800 text-slate-50">
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
          <form onSubmit={onSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
            <div className="flex gap-2 items-center">
              {/* Title */}
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-300">Template Title *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Cozy Fireplace Gathering"
                />
              </div>

              {/* Occasion */}
              <div className="w-[220px]">
                <label className="text-xs font-medium text-slate-300">Occasion *</label>
                <Select value={occasion || ""} onValueChange={(v) => setOccasion(v)}>
                  <SelectTrigger className="w-full rounded-xl border border-slate-700 bg-slate-800/50 text-xs text-slate-200 h-[34px]">
                    <SelectValue placeholder="Select occasion" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
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

            {/* Style (optional) */}
            {shouldShowStyle && (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <label className="text-xs font-medium text-slate-300">Style (optional)</label>
                  <Select value={styleId || ""} onValueChange={(v) => setStyleId(v)}>
                    <SelectTrigger className="w-full rounded-xl border border-slate-700 bg-slate-800/50 text-xs text-slate-200 h-[34px]">
                      <SelectValue placeholder="All styles" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                      <SelectItem value="" className="focus:bg-slate-800 focus:text-slate-50">
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

            {/* Category, SubCategory & Type */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Category *</label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Classic"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Sub-Category</label>
                <input
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Family / Group"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Template Type *</label>
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

            {/* Scene & Orientation */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Scene *</label>
                <input
                  value={scene}
                  onChange={(e) => setScene(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., tree"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Orientation *</label>
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

            {/* Media inputs */}
            {type === "image" ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Preview Image {isEditing ? "(optional)" : "*"}
                </label>
                <input
                  type="file"
                  id="preview-image-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setPreviewImageFile(file);
                    if (file) toast.success(`Selected: ${file.name}`);
                  }}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById("preview-image-upload")?.click()}
                  className="flex w-full items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/50 px-3 py-6 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  {previewImageFile ? `Selected: ${previewImageFile.name}` : "Click to upload preview image"}
                </button>
                <p className="text-[10px] text-slate-500">Recommended: 4:5 or 1:1 ratio, max 5MB.</p>
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
                    onClick={() => document.getElementById("thumbnail-upload")?.click()}
                    className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/50 px-3 py-6 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                  >
                    {thumbnailFile ? `Selected: ${thumbnailFile.name}` : "Click to upload thumbnail"}
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
                    className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/50 px-3 py-6 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                  >
                    {videoFile ? `Selected: ${videoFile.name}` : "Click to upload video"}
                  </button>
                </div>
              </div>
            )}

            {/* Video settings */}
            {type === "video" && (
              <div className="space-y-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700">
                <h3 className="text-xs font-semibold text-slate-200">Video Settings (Defaults)</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">Duration</label>
                    <div className="w-full rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-xs text-slate-400">
                      8 seconds
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">Aspect Ratio</label>
                    <div className="w-full rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-xs text-slate-400">
                      16:9 (Landscape)
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">Resolution</label>
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
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800"
                  />
                  <label htmlFor="generateAudio" className="text-xs text-slate-300">
                    Generate audio by default
                  </label>
                </div>
              </div>
            )}

            {/* Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Prompt *</label>
                <span className="text-[10px] text-slate-500">Used to generate variations for this template</span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px] w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none ring-0 placeholder:text-slate-500 focus:border-slate-500"
                placeholder="Describe the scene, style, and mood for this template..."
              />
            </div>

            {/* Default Text & Credit Cost */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Default Text</label>
                <input
                  value={textDefault}
                  onChange={(e) => setTextDefault(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Warm Holiday Moments"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Credit Cost *</label>
                <input
                  type="number"
                  value={creditCost}
                  onChange={(e) => setCreditCost(Number(e.target.value))}
                  min={1}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Tags</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                placeholder="cozy, family, fireplace, landscape (comma-separated)"
              />
              <p className="text-[10px] text-slate-500">Separate tags with commas</p>
            </div>

            {!isEditing && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={sendEmailNotification}
                  onChange={(e) => setSendEmailNotification(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
                />
                <label htmlFor="sendEmail" className="text-xs text-slate-300 flex-1 cursor-pointer flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  <span>Send email notification to all subscribed users about this new template</span>
                </label>
              </div>
            )}

            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{saving ? "Saving..." : "Uploading..."}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-300"
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
                className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
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
