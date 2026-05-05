import { useEffect, useMemo, useState } from "react";
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

type MainCategory = "occasions" | "personal" | "spiritual" | "pets";
type TemplateType = "image" | "video";
type Orientation = "portrait" | "landscape";

type TemplateDbRow = {
  id: string;

  title: string | null;
  prompt: string | null;

  main_category?: MainCategory | null;

  occasion: string | null;
  category: string | null;
  sub_category?: string | null;
  subcategory?: string | null;

  type: string | null;
  scene: string | null;
  orientation: string | null;

  text_default?: string | null;
  textdefault?: string | null;

  credit_cost?: number | null;
  creditcost?: number | null;

  tags: string[] | null;

  preview_url: string | null;
  thumbnail_url: string | null;
  video_url?: string | null;

  style_id?: string | null;

  default_duration?: number | null;
  defaultduration?: number | null;

  default_aspect_ratio?: string | null;
  defaultaspectratio?: string | null;

  default_resolution?: string | null;
  defaultresolution?: string | null;

  generate_audio_default?: boolean | null;
  generateaudiodefault?: boolean | null;

  negative_prompt_default?: string | null;
  negativepromptdefault?: string | null;

  is_active?: boolean | null;
  isactive?: boolean | null;
};

type OccasionOption = {
  value: string;
  label: string;
  mainCategory: MainCategory;
};

const BUCKET = "templates";
const CUSTOM_OCCASION = "__custom_occasion__";

const MAIN_CATEGORIES: Array<{
  value: MainCategory;
  label: string;
  description: string;
}> = [
  {
    value: "occasions",
    label: "Occasions",
    description: "Birthdays, holidays, weddings, graduation",
  },
  {
    value: "personal",
    label: "Personal",
    description: "Names, kids, love, apology",
  },
  {
    value: "spiritual",
    label: "Spiritual",
    description: "Bible verses, prayer, faith, hope",
  },
  {
    value: "pets",
    label: "Pets",
    description: "Dogs, cats, pet loss, funny pets",
  },
];

const BASE_OCCASIONS: OccasionOption[] = [
  { value: "christmas", label: "Christmas", mainCategory: "occasions" },
  { value: "birthday", label: "Birthday", mainCategory: "occasions" },
  { value: "anniversary", label: "Anniversary", mainCategory: "occasions" },
  { value: "thanksgiving", label: "Thanksgiving", mainCategory: "occasions" },
  { value: "thank_you", label: "Thank You", mainCategory: "occasions" },
  { value: "new_born", label: "New Born", mainCategory: "occasions" },
  { value: "baby_reveal", label: "Baby Reveal", mainCategory: "occasions" },
  { value: "new_years_eve", label: "New Year’s Eve", mainCategory: "occasions" },
  { value: "valentines_day", label: "Valentine’s Day", mainCategory: "occasions" },
  { value: "mothers_day", label: "Mother’s Day", mainCategory: "occasions" },
  { value: "fathers_day", label: "Father’s Day", mainCategory: "occasions" },
  { value: "graduation", label: "Graduation", mainCategory: "occasions" },
  { value: "easter", label: "Easter", mainCategory: "occasions" },
  { value: "wedding", label: "Wedding", mainCategory: "occasions" },
  { value: "pregnancy", label: "Pregnancy", mainCategory: "occasions" },

  { value: "sorry", label: "Sorry / Apology", mainCategory: "personal" },
  { value: "name_cards", label: "Name Cards", mainCategory: "personal" },
  { value: "kids", label: "Kids", mainCategory: "personal" },
  { value: "love", label: "Love", mainCategory: "personal" },

  { value: "bible_verses", label: "Bible Verses", mainCategory: "spiritual" },
  { value: "prayer", label: "Prayer", mainCategory: "spiritual" },
  { value: "encouragement", label: "Encouragement", mainCategory: "spiritual" },
  { value: "gratitude", label: "Gratitude", mainCategory: "spiritual" },

  { value: "dogs", label: "Dogs", mainCategory: "pets" },
  { value: "cats", label: "Cats", mainCategory: "pets" },
  { value: "pet_loss", label: "Pet Loss", mainCategory: "pets" },
  { value: "funny_pets", label: "Funny Pets", mainCategory: "pets" },
];

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeMainCategory(value: unknown): MainCategory {
  const key = normalizeKey(value);

  if (
    key === "occasions" ||
    key === "personal" ||
    key === "spiritual" ||
    key === "pets"
  ) {
    return key;
  }

  return "occasions";
}

