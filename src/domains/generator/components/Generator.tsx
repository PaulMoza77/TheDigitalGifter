import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import VideoModal from "@/components/VideoModal";
import TemplateCard from "@/components/TemplateCard";
import type { TemplateSummary } from "@/types/templates";

import { useTemplatesQuery, useUserCreditsQuery, useJobsQuery } from "@/data";
import { useCreateVideoJobMutation } from "@/data";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

import { cn } from "@/lib/utils";
import {
  Info,
  Sparkles,
  ImageIcon,
  Video,
  Heart,
  Cross,
  PawPrint,
  CalendarDays,
  LayoutGrid,
} from "lucide-react";
import LanguageSelector from "@/components/LanguageSelector";
import { useCreditsFunnel } from "@/contexts/CreditsFunnelContext";
import { useBootstrapUser } from "@/hooks/useBootstrapUser";
import { uploadFileToStorage } from "@/lib/uploadFileToStorage";
import { supabase } from "@/lib/supabase";
import { occasions } from "@/constants/occasions";

const ALL_CATEGORIES = "all";
const ALL_OCCASIONS = "all";
const ALL_STYLES = "all";

type CategoryKey = "all" | "occasions" | "personal" | "spiritual" | "pets";

const CATEGORY_OPTIONS: Array<{
  value: CategoryKey;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    value: "all",
    label: "All",
    description: "Everything",
    icon: LayoutGrid,
  },
  {
    value: "occasions",
    label: "Occasions",
    description: "Birthdays, holidays",
    icon: CalendarDays,
  },
  {
    value: "personal",
    label: "Personal",
    description: "Names, kids, love",
    icon: Heart,
  },
  {
    value: "spiritual",
    label: "Spiritual",
    description: "Faith, prayer, hope",
    icon: Cross,
  },
  {
    value: "pets",
    label: "Pets",
    description: "Dogs, cats, memories",
    icon: PawPrint,
  },
];

function SnowBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const flakes = Array.from({ length: 50 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2 + 0.5,
      o: Math.random() * 0.4 + 0.3,
      s: Math.random() * 0.5 + 0.2,
    }));

    let raf = 0;

    const draw = () => {
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, "#060a12");
      gradient.addColorStop(1, "#0b1220");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      flakes.forEach((f) => {
        f.y += f.s;
        if (f.y > h + 4) f.y = -4;
        f.x += Math.sin(f.y * 0.01) * 0.3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${f.o})`;
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 -z-10" />
  );
}

type JobRow = {
  id: string;
  type: "image" | "video";
  status: "queued" | "processing" | "done" | "error";
  result_url: string | null;
  error_message: string | null;
};

type GenerationRow = {
  id: string;
  status: "pending" | "queued" | "processing" | "completed" | "failed" | "error";
  final_image_url: string | null;
  result_image_url?: string | null;
  preview_image_url?: string | null;
  error?: string | null;
};

type AnyTemplate = TemplateSummary & {
  id?: string;
  _id?: string;
  title?: string;
  prompt?: string | null;
  occasion?: string | null;
  category?: string | null;
  style_id?: string | null;
  styleId?: string | null;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  previewurl?: string | null;
  preview_url?: string | null;
  preview_image_url?: string | null;
  thumbnailurl?: string | null;
  thumbnail_url?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  mediaUrl?: string | null;
  creditCost?: number;
  creditcost?: number;
  type?: string;
};

type EdgeResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  imageUrl?: string;
  generation_id?: string;
};

function normalizeKey(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();

  if (!raw || raw === "all") return raw;

  if (raw === "new-born" || raw === "new_born") return "newborn";
  if (raw === "valentines" || raw === "valentines-day") return "valentines_day";
  if (raw === "mothers-day") return "mothers_day";
  if (raw === "fathers-day") return "fathers_day";
  if (raw === "new-years-eve") return "new_years_eve";
  if (raw === "baby-reveal") return "baby_reveal";
  if (raw === "thank-you") return "thank_you";
  if (raw === "name-cards") return "name_cards";
  if (raw === "bible-verses") return "bible_verses";
  if (raw === "pet-loss") return "pet_loss";

  return raw.replace(/-/g, "_");
}

function normalizeCategory(value: unknown): CategoryKey {
  const key = normalizeKey(value);

  if (
    key === "occasions" ||
    key === "personal" ||
    key === "spiritual" ||
    key === "pets"
  ) {
    return key;
  }

  return ALL_CATEGORIES;
}

function safeString(value: unknown) {
  return String(value ?? "").trim();
}

function isHttpUrl(value: unknown) {
  return /^https?:\/\//i.test(safeString(value));
}

function formatLabel(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Other";

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPublicSupabaseConfig(): { url: string; anon: string } {
  const env = import.meta.env as {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
  };

  const url = (env.VITE_SUPABASE_URL || "").trim();
  const anon = (env.VITE_SUPABASE_ANON_KEY || "").trim();

  if (!url || !anon) {
    throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  }

  return { url, anon };
}

async function getEdgeFunctionHeaders(
  anonKey: string
): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token?.trim();

  return {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${accessToken || anonKey}`,
  };
}

