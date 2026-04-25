// FILE: src/pages/GeneratorPage.tsx

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import VideoModal from "@/components/VideoModal";
import TemplateCard from "@/components/TemplateCard";
import type { TemplateSummary } from "@/types/templates";

import {
  useTemplatesQuery,
  useUserCreditsQuery,
  useJobsQuery,
} from "@/data";

import {
  useCreateJobMutation,
  useCreateVideoJobMutation,
} from "@/data";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

import { cn } from "@/lib/utils";
import { Info, Sparkles, ImageIcon, Video } from "lucide-react";
import LanguageSelector from "@/components/LanguageSelector";
import { useCreditsFunnel } from "@/contexts/CreditsFunnelContext";
import { useBootstrapUser } from "@/hooks/useBootstrapUser";
import { uploadFileToStorage } from "@/lib/uploadFileToStorage";
import { supabase } from "@/lib/supabase";

const ALL_OCCASIONS = "all";
const ALL_STYLES = "all";

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

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10 pointer-events-none" />;
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
};

type AnyTemplate = TemplateSummary & {
  _id?: string;
  previewurl?: string | null;
  preview_url?: string | null;
  thumbnailurl?: string | null;
  thumbnail_url?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  mediaUrl?: string | null;
  creditCost?: number;
  creditcost?: number;
};

function normalizeKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function formatLabel(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Other";

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeTemplate(t: AnyTemplate): AnyTemplate {
  const id = (t.id ?? t._id ?? "") as string;

  const previewUrl =
    t.previewUrl ||
    t.thumbnailUrl ||
    t.preview_url ||
    t.previewurl ||
    t.thumbnail_url ||
    t.thumbnailurl ||
    t.imageUrl ||
    t.image ||
    t.mediaUrl ||
    "";

  const thumbnailUrl =
    t.thumbnailUrl ||
    t.thumbnail_url ||
    t.thumbnailurl ||
    t.preview_url ||
    t.previewurl ||
    t.previewUrl ||
    "";

  const creditCost =
    typeof t.creditCost === "number"
      ? t.creditCost
      : typeof t.creditcost === "number"
      ? t.creditcost
      : 0;

  return {
    ...(t as TemplateSummary),
    ...(t as any),
    id,
    previewUrl,
    thumbnailUrl,
    creditCost,
    type: String(t.type ?? "image").toLowerCase(),
  };
}

function getGenerationIdFromResponse(res: any): string | null {
  const value =
    res?.generation_id ??
    res?.generationId ??
    res?.generation?.id ??
    res?.data?.generation_id ??
    res?.data?.generationId ??
    res?.data?.generation?.id ??
    res?.jobId ??
    res?.job_id ??
    res?.id ??
    res?.data?.jobId ??
    res?.data?.job_id ??
    res?.data?.id ??
    null;

  return value ? String(value) : null;
}

function dispatchCreditsRefresh() {
  window.dispatchEvent(new Event("credits:refresh"));
}

export default function GeneratorPage() {
  const user = useBootstrapUser();
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();

  const selectedTemplateId = searchParams.get("template") || null;
  const selectedOccasionParam = normalizeKey(searchParams.get("occasion"));
  const selectedStyleParam = normalizeKey(searchParams.get("style"));

  const selectedOccasion =
    selectedOccasionParam && selectedOccasionParam !== ALL_OCCASIONS
      ? selectedOccasionParam
      : ALL_OCCASIONS;

  const selectedStyle =
    selectedStyleParam && selectedStyleParam !== ALL_STYLES ? selectedStyleParam : ALL_STYLES;

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("match_input_image");

  const pollingRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);

  const [modal, setModal] = useState<{ open: boolean; src: string; title?: string }>({
    open: false,
    src: "",
    title: "",
  });

  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("all");
  const [generateAudio, setGenerateAudio] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("English");

  const { data: templates = [] } = useTemplatesQuery();

  const templatesList = useMemo(
    () => (templates as AnyTemplate[]).map((t) => normalizeTemplate(t)).filter((t) => t.id),
    [templates]
  );

  const { data: creditsData = 0 } = useUserCreditsQuery();
  const userCredits: number = Number(creditsData ?? 0);

  const { data: jobsRaw = [] } = useJobsQuery();
  const jobs = (jobsRaw as any[]).map((j) => j) as JobRow[];

  const { mutateAsync: triggerCreateJob } = useCreateJobMutation();
  const { mutateAsync: triggerCreateVideoJob } = useCreateVideoJobMutation();

  const occasionOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; count: number }>();

    templatesList.forEach((template) => {
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

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [templatesList]);

  const styleOptions = useMemo(() => {
    const source =
      selectedOccasion === ALL_OCCASIONS
        ? templatesList
        : templatesList.filter((template) => normalizeKey(template.occasion) === selectedOccasion);

    const map = new Map<string, { value: string; label: string; count: number }>();

    source.forEach((template) => {
      const key = normalizeKey(template.category || "general");
      if (!key) return;

      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          value: key,
          label: formatLabel(template.category || "General"),
          count: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [templatesList, selectedOccasion]);

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

  const selectedOccasionLabel =
    selectedOccasion === ALL_OCCASIONS
      ? "All Occasions"
      : occasionOptions.find((item) => item.value === selectedOccasion)?.label ||
        formatLabel(selectedOccasion);

  const selectedStyleLabel =
    selectedStyle === ALL_STYLES
      ? "All Styles"
      : styleOptions.find((item) => item.value === selectedStyle)?.label || formatLabel(selectedStyle);

  const updateFilterParams = useCallback(
    (updates: { occasion?: string; style?: string; type?: "all" | "image" | "video" }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);

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
    let list = templatesList;

    if (selectedOccasion !== ALL_OCCASIONS) {
      list = list.filter((t) => normalizeKey(t.occasion) === selectedOccasion);
    }

    if (selectedStyle !== ALL_STYLES) {
      list = list.filter((t) => normalizeKey(t.category || "general") === selectedStyle);
    }

    if (typeFilter !== "all") {
      list = list.filter((t) => String(t.type || "").toLowerCase() === typeFilter);
    }

    return list;
  }, [templatesList, typeFilter, selectedOccasion, selectedStyle]);

  const templateMap = useMemo(() => {
    const lookup = new Map<string, AnyTemplate>();
    templatesList.forEach((t) => {
      const id = (t.id ?? t._id) as string;
      lookup.set(id, normalizeTemplate(t));
    });
    return lookup;
  }, [templatesList]);

  const selectedTemplateObj = selectedTemplateId
    ? templateMap.get(selectedTemplateId) ?? null
    : null;

  const currentJob = useMemo(() => {
    if (!currentJobId) return null;
    return jobs.find((j) => j.id === currentJobId) ?? null;
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
          .select("id, status, final_image_url")
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

        if (generation.status === "completed" && generation.final_image_url) {
          stopGenerationPolling();
          setPreviewAfter(generation.final_image_url);
          setIsGenerating(false);
          setCurrentGenerationId(null);
          refreshCredits();
          toast.success("🎄 Your card is ready!");
          return;
        }

        if (generation.status === "failed" || generation.status === "error") {
          stopGenerationPolling();
          setIsGenerating(false);
          setCurrentGenerationId(null);
          refreshCredits();
          toast.error("Failed to generate. Please try again.");
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
    const urls = uploadedFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);

    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [uploadedFiles]);

  useEffect(() => {
    if (!currentJob) return;
    if (currentJob.type !== "video") return;

    if (currentJob.status === "done" && currentJob.result_url) {
      setPreviewAfter(currentJob.result_url);
      setIsGenerating(false);
      refreshCredits();
      toast.success("🎬 Your video is ready!");
    } else if (currentJob.status === "error") {
      setIsGenerating(false);
      refreshCredits();
      toast.error(currentJob.error_message || "Failed to generate. Please try again.");
    }
  }, [currentJob, refreshCredits]);

  const handleTemplateSelect = useCallback(
    (template: AnyTemplate) => {
      const id = (template.id ?? template._id) as string;

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);

          if (next.get("template") === id) {
            next.delete("template");
            toast.success(`Deselected: ${template.title}`);
          } else {
            next.set("template", id);

            const occasion = normalizeKey(template.occasion);
            const style = normalizeKey(template.category || "general");

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

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const valid = files.filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name} is too large. Maximum 10MB.`);
        return false;
      }
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name} is not an image.`);
        return false;
      }
      return true;
    });

    if (valid.length > 0) {
      setUploadedFiles((prev) => [...prev, ...valid]);
      toast.success(`${valid.length} photo(s) uploaded!`);
    }

    event.target.value = "";
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const files = Array.from(event.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );

    const valid = files.filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name} is too large. Maximum 10MB.`);
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

    const requiredCredits = Number((template as any).creditCost ?? 0);

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
          templateId: template.id,
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
      } else {
        const res: any = await triggerCreateJob({
          type: "image",
          templateId: template.id,
          inputUrls,
          aspectRatio: selectedAspectRatio,
          userInstructions: customInstructions.trim() || undefined,
        });

        const generationId = getGenerationIdFromResponse(res);

        if (!generationId) {
          console.error("[handleGenerate] generation response without ID", res);
          setIsGenerating(false);
          refreshCredits();
          toast.error("Generation was created, but no generation_id was returned.");
          return;
        }

        setCurrentGenerationId(generationId);
        refreshCredits();
        toast.success("Generation started!");
      }
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
    triggerCreateJob,
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
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById("file-input")?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload photos. Drag and drop or click to select images."
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
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
            ? `✅ ${uploadedFiles.length} photo${uploadedFiles.length > 1 ? "s" : ""} uploaded`
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
                <img src={url} alt={`Preview ${index + 1}`} className="h-full w-full object-cover" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
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
                <h2 className="text-base font-semibold text-white">Choose your occasion and style</h2>
              </div>
              <p className="mt-1 text-sm text-[#9ca8bd]">
                {selectedOccasionLabel} · {selectedStyleLabel} · {filteredTemplates.length} template
                {filteredTemplates.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as "all" | "image" | "video")}
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

          <div className="mb-4 flex flex-wrap gap-2">
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
        {filteredTemplates.map((t) => {
          const normalized = normalizeTemplate(t);
          const id = normalized.id as string;
          const isSelected = selectedTemplateId === id;

          return (
            <TemplateCard
              key={id}
              template={normalized as TemplateSummary}
              isSelected={isSelected}
              onSelect={handleTemplateSelect}
              onOpenModal={(src, title) => setModal({ open: true, src, title })}
            />
          );
        })}

        {filteredTemplates.length === 0 && (
          <div className="col-span-full rounded-[28px] border border-white/10 bg-white/[0.045] px-6 py-14 text-center">
            <p className="text-lg font-semibold text-white">No templates found</p>
            <p className="mt-2 text-sm text-[#9ca8bd]">
              Try All Occasions, All Styles, or another media type.
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
              {previewUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Input ${i + 1}`}
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
                      Video generation costs {selectedTemplateObj.creditCost ?? "X"} credits per second.
                      Enabling "With Audio" will double the cost.
                    </span>
                  </p>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <textarea
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="Optional: Add custom instructions..."
                      className="max-h-[80px] min-h-[40px] flex-1 resize-none rounded-xl border border-white/15 bg-white/[0.1] p-2.5 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976]"
                      rows={3}
                      disabled={isGenerating}
                    />

                    <textarea
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value.slice(0, 500))}
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
                          onChange={(e) => setGenerateAudio(e.target.checked)}
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
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Optional: Add custom instructions..."
                    className="max-h-[100px] min-h-[44px] flex-1 resize-none rounded-xl border border-white/15 bg-white/[0.1] p-2.5 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976]"
                    rows={1}
                    disabled={isGenerating}
                  />

                  <div className="flex items-center justify-end gap-3">
                    <Select
                      value={selectedAspectRatio}
                      onValueChange={setSelectedAspectRatio}
                      disabled={isGenerating || uploadedFiles.length === 0 || !selectedTemplateId}
                    >
                      <SelectTrigger className="min-w-[120px] border-white/15 bg-white/[0.1] text-white">
                        <SelectValue placeholder="Aspect ratio" />
                      </SelectTrigger>
                      <SelectContent className="border-white/15 bg-[#0b1220] text-white">
                        {aspectRatioOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
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