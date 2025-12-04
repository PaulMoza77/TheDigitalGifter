import React, { useEffect, useState } from "react";
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
import { useForm, SubmitHandler, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  templateFormSchema,
  TemplateFormValues,
} from "../validations/template";
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

export function CreateTemplateDialog({
  open,
  onOpenChange,
}: CreateTemplateDialogProps) {
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("templateId") as Id<"templates"> | null;

  // Fetch template data if editing
  const existingTemplate = useQuery(
    api.templates.getByIdAdmin,
    templateId ? { id: templateId } : "skip"
  );

  const isEditing = !!templateId;
  const isLoadingTemplate = templateId && existingTemplate === undefined;

  // Upload state
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  // Mutations
  const generateUploadUrl = useMutation(api.fileUpload.generateUploadUrl);
  const createTemplate = useMutation(api.templates.create);
  const updateTemplate = useMutation(api.templates.update);

  // Form Setup
  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema) as Resolver<TemplateFormValues>,
    defaultValues: {
      title: "",
      occasion: "",
      category: "",
      subCategory: "",
      type: "image",
      scene: "",
      orientation: "portrait",
      prompt: "",
      textDefault: "",
      creditCost: 6,
      tags: "",
      defaultDuration: 8,
      defaultAspectRatio: "16:9",
      defaultResolution: "1080p",
      generateAudioDefault: true,
      sendEmailNotification: true,
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = form;

  const templateType = watch("type");
  const previewImageFile = watch("previewImageFile");
  const thumbnailFile = watch("thumbnailFile");
  const videoFile = watch("videoFile");

  // Load existing template data
  useEffect(() => {
    if (existingTemplate && isEditing) {
      reset({
        title: existingTemplate.title || "",
        occasion: existingTemplate.occasion || "",
        category: existingTemplate.category || "",
        subCategory: existingTemplate.subCategory || "",
        type: (existingTemplate.type as "image" | "video") || "image",
        scene: existingTemplate.scene || "",
        orientation: existingTemplate.orientation || "portrait",
        prompt: existingTemplate.prompt || "",
        textDefault: existingTemplate.textDefault || "",
        creditCost: existingTemplate.creditCost || 6,
        tags: existingTemplate.tags?.join(", ") || "",
        defaultDuration: existingTemplate.defaultDuration || 6,
        defaultAspectRatio: existingTemplate.defaultAspectRatio || "16:9",
        defaultResolution: existingTemplate.defaultResolution || "1080p",
        generateAudioDefault: existingTemplate.generateAudioDefault ?? true,
        sendEmailNotification: true,
      });
    }
  }, [existingTemplate, isEditing, reset]);

  // Reset form when dialog closes or switches to create mode
  useEffect(() => {
    if (!open || !templateId) {
      reset({
        title: "",
        occasion: "",
        category: "",
        subCategory: "",
        type: "image",
        scene: "",
        orientation: "portrait",
        prompt: "",
        textDefault: "",
        creditCost: 6,
        tags: "",
        defaultDuration: 8,
        defaultAspectRatio: "16:9",
        defaultResolution: "1080p",
        generateAudioDefault: true,
        sendEmailNotification: true,
        previewImageFile: undefined,
        thumbnailFile: undefined,
        videoFile: undefined,
      });
    }
  }, [open, templateId, reset]);

  // Upload file helper
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

  const onSubmit: SubmitHandler<TemplateFormValues> = async (data) => {
    try {
      // Manual file validation since it depends on isEditing
      if (data.type === "image" && !data.previewImageFile && !isEditing) {
        toast.error("Please upload a preview image");
        return;
      }
      if (
        data.type === "video" &&
        (!data.thumbnailFile || !data.videoFile) &&
        !isEditing
      ) {
        toast.error("Please upload thumbnail and video files");
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      let previewImageId: Id<"_storage"> | undefined;
      let thumbnailImageId: Id<"_storage"> | undefined;

      if (data.type === "image" && data.previewImageFile) {
        setUploadProgress(30);
        previewImageId = await uploadFile(data.previewImageFile);
      } else if (data.type === "video") {
        if (data.thumbnailFile) {
          setUploadProgress(20);
          thumbnailImageId = await uploadFile(data.thumbnailFile);
        }
        if (data.videoFile) {
          setUploadProgress(60);
          previewImageId = await uploadFile(data.videoFile);
        }
      }

      setUploadProgress(80);

      const commonFields = {
        title: data.title,
        occasion: data.occasion,
        category: data.category,
        subCategory: data.subCategory,
        type: data.type,
        scene: data.scene,
        orientation: data.orientation,
        prompt: data.prompt,
        textDefault: data.textDefault || "", // Ensure string
        creditCost: data.creditCost,
        tags: data.tags
          ? data.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        ...(data.type === "video" && {
          defaultDuration: data.defaultDuration as 4 | 6 | 8,
          defaultAspectRatio: data.defaultAspectRatio,
          defaultResolution: data.defaultResolution as "720p" | "1080p",
          generateAudioDefault: data.generateAudioDefault,
        }),
      };

      if (isEditing && templateId) {
        // Update existing template
        await updateTemplate({
          id: templateId,
          ...commonFields,
          // Note: File updates are not fully supported in this simplified version
          // as the update mutation expects URLs, not IDs.
          // For now, we only update metadata.
        });
        toast.success("Template updated successfully!");
      } else {
        await createTemplate({
          ...commonFields,
          previewImageId,
          thumbnailImageId,
          sendEmailNotification: data.sendEmailNotification,
        });
        toast.success("Template created successfully!");
      }

      setUploadProgress(100);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save template");
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

        {isLoadingTemplate ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
              <p className="text-sm text-slate-400">Loading template data...</p>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            className="space-y-4 max-h-[75vh] overflow-y-auto pr-2"
          >
            <div className="flex gap-2 items-center">
              {/* Title */}
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-300">
                  Template Title *
                </label>
                <input
                  {...register("title")}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Cozy Fireplace Gathering"
                />
                {errors.title && (
                  <p className="text-[10px] text-red-400">
                    {errors.title.message}
                  </p>
                )}
              </div>

              {/* Occasion */}
              <div>
                <label className="text-xs font-medium text-slate-300">
                  Occasion *
                </label>
                <input
                  {...register("occasion")}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Christmas"
                />
                {errors.occasion && (
                  <p className="text-[10px] text-red-400">
                    {errors.occasion.message}
                  </p>
                )}
              </div>
            </div>

            {/* Category, SubCategory & Template Type */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Category *
                </label>
                <input
                  {...register("category")}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Classic"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Sub-Category
                </label>
                <input
                  {...register("subCategory")}
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
                    onClick={() => setValue("type", "image")}
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
                    onClick={() => setValue("type", "video")}
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
                <input
                  {...register("scene")}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., tree"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Orientation *
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setValue("orientation", "portrait")}
                    className={`flex-1 rounded-full border border-slate-700 px-3 py-2 text-[11px] font-medium transition-colors ${
                      watch("orientation") === "portrait"
                        ? "bg-indigo-500 text-slate-200"
                        : "bg-slate-800/50 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    Portrait
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue("orientation", "landscape")}
                    className={`flex-1 rounded-full border border-slate-700 px-3 py-2 text-[11px] font-medium transition-colors ${
                      watch("orientation") === "landscape"
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
                      setValue("previewImageFile", file);
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
                  Recommended: 4:5 or 1:1 ratio, max 5MB.
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
                        setValue("thumbnailFile", file);
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
                        setValue("videoFile", file);
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
                </div>
              </div>
            )}

            {/* Video-specific settings */}
            {templateType === "video" && (
              <div className="space-y-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700">
                <h3 className="text-xs font-semibold text-slate-200">
                  Video Settings (Defaults)
                </h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {/* Duration - Display only */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">
                      Duration
                    </label>
                    <div className="w-full rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-xs text-slate-400">
                      8 seconds
                    </div>
                  </div>

                  {/* Aspect Ratio - Display only */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">
                      Aspect Ratio
                    </label>
                    <div className="w-full rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-xs text-slate-400">
                      16:9 (Landscape)
                    </div>
                  </div>

                  {/* Resolution - Display only */}
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
                    {...register("generateAudioDefault")}
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
                {...register("prompt")}
                className="min-h-[120px] w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none ring-0 placeholder:text-slate-500 focus:border-slate-500"
                placeholder="Describe the scene, style, and mood for this template..."
              />
              {errors.prompt && (
                <p className="text-[10px] text-red-400">
                  {errors.prompt.message}
                </p>
              )}
            </div>

            {/* Default Text & Credit Cost */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Default Text
                </label>
                <input
                  {...register("textDefault")}
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
                  {...register("creditCost")}
                  min={1}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                />
                {errors.creditCost && (
                  <p className="text-[10px] text-red-400">
                    {errors.creditCost.message}
                  </p>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Tags</label>
              <input
                {...register("tags")}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                placeholder="cozy, family, fireplace, landscape (comma-separated)"
              />
              <p className="text-[10px] text-slate-500">
                Separate tags with commas
              </p>
            </div>

            {/* Email Notification Toggle - Only show when creating, not editing */}
            {!isEditing && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
                <input
                  type="checkbox"
                  id="sendEmail"
                  {...register("sendEmailNotification")}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
                />
                <label
                  htmlFor="sendEmail"
                  className="text-xs text-slate-300 flex-1 cursor-pointer flex items-center"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  <span>
                    Send email notification to all subscribed users about this
                    new template
                  </span>
                </label>
              </div>
            )}

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
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
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
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