async function safeReadJson(res: Response): Promise<EdgeResponse> {
  try {
    return (await res.json()) as EdgeResponse;
  } catch {
    return {};
  }
}

function getTemplateId(template: AnyTemplate) {
  return safeString(template.id || template._id);
}

function getTemplateStyleId(template: AnyTemplate) {
  return (
    safeString(template.style_id) ||
    safeString(template.styleId) ||
    normalizeKey(template.category || "general")
  );
}

function getTemplateImageUrl(template: AnyTemplate) {
  const candidates = [
    template.previewUrl,
    template.thumbnailUrl,
    template.preview_image_url,
    template.preview_url,
    template.previewurl,
    template.thumbnail_url,
    template.thumbnailurl,
    template.imageUrl,
    template.image,
    template.mediaUrl,
  ];

  for (const candidate of candidates) {
    const url = safeString(candidate);
    if (url) return url;
  }

  return "";
}

function getOccasionCategory(occasion: unknown): CategoryKey {
  const key = normalizeKey(occasion);

  const found = occasions.find((item) => normalizeKey(item.id) === key);

  return normalizeCategory(found?.category);
}

function normalizeTemplate(t: AnyTemplate): AnyTemplate {
  const id = getTemplateId(t);

  const previewUrl = getTemplateImageUrl(t);
  const thumbnailUrl =
    safeString(t.thumbnailUrl) ||
    safeString(t.thumbnail_url) ||
    safeString(t.thumbnailurl) ||
    previewUrl;

  const creditCost =
    typeof t.creditCost === "number"
      ? t.creditCost
      : typeof t.creditcost === "number"
        ? t.creditcost
        : 1;

  const normalizedOccasion = normalizeKey(t.occasion || "");
  const categoryFromOccasion = getOccasionCategory(normalizedOccasion);

  return {
    ...(t as TemplateSummary),
    ...(t as any),
    id,
    _id: id,
    occasion: normalizedOccasion || t.occasion,
    category:
      categoryFromOccasion !== "all"
        ? categoryFromOccasion
        : safeString(t.category || "general"),
    previewUrl,
    thumbnailUrl,
    creditCost,
    type: String(t.type ?? "image").toLowerCase(),
  };
}

function dispatchCreditsRefresh() {
  window.dispatchEvent(new Event("credits:refresh"));
}