function formatLabel(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bNew Years Eve\b/g, "New Year’s Eve")
    .replace(/\bValentines Day\b/g, "Valentine’s Day")
    .replace(/\bMothers Day\b/g, "Mother’s Day")
    .replace(/\bFathers Day\b/g, "Father’s Day")
    .replace(/\bBible Verses\b/g, "Bible Verses")
    .replace(/\bPet Loss\b/g, "Pet Loss");
}

function safeTagsToString(tags: string[] | null | undefined) {
  return Array.isArray(tags) ? tags.join(", ") : "";
}

function parseTags(input: string) {
  return String(input || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function safeExt(name: string) {
  const parts = String(name || "").split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  return ext && ext.length <= 6 ? ext : "bin";
}

function rand6() {
  return Math.random().toString(16).slice(2, 8);
}

function getOccasionLabel(value: string | null, options: OccasionOption[]) {
  if (!value) return "";
  return options.find((item) => item.value === value)?.label || formatLabel(value);
}

function getOccasionMainCategory(
  value: string | null,
  options: OccasionOption[],
  fallback: MainCategory
): MainCategory {
  if (!value) return fallback;
  return options.find((item) => item.value === value)?.mainCategory || fallback;
}

function getEffectiveStyle(style: string, occasion: string | null, options: OccasionOption[]) {
  return style.trim() || getOccasionLabel(occasion, options).trim();
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

function buildAiPreviewPrompt(input: {
  title: string;
  mainCategory: MainCategory;
  occasionLabel: string;
  style: string;
  subCategory: string;
  scene: string;
  orientation: Orientation;
  prompt: string;
}) {
  return [
    "Create a realistic premium preview image for an AI greeting card / personalized gift template.",
    "The image must look like a real lifestyle photo, not an AI poster, not a stock mockup, not a fantasy render.",
    "",
    `Main category: ${input.mainCategory}.`,
    `Occasion / collection: ${input.occasionLabel || "general"}.`,
    `Template title: ${input.title || "Untitled template"}.`,
    `Style: ${input.style || "Natural cinematic"}.`,
    input.subCategory ? `Sub-category / audience: ${input.subCategory}.` : "",
    input.scene ? `Scene/location: ${input.scene}.` : "",
    `Orientation: ${input.orientation}.`,
    "",
    "Show a natural emotional moment connected clearly to the selected category.",
    "Use realistic people or animals when relevant, real skin/fur texture, natural posture, believable expressions, natural lighting, believable clothes, and a real environment.",
    "The category must be visually obvious from props, setting, outfits, decorations, animals, spiritual atmosphere, or emotional context.",
    "",
    "Composition rules:",
    "- cinematic photo composition",
    "- shallow depth of field",
    "- clean premium background",
    "- subject centered or rule-of-thirds",
    "- leave subtle empty space for optional greeting-card text",
    "- no clutter",
    "",
    "Avoid:",
    "- fake AI faces",
    "- plastic skin",
    "- distorted hands, eyes, paws, mouths or limbs",
    "- readable random text",
    "- logos",
    "- watermarks",
    "- cartoon style",
    "- 3D render",
    "- poster design",
    "- text-heavy graphic design",
    "",
    input.prompt
      ? `Use this template context as the main creative direction: ${input.prompt}`
      : "",
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

function buildSlug(input: {
  mainCategory: MainCategory;
  occasion: string;
  style: string;
  title: string;
}) {
  return normalizeKey(
    `${input.mainCategory}_${input.occasion}_${input.style}_${input.title}`
  );
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
}: CreateTemplateDialogProps) {
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("templateId");
  const isEditing = Boolean(templateId);

  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [loadingOccasions, setLoadingOccasions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const [dbOccasions, setDbOccasions] = useState<OccasionOption[]>([]);

  const [mainCategory, setMainCategory] = useState<MainCategory>("occasions");
  const [title, setTitle] = useState("");
  const [occasion, setOccasion] = useState<string | null>(null);
  const [customOccasion, setCustomOccasion] = useState("");
  const [style, setStyle] = useState("");
  const [subCategory, setSubCategory] = useState("");

  const [type, setType] = useState<TemplateType>("image");
  const [scene, setScene] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("portrait");

  const [prompt, setPrompt] = useState("");
  const [textDefault, setTextDefault] = useState("");
  const [creditCost, setCreditCost] = useState(6);
  const [tags, setTags] = useState("");

  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  const [styleId, setStyleId] = useState<string | null>(null);

  const [previewImageFile, setPreviewImageFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [existingPreviewUrl, setExistingPreviewUrl] = useState("");
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState("");
  const [aiPreviewUrl, setAiPreviewUrl] = useState("");

  const [generateAudioDefault, setGenerateAudioDefault] = useState(true);
  const [defaultDuration] = useState(8);
  const [defaultAspectRatio] = useState("16:9");
  const [defaultResolution] = useState("1080p");

  const occasionOptions = useMemo(() => {
    const map = new Map<string, OccasionOption>();

    BASE_OCCASIONS.forEach((item) => {
      if (item.mainCategory === mainCategory) {
        map.set(item.value, item);
      }
    });

    dbOccasions.forEach((item) => {
      if (item.value && item.mainCategory === mainCategory) {
        map.set(item.value, item);
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [dbOccasions, mainCategory]);

  const finalOccasion = useMemo(() => {
    if (occasion === CUSTOM_OCCASION) return normalizeKey(customOccasion);
    return occasion;
  }, [occasion, customOccasion]);

  const finalOccasionLabel = useMemo(() => {
    if (occasion === CUSTOM_OCCASION) return formatLabel(customOccasion);
    return getOccasionLabel(occasion, occasionOptions);
  }, [occasion, customOccasion, occasionOptions]);

  const effectiveStyle = getEffectiveStyle(style, finalOccasion, occasionOptions);
  const visiblePreviewUrl = aiPreviewUrl || existingPreviewUrl || existingThumbnailUrl;

  const stylePreviewOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();

    if (effectiveStyle) {
      map.set(normalizeKey(effectiveStyle), {
        value: normalizeKey(effectiveStyle),
        label: formatLabel(effectiveStyle),
      });
    }

    if (subCategory.trim()) {
      map.set(normalizeKey(subCategory), {
        value: normalizeKey(subCategory),
        label: formatLabel(subCategory),
      });
    }

    return Array.from(map.values());
  }, [effectiveStyle, subCategory]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadOccasions() {
      try {
        setLoadingOccasions(true);

        const { data, error } = await supabase
          .from("templates")
          .select("main_category, occasion")
          .not("occasion", "is", null);

        if (cancelled) return;
        if (error) throw error;

        const map = new Map<string, OccasionOption>();

        (data || []).forEach((row: any) => {
          const value = normalizeKey(row.occasion);
          if (!value) return;

          const rowMainCategory = normalizeMainCategory(row.main_category);

          map.set(`${rowMainCategory}:${value}`, {
            value,
            label: formatLabel(row.occasion),
            mainCategory: rowMainCategory,
          });
        });

        setDbOccasions(Array.from(map.values()));
      } catch (error) {
        console.error("[CreateTemplateDialog] load occasions error:", error);
        toast.error("Failed to load occasions from database");
      } finally {
        if (!cancelled) setLoadingOccasions(false);
      }
    }

    void loadOccasions();

    return () => {
      cancelled = true;
    };
  }, [open]);

  function handleMainCategoryChange(value: string) {
    const next = normalizeMainCategory(value);

    setMainCategory(next);
    setOccasion(null);
    setCustomOccasion("");
    setStyle("");
    setSubCategory("");
  }

  function handleOccasionChange(value: string) {
    setOccasion(value);

    if (value === CUSTOM_OCCASION) {
      setCustomOccasion("");
      return;
    }

    const label = getOccasionLabel(value, occasionOptions);

    if (!style.trim()) {
      setStyle(label);
    }
  }

  function resetForm() {
    setMainCategory("occasions");
    setTitle("");
    setOccasion(null);
    setCustomOccasion("");
    setStyle("");
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
  }

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
              "main_category",
              "occasion",
              "category",
              "sub_category",
              "subcategory",
              "type",
              "scene",
              "orientation",
              "prompt",
              "text_default",
              "textdefault",
              "credit_cost",
              "creditcost",
              "tags",
              "preview_url",
              "thumbnail_url",
              "video_url",
              "style_id",
              "default_duration",
              "defaultduration",
              "default_aspect_ratio",
              "defaultaspectratio",
              "default_resolution",
              "defaultresolution",
              "generate_audio_default",
              "generateaudiodefault",
              "is_active",
              "isactive",
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

        const template = data as unknown as TemplateDbRow;
        const normalizedOccasion = normalizeKey(template.occasion);
        const loadedMainCategory = normalizeMainCategory(template.main_category);

        setMainCategory(loadedMainCategory);
        setTitle(template.title || "");
        setOccasion(normalizedOccasion || null);
        setCustomOccasion("");
        setStyle(template.category || formatLabel(normalizedOccasion) || "");
        setSubCategory(template.sub_category ?? template.subcategory ?? "");
        setType(template.type === "video" ? "video" : "image");
        setScene(template.scene || "");
        setOrientation(template.orientation === "landscape" ? "landscape" : "portrait");
        setPrompt(template.prompt || "");
        setTextDefault(template.text_default ?? template.textdefault ?? "");
        setCreditCost(Number(template.credit_cost ?? template.creditcost ?? 6));
        setTags(safeTagsToString(template.tags));
        setStyleId(template.style_id || null);
        setGenerateAudioDefault(
          template.generate_audio_default ?? template.generateaudiodefault ?? true
        );

        setExistingPreviewUrl(template.preview_url || "");
        setExistingThumbnailUrl(template.thumbnail_url || "");
        setAiPreviewUrl("");

        setPreviewImageFile(null);
        setThumbnailFile(null);
        setVideoFile(null);
      } catch (error) {
        console.error("[CreateTemplateDialog] load error:", error);
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

  function validate() {
    if (!mainCategory) return "Main category is required";
    if (!title.trim()) return "Template Title is required";
    if (!finalOccasion) return "Occasion / collection is required";
    if (!effectiveStyle) return "Style is required";
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
  }

  async function handleGenerateAiPreview() {
    if (!title.trim()) {
      toast.error("Add a template title first");
      return;
    }

    if (!finalOccasion) {
      toast.error("Select or create an occasion first");
      return;
    }

    const resolvedStyle = getEffectiveStyle(style, finalOccasion, occasionOptions);

    if (!resolvedStyle) {
      toast.error("Add a style first");
      return;
    }

    if (!style.trim()) {
      setStyle(resolvedStyle);
    }

    try {
      setGeneratingPreview(true);

      const aiPrompt = buildAiPreviewPrompt({
        title,
        mainCategory,
        occasionLabel: finalOccasionLabel,
        style: resolvedStyle,
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
            main_category: mainCategory,
            occasion: finalOccasion,
            category: resolvedStyle,
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

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const errorMessage = validate();

    if (errorMessage) {
      toast.error(errorMessage);
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

      const finalStyleId = styleId || normalizeKey(effectiveStyle);

      const payload: Record<string, any> = {
        slug: buildSlug({
          mainCategory,
          occasion: finalOccasion || "",
          style: effectiveStyle,
          title,
        }),
        title: title.trim(),
        main_category: mainCategory,
        occasion: finalOccasion,
        category: effectiveStyle,
        sub_category: subCategory.trim() || null,
        subcategory: subCategory.trim() || null,
        type,
        scene: scene.trim(),
        orientation,
        prompt: prompt.trim(),
        text_default: textDefault || null,
        textdefault: textDefault || null,
        credit_cost: Number(creditCost),
        creditcost: Number(creditCost),
        tags: parseTags(tags),
        style_id: finalStyleId,
        is_active: true,
        isactive: true,
      };

      if (type === "video") {
        payload.default_duration = defaultDuration;
        payload.defaultduration = defaultDuration;
        payload.default_aspect_ratio = defaultAspectRatio;
        payload.defaultaspectratio = defaultAspectRatio;
        payload.default_resolution = defaultResolution;
        payload.defaultresolution = defaultResolution;
        payload.generate_audio_default = generateAudioDefault;
        payload.generateaudiodefault = generateAudioDefault;
      } else {
        payload.default_duration = null;
        payload.defaultduration = null;
        payload.default_aspect_ratio = null;
        payload.defaultaspectratio = null;
        payload.default_resolution = null;
        payload.defaultresolution = null;
        payload.generate_audio_default = null;
        payload.generateaudiodefault = null;
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
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent className="max-w-4xl border-slate-800 bg-slate-900 text-slate-50">
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
            <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
              <label className="mb-2 block text-xs font-medium text-slate-300">
                Main Category *
              </label>

              <div className="grid gap-2 md:grid-cols-4">
                {MAIN_CATEGORIES.map((item) => {
                  const active = mainCategory === item.value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleMainCategoryChange(item.value)}
                      className={[
                        "rounded-xl border px-3 py-3 text-left transition",
                        active
                          ? "border-indigo-400 bg-indigo-500/20 text-white"
                          : "border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800",
                      ].join(" ")}
                    >
                      <div className="text-xs font-semibold">{item.label}</div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        {item.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_240px]">
              <div>
                <label className="text-xs font-medium text-slate-300">
                  Template Title *
                </label>

                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Cozy Fireplace Gathering"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">
                  Occasion / Collection *
                </label>

                <Select
                  value={occasion ?? undefined}
                  onValueChange={handleOccasionChange}
                >
                  <SelectTrigger className="h-[34px] w-full rounded-xl border border-slate-700 bg-slate-800/50 text-xs text-slate-200">
                    <SelectValue
                      placeholder={loadingOccasions ? "Loading..." : "Select collection"}
                    />
                  </SelectTrigger>

                  <SelectContent className="max-h-[360px] border-slate-700 bg-slate-900 text-slate-200">
                    {occasionOptions.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                        className="focus:bg-slate-800 focus:text-slate-50"
                      >
                        {item.label}
                      </SelectItem>
                    ))}

                    <SelectItem
                      value={CUSTOM_OCCASION}
                      className="border-t border-slate-800 text-indigo-200 focus:bg-slate-800 focus:text-slate-50"
                    >
                      + Create new collection
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {occasion === CUSTOM_OCCASION ? (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
                <label className="text-xs font-medium text-slate-300">
                  New Collection Name *
                </label>

                <input
                  value={customOccasion}
                  onChange={(event) => {
                    setCustomOccasion(event.target.value);
                    if (!style.trim()) setStyle(formatLabel(event.target.value));
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Engagement, Baptism, Halloween"
                />

                <p className="mt-2 text-[10px] text-slate-500">
                  After saving, this collection appears in the admin and
                  generator filters.
                </p>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Style *
                </label>

                <input
                  value={style}
                  onChange={(event) => setStyle(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                  placeholder="e.g., Classic, Cozy, Romantic"
                />

                <p className="text-[10px] text-slate-500">
                  This becomes the style filter inside the selected collection.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Sub-Category
                </label>

                <input
                  value={subCategory}
                  onChange={(event) => setSubCategory(event.target.value)}
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

            {stylePreviewOptions.length > 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                <p className="mb-2 text-xs font-medium text-slate-300">
                  Generator filter preview
                </p>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-[11px] text-indigo-100">
                    {formatLabel(mainCategory)}
                  </span>

                  <span className="rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-[11px] text-indigo-100">
                    {finalOccasionLabel || "Collection"}
                  </span>

                  {stylePreviewOptions.map((item) => (
                    <span
                      key={item.value}
                      className="rounded-full border border-slate-700 bg-slate-800/70 px-3 py-1 text-[11px] text-slate-300"
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Scene *
                </label>

                <input
                  value={scene}
                  onChange={(event) => setScene(event.target.value)}
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
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
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
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
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
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setVideoFile(file);
                      if (file) toast.success(`Selected: ${file.name}`);
                    }}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("video-upload")?.click()
                    }
                    className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/50 px-3 py-6 text-xs text-slate-400 transition-colors hover:bg-slate-800"
                  >
                    {videoFile
                      ? `Selected: ${videoFile.name}`
                      : "Click to upload video"}
                  </button>
                </div>
              </div>
            )}

            {type === "video" ? (
              <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/30 p-3">
                <h3 className="text-xs font-semibold text-slate-200">
                  Video Settings (Defaults)
                </h3>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-xs text-slate-400">
                    Duration: 8 seconds
                  </div>

                  <div className="rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-xs text-slate-400">
                    Aspect: 16:9
                  </div>

                  <div className="rounded-xl border border-slate-700 bg-slate-800/30 px-3 py-2 text-xs text-slate-400">
                    Resolution: 1080p
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="generateAudio"
                    checked={generateAudioDefault}
                    onChange={(event) =>
                      setGenerateAudioDefault(event.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800"
                  />

                  <label htmlFor="generateAudio" className="text-xs text-slate-300">
                    Generate audio by default
                  </label>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">
                Prompt *
              </label>

              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-[120px] w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-slate-500"
                placeholder="Describe the scene, style, mood and how the user photo should be transformed..."
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">
                  Default Text
                </label>

                <input
                  value={textDefault}
                  onChange={(event) => setTextDefault(event.target.value)}
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
                  onChange={(event) => setCreditCost(Number(event.target.value))}
                  min={1}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Tags</label>

              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-500"
                placeholder="cozy, family, fireplace, landscape"
              />
            </div>

            {!isEditing ? (
              <div className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={sendEmailNotification}
                  onChange={(event) =>
                    setSendEmailNotification(event.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
                />

                <label
                  htmlFor="sendEmail"
                  className="flex flex-1 cursor-pointer items-center text-xs text-slate-300"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  <span>
                    Send email notification to all subscribed users about this
                    new template
                  </span>
                </label>
              </div>
            ) : null}

            {isUploading ? (
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
            ) : null}

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
                {saving
                  ? "Saving..."
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

export default CreateTemplateDialog;