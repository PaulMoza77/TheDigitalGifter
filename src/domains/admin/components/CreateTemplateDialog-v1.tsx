import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useSearchParams } from "react-router-dom";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Mail } from "lucide-react";

const categories = ["Classic", "Cozy", "Snowy", "Romantic"];

const subCategories = [
  "Family / Group",
  "Couple / Duo",
  "Single Portrait",
  "Card / No people",
  "Scene / No people",
];

const scenes = [
  "tree",
  "fireplace",
  "outdoor",
  "table",
  "workshop",
  "market",
  "cookies",
  "globes",
];

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
}: CreateTemplateDialogProps) {
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("templateId") as Id<"templates"> | null;

  // Fetch template data if editing - use admin query to get complete data including prompt
  const existingTemplate = useQuery(
    api.templates.getByIdAdmin,
    templateId ? { id: templateId } : "skip"
  );

  const isEditing = !!templateId;
  const isLoadingTemplate = templateId && existingTemplate === undefined;

  // Form state
  const [templateType, setTemplateType] = useState<"image" | "video">("image");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [subCategory, setSubCategory] = useState(subCategories[0]);
  const [scene, setScene] = useState(scenes[0]);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    "portrait"
  );
  const [prompt, setPrompt] = useState("");
  const [textDefault, setTextDefault] = useState("");
  const [creditCost, setCreditCost] = useState(6);
  const [tags, setTags] = useState("");

  // Video-specific fields
  const [defaultDuration, setDefaultDuration] = useState<4 | 6 | 8>(6);
  const [defaultAspectRatio, setDefaultAspectRatio] = useState("16:9");
  const [defaultResolution, setDefaultResolution] = useState<"720p" | "1080p">(
    "1080p"
  );
  const [generateAudioDefault, setGenerateAudioDefault] = useState(true);

  // File upload state
  const [previewImageFile, setPreviewImageFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [sendEmailNotification, setSendEmailNotification] = useState(true);

  // Mutations
  const generateUploadUrl = useMutation(api.fileUpload.generateUploadUrl);
  const createTemplate = useMutation(api.templates.create);

  // Load existing template data when editing
  useEffect(() => {
    if (existingTemplate && isEditing) {
      setTemplateType(existingTemplate.type === "video" ? "video" : "image");
      setTitle(existingTemplate.title || "");
      setCategory(existingTemplate.category || categories[0]);
      setSubCategory(existingTemplate.subCategory || subCategories[0]);
      setScene(existingTemplate.scene || scenes[0]);
      setOrientation(existingTemplate.orientation || "portrait");
      setPrompt(existingTemplate.prompt || ""); // Now we get the actual prompt!
      setTextDefault(existingTemplate.textDefault || "");
      setCreditCost(existingTemplate.creditCost || 6);
      setTags(existingTemplate.tags?.join(", ") || "");

      // Video-specific
      if (existingTemplate.type === "video") {
        setDefaultDuration(existingTemplate.defaultDuration || 6);
        setDefaultAspectRatio(existingTemplate.defaultAspectRatio || "16:9");
        setDefaultResolution(existingTemplate.defaultResolution || "1080p");
        setGenerateAudioDefault(existingTemplate.generateAudioDefault ?? true);
      }
    }
  }, [existingTemplate, isEditing]);

  // Reset form when dialog closes or when switching to create mode
  useEffect(() => {
    if (!open || !templateId) {
      // Reset all form fields to defaults
      setTemplateType("image");
      setTitle("");
      setCategory(categories[0]);
      setSubCategory(subCategories[0]);
      setScene(scenes[0]);
      setOrientation("portrait");
      setPrompt("");
      setTextDefault("");
      setCreditCost(6);
      setTags("");
      setDefaultDuration(6);
      setDefaultAspectRatio("16:9");
      setDefaultResolution("1080p");
      setGenerateAudioDefault(true);
      setPreviewImageFile(null);
      setThumbnailFile(null);
      setVideoFile(null);
      setSendEmailNotification(true);
    }
  }, [open, templateId]);

  // Upload file to Convex storage
  const uploadFile = async (file: File): Promise<Id<"_storage">> => {
    const uploadUrl = await generateUploadUrl();

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });

    const { storageId } = await response.json();
    return storageId as Id<"_storage">;
  };

  // Handle save with file uploads
  const handleSave = async () => {
    try {
      // Validation
      if (!title.trim()) {
        toast.error("Please enter a template title");
        return;
      }
      if (!prompt.trim()) {
        toast.error("Please enter a prompt");
        return;
      }
      if (templateType === "image" && !previewImageFile && !isEditing) {
        toast.error("Please upload a preview image");
        return;
      }
      if (
        templateType === "video" &&
        !thumbnailFile &&
        !videoFile &&
        !isEditing
      ) {
        toast.error("Please upload thumbnail and video files");
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      // Upload files
      let previewImageId: Id<"_storage"> | undefined;
      let thumbnailImageId: Id<"_storage"> | undefined;

      if (templateType === "image" && previewImageFile) {
        setUploadProgress(30);
        previewImageId = await uploadFile(previewImageFile);
      } else if (templateType === "video") {
        if (thumbnailFile) {
          setUploadProgress(20);
          thumbnailImageId = await uploadFile(thumbnailFile);
        }
        if (videoFile) {
          setUploadProgress(60);
          previewImageId = await uploadFile(videoFile);
        }
      }

      setUploadProgress(80);

      // Create template
      await createTemplate({
        title,
        category,
        subCategory,
        type: templateType,
        scene,
        orientation,
        prompt,
        textDefault,
        creditCost,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        previewImageId,
        thumbnailImageId,
        ...(templateType === "video" && {
          defaultDuration,
          defaultAspectRatio,
          defaultResolution,
          generateAudioDefault,
        }),
        sendEmailNotification,
      });

      setUploadProgress(100);
      toast.success("Template created successfully!");

      // Reset form
      setTitle("");
      setPrompt("");
      setTextDefault("");
      setTags("");
      setPreviewImageFile(null);
      setThumbnailFile(null);
      setVideoFile(null);

      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to create template");
      console.error(error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-slate-900 border-slate-800 text-slate-50">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-50">
            {isEditing ? "Edit Template" : "Create New Template"}
          </DialogTitle>
        </DialogHeader>

        {/* Loading state when fetching template data */}
        {isLoadingTemplate ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
              <p className="text-sm text-slate-400">Loading template data...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">
                Template Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                placeholder="e.g., Cozy Fireplace Gathering"
              />
            </div>

            {/* Category, SubCategory & Template Type */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Sub-Category
                </label>
                <select
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                >
                  {subCategories.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Template Type *
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTemplateType("image")}
                    className={`flex-1 rounded-full border border-slate-700 px-3 py-2 text-[11px] font-medium transition-colors ${
                      templateType === "image"
                        ? "bg-indigo-500 text-slate-200"
                        : "bg-slate-800/50 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateType("video")}
                    className={`flex-1 rounded-full border border-slate-700 px-3 py-2 text-[11px] font-medium transition-colors ${
                      templateType === "video"
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
                <label className="text-xs font-medium text-slate-300">
                  Scene *
                </label>
                <select
                  value={scene}
                  onChange={(e) => setScene(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                >
                  {scenes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
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

            {/* Media inputs - Conditional based on template type */}
            {templateType === "image" ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Preview Image *
                </label>
                <input
                  type="file"
                  id="preview-image-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPreviewImageFile(file);
                      toast.success(`Selected: ${file.name}`);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("preview-image-upload")?.click()
                  }
                  className="flex w-full items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/50 px-3 py-6 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  <svg
                    className="mr-2 h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {previewImageFile
                    ? `Selected: ${previewImageFile.name}`
                    : "Click to upload preview image"}
                </button>
                <p className="text-[10px] text-slate-500">
                  Recommended: 4:5 or 1:1 ratio, max 5MB. This will be the
                  previewUrl.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-slate-300">
                    Thumbnail Image *
                  </label>
                  <input
                    type="file"
                    id="thumbnail-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setThumbnailFile(file);
                        toast.success(`Selected: ${file.name}`);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("thumbnail-upload")?.click()
                    }
                    className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/50 px-3 py-6 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                  >
                    <svg
                      className="mr-2 h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {thumbnailFile
                      ? `Selected: ${thumbnailFile.name}`
                      : "Click to upload thumbnail"}
                  </button>
                  <p className="text-[10px] text-slate-500">
                    Thumbnail for video preview (thumbnailUrl)
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-slate-300">
                    Video File *
                  </label>
                  <input
                    type="file"
                    id="video-upload"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setVideoFile(file);
                        toast.success(`Selected: ${file.name}`);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("video-upload")?.click()
                    }
                    className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/50 px-3 py-6 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                  >
                    <svg
                      className="mr-2 h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    {videoFile
                      ? `Selected: ${videoFile.name}`
                      : "Click to upload video"}
                  </button>
                  <p className="text-[10px] text-slate-500">
                    MP4 or MOV, up to 20 seconds, max 20MB (previewUrl)
                  </p>
                </div>
              </div>
            )}

            {/* Video-specific settings */}
            {templateType === "video" && (
              <div className="space-y-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700">
                <h3 className="text-xs font-semibold text-slate-200">
                  Video Settings
                </h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">
                      Duration
                    </label>
                    <select
                      value={defaultDuration}
                      onChange={(e) =>
                        setDefaultDuration(Number(e.target.value) as 4 | 6 | 8)
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                    >
                      <option value={4}>4 seconds</option>
                      <option value={6}>6 seconds</option>
                      <option value={8}>8 seconds</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">
                      Aspect Ratio
                    </label>
                    <select
                      value={defaultAspectRatio}
                      onChange={(e) => setDefaultAspectRatio(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                    >
                      <option value="16:9">16:9 (Landscape)</option>
                      <option value="9:16">9:16 (Portrait)</option>
                      <option value="4:5">4:5 (Portrait)</option>
                      <option value="1:1">1:1 (Square)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">
                      Resolution
                    </label>
                    <select
                      value={defaultResolution}
                      onChange={(e) =>
                        setDefaultResolution(e.target.value as "720p" | "1080p")
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                    >
                      <option value="720p">720p</option>
                      <option value="1080p">1080p</option>
                    </select>
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
                  <label
                    htmlFor="generateAudio"
                    className="text-xs text-slate-300"
                  >
                    Generate audio by default
                  </label>
                </div>
              </div>
            )}

            {/* Prompt */}
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

            {/* Default Text & Credit Cost */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Default Text
                </label>
                <input
                  type="text"
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

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Tags</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                placeholder="cozy, family, fireplace, landscape (comma-separated)"
              />
              <p className="text-[10px] text-slate-500">
                Separate tags with commas
              </p>
            </div>

            {/* Email Notification Toggle */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
              <input
                type="checkbox"
                id="sendEmail"
                checked={sendEmailNotification}
                onChange={(e) => setSendEmailNotification(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
              />
              <label
                htmlFor="sendEmail"
                className="text-xs text-slate-300 flex-1 cursor-pointer flex items-center"
              >
                <Mail className="w-4 h-4 mr-2" />
                <span>
                  Send email notification to all subscribed users about this new
                  template
                </span>
              </label>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Uploading...</span>
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

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isUploading}
                className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading
                  ? "Uploading..."
                  : isEditing
                    ? "Update Template"
                    : "Create Template"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