function buildPrompt(template: AnyTemplate, customInstructions: string) {
  const templatePrompt = safeString((template as any).prompt);
  const title = safeString(template.title);
  const occasion = safeString(template.occasion);
  const custom = safeString(customInstructions);

  return [
    "Create one premium realistic personalized gift image using the two provided input images.",
    "Input image 1 is the customer's uploaded photo. Preserve the real people from image 1: face identity, age, skin tone, hair color, hairstyle, body shape, expression, and number of people.",
    "Input image 2 is the selected template/reference image. Use image 2 for scene, composition, pose direction, camera angle, background, props, lighting, mood, colors, and premium style.",
    "Final task: create a new image that looks like the template/reference image but personalized with the people from the customer's photo.",
    "Do not copy the customer's original background unless it naturally fits the template.",
    "Do not create extra people. Do not duplicate faces. Do not distort hands, eyes, mouths, or limbs.",
    "Avoid random text, logos, watermarks, captions, signatures, or unreadable typography.",
    "Make the result clean, beautiful, realistic, emotional, and gift-ready.",
    title ? `Template title: ${title}.` : "",
    occasion ? `Occasion: ${occasion}.` : "",
    templatePrompt ? `Template-specific instruction: ${templatePrompt}` : "",
    custom ? `User extra instruction: ${custom}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function GeneratorPage() {
  const user = useBootstrapUser();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedTemplateId = searchParams.get("template") || null;
  const selectedCategoryParam = normalizeCategory(searchParams.get("category"));
  const selectedOccasionParam = normalizeKey(searchParams.get("occasion"));
  const selectedStyleParam = normalizeKey(searchParams.get("style"));

  const selectedCategory = selectedCategoryParam;

  const selectedOccasion =
    selectedOccasionParam && selectedOccasionParam !== ALL_OCCASIONS
      ? selectedOccasionParam
      : ALL_OCCASIONS;

  const selectedStyle =
    selectedStyleParam && selectedStyleParam !== ALL_STYLES
      ? selectedStyleParam
      : ALL_STYLES;

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(
    null
  );
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(
    "match_input_image"
  );

  const pollingRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);

  const [modal, setModal] = useState<{
    open: boolean;
    src: string;
    title?: string;
  }>({
    open: false,
    src: "",
    title: "",
  });

  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">(
    "all"
  );
  const [generateAudio, setGenerateAudio] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("English");

  const { data: templates = [] } = useTemplatesQuery();

  const templatesList = useMemo(
    () =>
      (templates as AnyTemplate[])
        .map((template) => normalizeTemplate(template))
        .filter((template) => getTemplateId(template)),
    [templates]
  );

  const { data: creditsData = 0 } = useUserCreditsQuery();
  const userCredits: number = Number(creditsData ?? 0);

  const { data: jobsRaw = [] } = useJobsQuery();
  const jobs = (jobsRaw as JobRow[]) || [];

  const { mutateAsync: triggerCreateVideoJob } = useCreateVideoJobMutation();

  const categoryFilteredTemplates = useMemo(() => {
    if (selectedCategory === ALL_CATEGORIES) return templatesList;

    return templatesList.filter((template) => {
      const occasionCategory = getOccasionCategory(template.occasion);
      const templateCategory = normalizeCategory(template.category);

      return (
        occasionCategory === selectedCategory || templateCategory === selectedCategory
      );
    });
  }, [templatesList, selectedCategory]);

  const occasionOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; count: number }>();

    categoryFilteredTemplates.forEach((template) => {
      const key = normalizeKey(template.occasion || "other");
      if (!key) return;

      const existing = map.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          value: key,
          label: formatLabel(template.occasion || "Other"),
          count: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [categoryFilteredTemplates]);

  const styleOptions = useMemo(() => {
    const source =
      selectedOccasion === ALL_OCCASIONS
        ? categoryFilteredTemplates
        : categoryFilteredTemplates.filter(
            (template) => normalizeKey(template.occasion) === selectedOccasion
          );

    const map = new Map<string, { value: string; label: string; count: number }>();

    source.forEach((template) => {
      const styleRaw =
        getOccasionCategory(template.occasion) !== "all"
          ? safeString((template as any).style_id || (template as any).styleId || "general")
          : safeString(template.category || "general");

      const key = normalizeKey(styleRaw || "general");
      if (!key) return;

      const existing = map.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          value: key,
          label: formatLabel(styleRaw || "General"),
          count: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [categoryFilteredTemplates, selectedOccasion]);

  const aspectRatioOptions = [
    { label: "Match input", value: "match_input_image" },
    { label: "1:1", value: "1:1" },
    { label: "16:9", value: "16:9" },
    { label: "9:16", value: "9:16" },
    { label: "4:3", value: "4:3" },
    { label: "3:4", value: "3:4" },
    { label: "3:2", value: "3:2" },
    { label: "2:3", value: "2:3" },
    { label: "4:5", value: "4:5" },
    { label: "5:4", value: "5:4" },
    { label: "21:9", value: "21:9" },
    { label: "9:21", value: "9:21" },
    { label: "2:1", value: "2:1" },
    { label: "1:2", value: "1:2" },
  ];

  const selectedCategoryLabel =
    CATEGORY_OPTIONS.find((item) => item.value === selectedCategory)?.label ||
    "All";

  const selectedOccasionLabel =
    selectedOccasion === ALL_OCCASIONS
      ? "All Occasions"
      : occasionOptions.find((item) => item.value === selectedOccasion)?.label ||
        formatLabel(selectedOccasion);

  const selectedStyleLabel =
    selectedStyle === ALL_STYLES
      ? "All Styles"
      : styleOptions.find((item) => item.value === selectedStyle)?.label ||
        formatLabel(selectedStyle);

  const updateFilterParams = useCallback(
    (updates: {
      category?: CategoryKey;
      occasion?: string;
      style?: string;
      type?: "all" | "image" | "video";
    }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);

          if (updates.category !== undefined) {
            if (updates.category === ALL_CATEGORIES) {
              next.delete("category");
            } else {
              next.set("category", updates.category);
            }

            next.delete("occasion");
            next.delete("style");
            next.delete("template");
          }

          if (updates.occasion !== undefined) {
            if (updates.occasion === ALL_OCCASIONS) {
              next.delete("occasion");
            } else {
              next.set("occasion", updates.occasion);
            }

            next.delete("style");
            next.delete("template");
          }

          if (updates.style !== undefined) {
            if (updates.style === ALL_STYLES) {
              next.delete("style");
            } else {
              next.set("style", updates.style);
            }

            next.delete("template");
          }

          return next;
        },
        { replace: true }
      );

      if (updates.type) {
        setTypeFilter(updates.type);
      }
    },
    [setSearchParams]
  );

  const refreshCredits = useCallback(() => {
    dispatchCreditsRefresh();

    void queryClient.invalidateQueries({ queryKey: ["userCredits"] });
    void queryClient.invalidateQueries({ queryKey: ["credits"] });
    void queryClient.invalidateQueries({ queryKey: ["user-credits"] });
    void queryClient.invalidateQueries({ queryKey: ["userCreditsQuery"] });

    void queryClient.refetchQueries({ queryKey: ["userCredits"] });
    void queryClient.refetchQueries({ queryKey: ["credits"] });
    void queryClient.refetchQueries({ queryKey: ["user-credits"] });
    void queryClient.refetchQueries({ queryKey: ["userCreditsQuery"] });
  }, [queryClient]);

  const filteredTemplates = useMemo(() => {
    let list = categoryFilteredTemplates;

    if (selectedOccasion !== ALL_OCCASIONS) {
      list = list.filter((template) => {
        return normalizeKey(template.occasion) === selectedOccasion;
      });
    }

    if (selectedStyle !== ALL_STYLES) {
      list = list.filter((template) => {
        const templateStyle = normalizeKey(
          (template as any).style_id ||
            (template as any).styleId ||
            template.category ||
            "general"
        );

        return templateStyle === selectedStyle;
      });
    }

    if (typeFilter !== "all") {
      list = list.filter((template) => {
        return String(template.type || "").toLowerCase() === typeFilter;
      });
    }

    return list;
  }, [categoryFilteredTemplates, typeFilter, selectedOccasion, selectedStyle]);

  const templateMap = useMemo(() => {
    const lookup = new Map<string, AnyTemplate>();

    templatesList.forEach((template) => {
      const id = getTemplateId(template);
      lookup.set(id, normalizeTemplate(template));
    });

    return lookup;
  }, [templatesList]);

  const selectedTemplateObj = selectedTemplateId
    ? templateMap.get(selectedTemplateId) ?? null
    : null;

  const currentJob = useMemo(() => {
    if (!currentJobId) return null;
    return jobs.find((job) => job.id === currentJobId) ?? null;
  }, [jobs, currentJobId]);

  const stopGenerationPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    isPollingRef.current = false;
  }, []);

  const checkGenerationStatus = useCallback(
    async (generationId: string) => {
      if (isPollingRef.current) return;

      isPollingRef.current = true;

      try {
        const { data, error } = await supabase
          .from("generations")
          .select(
            "id, status, final_image_url, result_image_url, preview_image_url, error"
          )
          .eq("id", generationId)
          .maybeSingle();

        if (error) {
          console.error("[generations poll] error", error);
          return;
        }

        if (!data) {
          console.warn("[generations poll] generation not found yet", generationId);
          return;
        }

        const generation = data as GenerationRow;
        const imageUrl =
          generation.final_image_url ||
          generation.result_image_url ||
          generation.preview_image_url ||
          null;

        if (generation.status === "completed" && imageUrl) {
          stopGenerationPolling();
          setPreviewAfter(imageUrl);
          setIsGenerating(false);
          setCurrentGenerationId(null);
          refreshCredits();
          toast.success("Your card is ready!");
          return;
        }

        if (generation.status === "failed" || generation.status === "error") {
          stopGenerationPolling();
          setIsGenerating(false);
          setCurrentGenerationId(null);
          refreshCredits();
          toast.error(generation.error || "Failed to generate. Please try again.");
        }
      } finally {
        isPollingRef.current = false;
      }
    },
    [stopGenerationPolling, refreshCredits]
  );

  useEffect(() => {
    if (!currentGenerationId) {
      stopGenerationPolling();
      return;
    }

    void checkGenerationStatus(currentGenerationId);

    pollingRef.current = window.setInterval(() => {
      void checkGenerationStatus(currentGenerationId);
    }, 2500);

    return () => {
      stopGenerationPolling();
    };
  }, [currentGenerationId, checkGenerationStatus, stopGenerationPolling]);

  useEffect(() => {
    const urls = uploadedFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [uploadedFiles]);

  useEffect(() => {
    if (!currentJob) return;
    if (currentJob.type !== "video") return;

    if (currentJob.status === "done" && currentJob.result_url) {
      setPreviewAfter(currentJob.result_url);
      setIsGenerating(false);
      refreshCredits();
      toast.success("Your video is ready!");
    } else if (currentJob.status === "error") {
      setIsGenerating(false);
      refreshCredits();
      toast.error(currentJob.error_message || "Failed to generate. Please try again.");
    }
  }, [currentJob, refreshCredits]);

  const handleTemplateSelect = useCallback(
    (template: AnyTemplate) => {
      const id = getTemplateId(template);

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);

          if (next.get("template") === id) {
            next.delete("template");
            toast.success(`Deselected: ${template.title}`);
          } else {
            next.set("template", id);

            const occasion = normalizeKey(template.occasion);
            const style = normalizeKey(
              (template as any).style_id ||
                (template as any).styleId ||
                template.category ||
                "general"
            );
            const category = getOccasionCategory(occasion);

            if (category !== "all") next.set("category", category);
            if (occasion) next.set("occasion", occasion);
            if (style) next.set("style", style);

            toast.success(`Selected: ${template.title}`);
          }

          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      const valid = files.filter((file) => {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large. Maximum 10MB.`);
          return false;
        }

        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image.`);
          return false;
        }

        return true;
      });

      if (valid.length > 0) {
        setUploadedFiles((prev) => [...prev, ...valid]);
        toast.success(`${valid.length} photo(s) uploaded!`);
      }

      event.target.value = "";
    },
    []
  );

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const files = Array.from(event.dataTransfer.files).filter((file) =>
      file.type.startsWith("image/")
    );

    const valid = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Maximum 10MB.`);
        return false;
      }

      return true;
    });

    if (valid.length > 0) {
      setUploadedFiles((prev) => [...prev, ...valid]);
      toast.success(`${valid.length} photo(s) uploaded!`);
    }
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDownload = useCallback(async (url: string, filename: string) => {
    if (!url) {
      toast.error("No file to download");
      return;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (err) {
      console.error("Download failed:", err);
      window.open(url, "_blank");
    }
  }, []);

  const { openFunnel } = useCreditsFunnel();

  async function createGenerationAndRun(input: {
    template: AnyTemplate;
    sourceImageUrl: string;
    styleImageUrl: string;
    prompt: string;
    aspectRatio: string;
  }) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const effectiveUserId =
      safeString(authUser?.id || (user as any)?.id) || null;
    const effectiveEmail =
      safeString(authUser?.email || (user as any)?.email) || null;

    const templateId = getTemplateId(input.template);
    const styleId = getTemplateStyleId(input.template);

    const metadata = {
      source: "tdg_generator_page",
      template_id: templateId,
      style_id: styleId,
      template_title: safeString(input.template.title),
      template_prompt: safeString((input.template as any).prompt),
      style_image_url: input.styleImageUrl,
      source_image_url: input.sourceImageUrl,
      aspect_ratio: input.aspectRatio,
      user_id: effectiveUserId,
      email: effectiveEmail,
      category: getOccasionCategory(input.template.occasion),
    };

    const { data: created, error: createError } = await supabase
      .from("generations")
      .insert({
        user_id: effectiveUserId,
        email: effectiveEmail,
        occasion_slug: safeString(input.template.occasion) || null,
        style_slug: styleId || null,
        style_id: styleId || null,
        template_id: templateId || null,
        title: safeString(input.template.title) || "tdg_generation",
        source_image_url: input.sourceImageUrl,
        preview_image_url: input.sourceImageUrl,
        prompt: input.prompt,
        status: "pending",
        metadata,
      })
      .select("id")
      .single();

    if (createError || !created?.id) {
      throw new Error(createError?.message || "Failed to create generation.");
    }

    const generationId = String(created.id);
    setCurrentGenerationId(generationId);

    const { url: supabaseUrl, anon } = getPublicSupabaseConfig();
    const headers = await getEdgeFunctionHeaders(anon);

    const res = await fetch(`${supabaseUrl}/functions/v1/generate-nano-banana`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        generation_id: generationId,
      }),
    });

    const edgeData = await safeReadJson(res);

    if (!res.ok) {
      throw new Error(
        safeString(edgeData.error || edgeData.message) ||
          `Edge Function returned a non-2xx status code (${res.status})`
      );
    }

    if (edgeData.imageUrl && isHttpUrl(edgeData.imageUrl)) {
      setPreviewAfter(edgeData.imageUrl);
      setCurrentGenerationId(null);
      setIsGenerating(false);
      refreshCredits();
      toast.success("Your card is ready!");
    }

    return generationId;
  }

  const handleGenerate = useCallback(async () => {
    if (!user) {
      toast.error("No authenticated user found.");
      openFunnel({ mode: "not_logged_in" });
      return;
    }

    if (!selectedTemplateId) {
      toast.error("Please select a template.");
      return;
    }

    if (uploadedFiles.length === 0) {
      toast.error("Please upload at least one photo.");
      return;
    }

    const template = templateMap.get(selectedTemplateId);

    if (!template) {
      toast.error("Template not found. Please pick another option.");
      return;
    }

    const requiredCredits = Number((template as any).creditCost ?? 1);

    if ((userCredits ?? 0) < requiredCredits) {
      const hasGeneratedBefore = jobs.length > 0;

      if (!hasGeneratedBefore && (userCredits ?? 0) === 0) {
        openFunnel({ mode: "first_generation" });
      } else {
        openFunnel({
          mode: "insufficient_credits",
          required: requiredCredits,
          available: userCredits ?? 0,
        });
      }

      return;
    }

    document.getElementById("preview-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    setIsGenerating(true);
    setCurrentJobId(null);
    setCurrentGenerationId(null);
    setPreviewAfter(null);
    stopGenerationPolling();

    try {
      const isVideo = String(template.type || "image").toLowerCase() === "video";

      if (isVideo && uploadedFiles.length > 3) {
        toast.error("You can upload up to 3 photos for video generation.");
        setIsGenerating(false);
        return;
      }

      const inputUrls = await Promise.all(
        uploadedFiles.map(async (file) => {
          const { publicUrl } = await uploadFileToStorage(file, {
            bucket: "uploads",
            folder: "inputs",
            upsert: false,
            makePublicUrl: true,
          });

          return publicUrl;
        })
      );

      if (isVideo) {
        if (customInstructions && customInstructions.length > 2000) {
          throw new Error("User instructions must be <= 2000 characters");
        }

        if (negativePrompt && negativePrompt.length > 500) {
          throw new Error("Negative prompt must be <= 500 characters");
        }

        let finalUserInstructions = customInstructions.trim();

        if (selectedLanguage && selectedLanguage !== "English") {
          const languageInstruction = `The dialogue and any spoken words should be in ${selectedLanguage}.`;
          finalUserInstructions = finalUserInstructions
            ? `${finalUserInstructions} ${languageInstruction}`
            : languageInstruction;
        }

        const res: any = await triggerCreateVideoJob({
          templateId: getTemplateId(template),
          inputUrls,
          userInstructions: finalUserInstructions || undefined,
          duration: 8,
          resolution: "1080p",
          aspectRatio: "16:9",
          generateAudio,
          negativePrompt: negativePrompt.trim() || undefined,
        });

        const jobId = String(res?.jobId ?? res?.id ?? res);
        setCurrentJobId(jobId);
        refreshCredits();
        toast.success("Video generation started!");
        return;
      }

      const sourceImageUrl = inputUrls[0];
      const styleImageUrl = getTemplateImageUrl(template);

      if (!sourceImageUrl || !isHttpUrl(sourceImageUrl)) {
        throw new Error("Uploaded image URL is invalid.");
      }

      if (!styleImageUrl || !isHttpUrl(styleImageUrl)) {
        throw new Error("Selected template has no valid public image URL.");
      }

      const prompt = buildPrompt(template, customInstructions);

      const generationId = await createGenerationAndRun({
        template,
        sourceImageUrl,
        styleImageUrl,
        prompt,
        aspectRatio: selectedAspectRatio,
      });

      setCurrentGenerationId(generationId);
      refreshCredits();
      toast.success("Generation started!");
    } catch (error: any) {
      console.error("[handleGenerate] error", error);
      setIsGenerating(false);
      refreshCredits();
      toast.error(error?.message ?? "Failed to generate.");
    }
  }, [
    user,
    selectedTemplateId,
    uploadedFiles,
    templateMap,
    userCredits,
    triggerCreateVideoJob,
    selectedAspectRatio,
    customInstructions,
    generateAudio,
    negativePrompt,
    openFunnel,
    jobs,
    selectedLanguage,
    stopGenerationPolling,
    refreshCredits,
  ]);

  return (
    <div className="relative min-h-screen overflow-x-hidden text-[#f6f8ff]">
      <SnowBackground />

      <section
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
        onClick={() => document.getElementById("file-input")?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload photos. Drag and drop or click to select images."
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            document.getElementById("file-input")?.click();
          }
        }}
        className="mx-auto my-8 max-w-4xl cursor-pointer rounded-[28px] border border-white/15 bg-white/[0.055] p-8 text-center shadow-[0_18px_60px_rgba(0,0,0,.35)] transition hover:border-white/25 hover:bg-white/[0.085]"
      >
        <input
          id="file-input"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          aria-label="Select image files"
          className="hidden"
        />

        <h2 className="mb-2 text-xl font-semibold">
          {uploadedFiles.length > 0
            ? `✅ ${uploadedFiles.length} photo${
                uploadedFiles.length > 1 ? "s" : ""
              } uploaded`
            : "Drag & drop"}
        </h2>

        <p className="text-[#c1c8d8]">
          {uploadedFiles.length > 0
            ? "Click to add more photos"
            : "or click to upload your reference photos"}
        </p>

        <p className="mt-4 text-sm text-[#c1c8d8]">
          {uploadedFiles.length > 0 && !selectedTemplateId
            ? "Now select your desired template below ⬇️"
            : ""}
        </p>
      </section>

      {modal.open && (
        <VideoModal
          src={modal.src}
          title={modal.title}
          onClose={() => setModal({ open: false, src: "", title: "" })}
        />
      )}

      {uploadedFiles.length > 0 && (
        <div className="mx-auto my-6 max-w-4xl px-4">
          <div className="flex flex-wrap justify-center gap-3">
            {previewUrls.map((url, index) => (
              <div
                key={index}
                className="group relative h-24 w-24 overflow-hidden rounded-xl border border-white/15 bg-white/[0.06]"
              >
                <img
                  src={url}
                  alt={`Preview ${index + 1}`}
                  className="h-full w-full object-cover"
                />

                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemoveFile(index);
                  }}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/90 text-xs font-bold text-white opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
                  aria-label="Remove image"
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="mx-auto mb-7 max-w-5xl px-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_60px_rgba(0,0,0,.28)] backdrop-blur-xl">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#ffd976]" />
                <h2 className="text-base font-semibold text-white">
                  Choose category, occasion and style
                </h2>
              </div>

              <p className="mt-1 text-sm text-[#9ca8bd]">
                {selectedCategoryLabel} · {selectedOccasionLabel} ·{" "}
                {selectedStyleLabel} · {filteredTemplates.length} template
                {filteredTemplates.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={typeFilter}
                onValueChange={(value) =>
                  setTypeFilter(value as "all" | "image" | "video")
                }
              >
                <SelectTrigger className="h-11 w-full min-w-[160px] rounded-2xl border-white/10 bg-black/25 text-white">
                  <SelectValue placeholder="Media type" />
                </SelectTrigger>

                <SelectContent className="border-white/15 bg-[#0b1220] text-white">
                  <SelectItem value="all">All Media</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORY_OPTIONS.map((category) => {
              const Icon = category.icon;
              const isActive = selectedCategory === category.value;

              return (
                <button
                  key={category.value}
                  type="button"
                  onClick={() =>
                    updateFilterParams({ category: category.value })
                  }
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition",
                    isActive
                      ? "border-[#ffd976]/70 bg-[#ffd976] text-[#171717] shadow-[0_0_22px_rgba(255,217,118,.22)]"
                      : "border-white/10 bg-white/[0.055] text-zinc-200 hover:bg-white/[0.09]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-bold">{category.label}</span>
                  </div>

                  <p
                    className={cn(
                      "mt-1 text-xs",
                      isActive ? "text-black/65" : "text-white/45"
                    )}
                  >
                    {category.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => updateFilterParams({ occasion: ALL_OCCASIONS })}
              className={cn(
                "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                selectedOccasion === ALL_OCCASIONS
                  ? "border-[#ffd976]/70 bg-[#ffd976] text-[#171717] shadow-[0_0_22px_rgba(255,217,118,.22)]"
                  : "border-white/10 bg-white/[0.055] text-zinc-200 hover:bg-white/[0.09]"
              )}
            >
              All Occasions
            </button>

            {occasionOptions.map((occasion) => (
              <button
                key={occasion.value}
                type="button"
                onClick={() => updateFilterParams({ occasion: occasion.value })}
                className={cn(
                  "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                  selectedOccasion === occasion.value
                    ? "border-[#ffd976]/70 bg-[#ffd976] text-[#171717] shadow-[0_0_22px_rgba(255,217,118,.22)]"
                    : "border-white/10 bg-white/[0.055] text-zinc-200 hover:bg-white/[0.09]"
                )}
              >
                {occasion.label}
              </button>
            ))}
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9ca8bd]">
                Styles for {selectedOccasionLabel}
              </p>

              {selectedStyle !== ALL_STYLES && (
                <button
                  type="button"
                  onClick={() => updateFilterParams({ style: ALL_STYLES })}
                  className="text-xs font-semibold text-[#ffd976] hover:underline"
                >
                  Reset style
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateFilterParams({ style: ALL_STYLES })}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-sm font-medium transition",
                  selectedStyle === ALL_STYLES
                    ? "border-white/25 bg-white text-black"
                    : "border-white/10 bg-black/20 text-zinc-300 hover:bg-white/[0.08]"
                )}
              >
                All Styles
              </button>

              {styleOptions.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => updateFilterParams({ style: style.value })}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-sm font-medium transition",
                    selectedStyle === style.value
                      ? "border-white/25 bg-white text-black"
                      : "border-white/10 bg-black/20 text-zinc-300 hover:bg-white/[0.08]"
                  )}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-5 px-4 pb-8 md:grid-cols-3 lg:grid-cols-4">
        {filteredTemplates.map((template) => {
          const normalized = normalizeTemplate(template);
          const id = getTemplateId(normalized);
          const isSelected = selectedTemplateId === id;

          return (
            <TemplateCard
              key={id}
              template={normalized as TemplateSummary}
              isSelected={isSelected}
              onSelect={handleTemplateSelect as any}
              onOpenModal={(src, title) =>
                setModal({ open: true, src, title })
              }
            />
          );
        })}

        {filteredTemplates.length === 0 && (
          <div className="col-span-full rounded-[28px] border border-white/10 bg-white/[0.045] px-6 py-14 text-center">
            <p className="text-lg font-semibold text-white">
              No templates found
            </p>

            <p className="mt-2 text-sm text-[#9ca8bd]">
              Try All Categories, All Occasions, All Styles, or another media
              type.
            </p>
          </div>
        )}
      </div>

      <div
        id="preview-section"
        className="mx-auto mt-4 grid w-[92%] max-w-5xl grid-cols-2 gap-6 text-center font-bold text-[#c1c8d8]"
      >
        <span>Before</span>
        <span>After</span>
      </div>

      <div
        className={cn(
          "mx-auto mt-2 grid w-[92%] max-w-5xl grid-cols-1 gap-6 px-4 pb-32 sm:grid-cols-2",
          selectedTemplateObj && selectedTemplateObj.type === "video"
            ? "pb-72"
            : selectedTemplateObj?.type === "image"
              ? "pb-64"
              : ""
        )}
      >
        <div className="flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] p-5 text-[#c1c8d8] shadow-[0_8px_26px_rgba(0,0,0,.45)]">
          {previewUrls.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {previewUrls.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Input ${index + 1}`}
                  className="max-h-[240px] max-w-full rounded-lg object-contain"
                />
              ))}
            </div>
          ) : (
            <span>No images uploaded</span>
          )}
        </div>

        <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] p-5 text-[#c1c8d8] shadow-[0_8px_26px_rgba(0,0,0,.45)]">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#ffd976] border-t-transparent" />
              <span className="text-sm">Generating magic...</span>
            </div>
          ) : previewAfter ? (
            <>
              {currentJob?.type === "video" ? (
                <video
                  src={previewAfter}
                  controls
                  className="max-h-full max-w-full rounded-lg object-contain"
                  autoPlay
                  loop
                />
              ) : (
                <img
                  src={previewAfter}
                  alt="After"
                  className="max-h-full max-w-full rounded-lg object-contain"
                />
              )}

              <button
                onClick={() => {
                  const ext = currentJob?.type === "video" ? "mp4" : "png";
                  const filename =
                    currentJob?.type === "video"
                      ? `video-${Date.now()}.${ext}`
                      : `generated-card-${Date.now()}.${ext}`;

                  void handleDownload(previewAfter, filename);
                }}
                className="absolute bottom-4 right-4 rounded-lg bg-[#ffd976] px-4 py-2 font-semibold text-[#1e1e1e] transition hover:brightness-110 active:scale-95"
                type="button"
              >
                Download
              </button>
            </>
          ) : (
            <span>No image generated yet</span>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/15 bg-[rgba(6,10,18,0.95)] px-4 py-3 shadow-[0_-8px_32px_rgba(0,0,0,.5)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-3">
            {selectedTemplateObj ? (
              selectedTemplateObj.type === "video" ? (
                <>
                  <p className="mt-2 flex items-start gap-2 text-xs text-[#c1c8d8] sm:items-center">
                    <span className="mt-0.5">
                      <Info size={18} />
                    </span>
                    <span>
                      Video generation costs{" "}
                      {selectedTemplateObj.creditCost ?? "X"} credits per
                      second. Enabling "With Audio" will double the cost.
                    </span>
                  </p>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <textarea
                      value={customInstructions}
                      onChange={(event) =>
                        setCustomInstructions(event.target.value)
                      }
                      placeholder="Optional: Add custom instructions..."
                      className="max-h-[80px] min-h-[40px] flex-1 resize-none rounded-xl border border-white/15 bg-white/[0.1] p-2.5 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976]"
                      rows={3}
                      disabled={isGenerating}
                    />

                    <textarea
                      value={negativePrompt}
                      onChange={(event) =>
                        setNegativePrompt(event.target.value.slice(0, 500))
                      }
                      placeholder="Negative Prompt (Optional)"
                      className="min-h-[40px] flex-1 resize-none rounded-xl border border-white/15 bg-white/[0.1] p-2.5 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976]"
                      disabled={isGenerating}
                    />

                    <div className="flex flex-row justify-between gap-2 md:flex-col">
                      <LanguageSelector
                        value={selectedLanguage}
                        onChange={setSelectedLanguage}
                        disabled={isGenerating}
                      />

                      <label className="flex items-center gap-2 whitespace-nowrap text-sm text-white">
                        <input
                          type="checkbox"
                          checked={generateAudio}
                          onChange={(event) =>
                            setGenerateAudio(event.target.checked)
                          }
                          className="h-4 w-4"
                          disabled={isGenerating}
                        />
                        With Audio
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleGenerate()}
                      disabled={isGenerating || !selectedTemplateId}
                      className="ml-auto h-10 whitespace-nowrap rounded-xl border border-transparent bg-[linear-gradient(135deg,#ff4d4d,#ff9866,#ffd976)] px-5 py-2 font-semibold text-[#1e1e1e] transition hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isGenerating ? "Generating..." : "Generate"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex w-full flex-col items-stretch gap-3 md:flex-row md:items-center">
                  <textarea
                    value={customInstructions}
                    onChange={(event) =>
                      setCustomInstructions(event.target.value)
                    }
                    placeholder="Optional: Add custom instructions..."
                    className="max-h-[100px] min-h-[44px] flex-1 resize-none rounded-xl border border-white/15 bg-white/[0.1] p-2.5 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976]"
                    rows={1}
                    disabled={isGenerating}
                  />

                  <div className="flex items-center justify-end gap-3">
                    <Select
                      value={selectedAspectRatio}
                      onValueChange={setSelectedAspectRatio}
                      disabled={
                        isGenerating ||
                        uploadedFiles.length === 0 ||
                        !selectedTemplateId
                      }
                    >
                      <SelectTrigger className="min-w-[120px] border-white/15 bg-white/[0.1] text-white">
                        <SelectValue placeholder="Aspect ratio" />
                      </SelectTrigger>

                      <SelectContent className="border-white/15 bg-[#0b1220] text-white">
                        {aspectRatioOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <button
                      type="button"
                      onClick={() => void handleGenerate()}
                      disabled={isGenerating || !selectedTemplateId}
                      className="whitespace-nowrap rounded-xl border border-transparent bg-[linear-gradient(135deg,#ff4d4d,#ff9866,#ffd976)] px-5 py-2 font-semibold text-[#1e1e1e] transition hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isGenerating ? "Generating..." : "Generate"}
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-between gap-3 text-sm text-[#c1c8d8]">
                <span>Select a template to unlock generation options.</span>

                <div className="hidden items-center gap-2 sm:flex">
                  <ImageIcon className="h-4 w-4" />
                  <Video className="h-4 w-4" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}