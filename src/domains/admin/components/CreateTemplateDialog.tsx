import React, { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useSearchParams } from "react-router-dom";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { useForm, SubmitHandler, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  templateCreateSchema,
  templateUpdateSchema,
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

/**
 * ✅ Canonical occasion slugs (use these everywhere: admin + funnel)
 * (labels are only for UI)
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

/**
 * ✅ Style options per occasion (optional but recommended)
 * Keep IDs identical to what funnel stores as `style_id`
 */
const OCCASION_STYLES: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  new_born: [
    { value: "soft_pastel", label: "Soft Pastel" },
    { value: "cozy_blanket", label: "Cozy Blanket" },
    { value: "angel_sleep", label: "Angel Sleep" },
    { value: "first_light", label: "First Light" },
    { value: "minimal_studio", label: "Minimal Studio" },
    { value: "golden_memory", label: "Golden Memory" },
  ],
  // you can add later:
  // christmas: [...],
  // birthday: [...],
};

export function CreateTemplateDialog({ open, onOpenChange }: CreateTemplateDialogProps) {
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

  // Use different validation schemas for create vs update
  const validationSchema = useMemo(
    () => (isEditing ? templateUpdateSchema : templateCreateSchema),
    [isEditing]
  );

  // Form Setup
  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(validationSchema) as Resolver<TemplateFormValues>,
    defaultValues: {
      title: "",
      occasion: "", // ✅ will store slug (e.g., "new_born")
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

      // ✅ NEW optional field (requires it in your TemplateFormValues + schema if you validate it)
      styleId: "",
    } as any,
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

  // ✅ watch occasion + style
  const occasionValue = watch("occasion") || "";
  // @ts-expect-error - if not in your type yet, add it in TemplateFormValues
  const styleIdValue = (watch("styleId") as string) || "";

  const styleOptions = OCCASION_STYLES[occasionValue] || [];
  const shouldShowStyle = styleOptions.length > 0;

  // Load existing template data
  useEffect(() => {
    if (existingTemplate && isEditing) {
      const normalizedType: "image" | "video" =
        existingTemplate.type === "video" ? "video" : "image";

      reset({
        title: existingTemplate.title || "",
        occasion: existingTemplate.occasion || "", // ✅ should already be slug
        category: existingTemplate.category || "",
        subCategory: existingTemplate.subCategory || "",
        type: normalizedType,
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

        // ✅ NEW
        styleId: (existingTemplate as any).styleId || "",
      } as any);
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

        // ✅ NEW
        styleId: "",
      } as any);
    }
  }, [open, templateId, reset]);

  // If occasion changes, clear styleId if it's not valid anymore
  useEffect(() => {
    if (!shouldShowStyle) {
      // @ts-expect-error
      setValue("styleId", "");
      return;
    }
    if (styleIdValue && !styleOptions.some((s) => s.value === styleIdValue)) {
      // @ts-expect-error
      setValue("styleId", "");
    }
  }, [occasionValue]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (!isEditing) {
        if (data.type === "image" && !data.previewImageFile) {
          toast.error("Please upload a preview image");
          return;
        }
        if (data.type === "video" && (!data.thumbnailFile || !data.videoFile)) {
          toast.error("Please upload thumbnail and video files");
          return;
        }
      }

      setIsUploading(true);
      setUploadProgress(0);

      let previewImageId: Id<"_storage"> | undefined;
      let thumbnailImageId: Id<"_storage"> | undefined;

      if (data.previewImageFile) {
        setUploadProgress(30);
        previewImageId = await uploadFile(data.previewImageFile);
      }
      if (data.thumbnailFile) {
        setUploadProgress(20);
        thumbnailImageId = await uploadFile(data.thumbnailFile);
      }
      if (data.videoFile) {
        setUploadProgress(60);
        previewImageId = await uploadFile(data.videoFile);
      }

      setUploadProgress(80);

      
      const styleId = (data as any).styleId || "";

      if (isEditing && templateId) {
        const updatePayload: Record<string, unknown> = { id: templateId };

        if (data.title) updatePayload.title = data.title;
        if (data.occasion) updatePayload.occasion = data.occasion; // ✅ slug
        if (data.category !== undefined) updatePayload.category = data.category;
        if (data.subCategory !== undefined) updatePayload.subCategory = data.subCategory;
        if (data.type) updatePayload.type = data.type;
        if (data.scene !== undefined) updatePayload.scene = data.scene;
        if (data.orientation) updatePayload.orientation = data.orientation;
        if (data.prompt) updatePayload.prompt = data.prompt;
        if (data.textDefault !== undefined) updatePayload.textDefault = data.textDefault;
        if (data.creditCost !== undefined && data.creditCost !== null) {
          updatePayload.creditCost = Number(data.creditCost);
        }
        if (data.tags) {
          updatePayload.tags = data.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        }
        if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

        // ✅ NEW: styleId update (optional)
        if (styleId !== undefined) updatePayload.styleId = styleId || "";

        if (data.type === "video") {
          if (data.defaultDuration !== undefined) {
            const validDurations = [4, 6, 8] as const;
            const durationNum = Number(data.defaultDuration);
            if (validDurations.includes(durationNum as 4 | 6 | 8)) {
              updatePayload.defaultDuration = durationNum as 4 | 6 | 8;
            }
          }
          if (data.defaultAspectRatio) updatePayload.defaultAspectRatio = data.defaultAspectRatio;
          if (data.defaultResolution) {
            const validResolutions = ["720p", "1080p"] as const;
            if (validResolutions.includes(data.defaultResolution as "720p" | "1080p")) {
              updatePayload.defaultResolution = data.defaultResolution as "720p" | "1080p";
            }
          }
          if (data.generateAudioDefault !== undefined) {
            updatePayload.generateAudioDefault = data.generateAudioDefault;
          }
        }

        await updateTemplate(updatePayload as any);
        toast.success("Template updated successfully!");
      } else {
        const creditCostNumber = Number(data.creditCost);
        const validDurations = [4, 6, 8] as const;
        const durationNum = Number(data.defaultDuration);
        const defaultDuration = validDurations.includes(durationNum as 4 | 6 | 8)
          ? (durationNum as 4 | 6 | 8)
          : 8;

        const validResolutions = ["720p", "1080p"] as const;
        const defaultResolution = validResolutions.includes(data.defaultResolution as "720p" | "1080p")
          ? (data.defaultResolution as "720p" | "1080p")
          : "1080p";

        const createPayload = {
          title: data.title,
          occasion: data.occasion, // ✅ slug
          category: data.category,
          subCategory: data.subCategory,
          type: data.type,
          scene: data.scene,
          orientation: data.orientation,
          prompt: data.prompt,
          textDefault: data.textDefault || "",
          creditCost: creditCostNumber,
          tags: data.tags
            ? data.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
          previewImageId,
          thumbnailImageId,
          sendEmailNotification: data.sendEmailNotification,

          // ✅ NEW: styleId for funnel filtering
          styleId: styleId || "",

          ...(data.type === "video" && {
            defaultDuration,
            defaultAspectRatio: data.defaultAspectRatio,
            defaultResolution,
            generateAudioDefault: data.generateAudioDefault,
          }),
        };

        await createTemplate(createPayload as any);
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
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(onSubmit, (errs) => {
                const firstError = Object.values(errs)[0];
                const errorMessage = firstError?.message || "Please check the form for errors";
                toast.error(String(errorMessage));
                console.error("Form validation errors:", errs);
              })(e);
            }}
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
                  <p className="text-[10px] text-red-400">{errors.title.message}</p>
                )}
              </div>

              {/* Occasion (slug) */}
              <div className="w-[220px]">
                <label className="text-xs font-medium text-slate-300">
                  Occasion *
                </label>
                <Select
                  value={occasionValue || ""}
                  onValueChange={(v) => setValue("occasion", v, { shouldValidate: true })}
                >
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
                {errors.occasion && (
                  <p className="text-[10px] text-red-400">{errors.occasion.message}</p>
                )}
              </div>
            </div>

            {/* ✅ Style (only if occasion has styles) */}
            {shouldShowStyle && (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <label className="text-xs font-medium text-slate-300">
                    Style (optional)
                  </label>
                  <Select
                    value={styleIdValue || ""}
                    onValueChange={(v) => {
                      // @ts-expect-error
                      setValue("styleId", v, { shouldValidate: false });
                    }}
                  >
                    <SelectTrigger className="w-full rounded-xl border border-slate-700 bg-slate-800/50 text-xs text-slate-200 h-[34px]">
                      <SelectValue placeholder="All styles" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                      <SelectItem
                        value=""
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
                <label className="text-xs font-medium text-slate-300">Scene *</label>
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
                  onClick={() => document.getElementById("preview-image-upload")?.click()}
                  className="flex w-full items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/50 px-3 py-6 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {previewImageFile ? `Selected: ${previewImageFile.name}` : "Click to upload preview image"}
                </button>
                <p className="text-[10px] text-slate-500">
                  Recommended: 4:5 or 1:1 ratio, max 5MB.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-slate-300">Thumbnail Image *</label>
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
                    onClick={() => document.getElementById("thumbnail-upload")?.click()}
                    className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/50 px-3 py-6 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                  >
                    <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {thumbnailFile ? `Selected: ${thumbnailFile.name}` : "Click to upload thumbnail"}
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-slate-300">Video File *</label>
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
                    onClick={() => document.getElementById("video-upload")?.click()}
                    className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/50 px-3 py-6 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                  >
                    <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {videoFile ? `Selected: ${videoFile.name}` : "Click to upload video"}
                  </button>
                </div>
              </div>
            )}

            {/* Video-specific settings */}
            {templateType === "video" && (
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
                    {...register("generateAudioDefault")}
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
                <p className="text-[10px] text-red-400">{errors.prompt.message}</p>
              )}
            </div>

            {/* Default Text & Credit Cost */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Default Text</label>
                <input
                  {...register("textDefault")}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Warm Holiday Moments"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Credit Cost *</label>
                <input
                  type="number"
                  {...register("creditCost")}
                  min={1}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                />
                {errors.creditCost && (
                  <p className="text-[10px] text-red-400">{errors.creditCost.message}</p>
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
              <p className="text-[10px] text-slate-500">Separate tags with commas</p>
            </div>

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
                  <span>Send email notification to all subscribed users about this new template</span>
                </label>
              </div>
            )}

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
                {isUploading ? "Uploading..." : isEditing ? "Update Template" : "Create Template"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
