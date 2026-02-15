import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import VideoModal from "@/components/VideoModal";
import TemplateCard from "@/components/TemplateCard";
import type { TemplateSummary } from "@/types/templates";

import {
  useTemplatesQuery,
  useUserCreditsQuery,
  useJobsQuery,
} from "@/data";

import { mutations } from "@/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import LanguageSelector from "@/components/LanguageSelector";
import { useCreditsFunnel } from "@/contexts/CreditsFunnelContext";
import { useBootstrapUser } from "@/hooks/useBootstrapUser";

import { uploadFileToStorage } from "@/lib/uploadFileToStorage";

// Snow Animation Background Component
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

      requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <canvas ref={canvasRef} className="fixed inset-0 -z-10 pointer-events-none" />
  );
}

type JobRow = {
  id: string;
  type: "image" | "video";
  status: "queued" | "processing" | "done" | "error";
  result_url: string | null;
  error_message: string | null;
};

export default function GeneratorPage() {
  const user = useBootstrapUser(); // { id, email } | null

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState("All");

  // URL params
  const selectedTemplateId = searchParams.get("template") || null;
  const selectedOccasion =
    searchParams.get("occasion")?.toLowerCase().trim() || null;

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] =
    useState("match_input_image");

  const [modal, setModal] = useState<{ open: boolean; src: string; title?: string }>({
    open: false,
    src: "",
    title: "",
  });

  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("all");

  // Video options
  const [generateAudio, setGenerateAudio] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("English");

  const { data: templates = [] } = useTemplatesQuery();
  const templatesList = templates as TemplateSummary[];

  const { data: creditsData = 0 } = useUserCreditsQuery();
  const userCredits: number = (creditsData ?? 0) as number;

  const { data: jobsRaw = [] } = useJobsQuery();
  const jobs = (jobsRaw as any[]).map((j) => j) as JobRow[];

  const { mutateAsync: triggerCreateJob } = mutations.useCreateJobMutation();
const { mutateAsync: triggerCreateVideoJob } = mutations.useCreateVideoJobMutation();

  const categories = ["All", "Classic", "Cozy", "Snowy", "Romantic"];

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

  const filteredTemplates = useMemo(() => {
    let list = templatesList;

    if (selectedOccasion) {
      list = list.filter(
        (t) => (t.occasion || "").toString().trim().toLowerCase() === selectedOccasion
      );
    }

    const activeNormalized = (activeCategory || "").toString().trim().toLowerCase();
    if (activeNormalized && activeNormalized !== "all") {
      list = list.filter(
        (t) => (t.category || "").toString().trim().toLowerCase() === activeNormalized
      );
    }

    if (typeFilter !== "all") {
      list = list.filter((t) => (t as any).type === typeFilter);
    }

    return list;
  }, [activeCategory, templatesList, typeFilter, selectedOccasion]);

  const templateMap = useMemo(() => {
    const lookup = new Map<string, TemplateSummary>();
    templatesList.forEach((t: any) => {
      // accept both id / _id (in case you still have old data)
      const id = (t.id ?? t._id) as string;
      lookup.set(id, { ...(t as any), id } as any);
    });
    return lookup;
  }, [templatesList]);

  const selectedTemplateObj = selectedTemplateId ? templateMap.get(selectedTemplateId) ?? null : null;

  const currentJob = useMemo(() => {
    if (!currentJobId) return null;
    return jobs.find((j) => j.id === currentJobId) ?? null;
  }, [jobs, currentJobId]);

  // Preview URLs for local files
  useEffect(() => {
    const urls = uploadedFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [uploadedFiles]);

  // Monitor job status changes
  useEffect(() => {
    if (!currentJob) return;

    if (currentJob.status === "done" && currentJob.result_url) {
      setPreviewAfter(currentJob.result_url);
      setIsGenerating(false);
      toast.success(currentJob.type === "video" ? "🎬 Your video is ready!" : "🎄 Your Christmas card is ready!");
    } else if (currentJob.status === "error") {
      setIsGenerating(false);
      toast.error(currentJob.error_message || "Failed to generate. Please try again.");
    } else if (currentJob.status === "processing") {
      toast.info(currentJob.type === "video" ? "🎥 AI is creating your video..." : "🎨 AI is creating your Christmas card...");
    }
  }, [currentJob]);

  const handleTemplateSelect = useCallback(
    (template: any) => {
      const id = (template.id ?? template._id) as string;

      setSearchParams(
        (prev) => {
          if (prev.get("template") === id) {
            prev.delete("template");
            toast.success(`Deselected: ${template.title}`);
          } else {
            prev.set("template", id);
            if (template.occasion && !prev.get("occasion")) {
              prev.set("occasion", String(template.occasion).toLowerCase().trim());
            }
            toast.success(`Selected: ${template.title}`);
          }
          return prev;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
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
    }

    event.target.value = "";
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files).filter((f) => f.type.startsWith("image/"));

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
    if (!url) return toast.error("No file to download");

    try {
      toast.info("Preparing download...");
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

      toast.success("Download started!");
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Direct download failed. Opening in new tab...");
      window.open(url, "_blank");
    }
  }, []);

  const { openFunnel } = useCreditsFunnel();

  const handleGenerate = useCallback(async () => {
    if (!user) {
      openFunnel({ mode: "not_logged_in" });
      return;
    }
    if (!selectedTemplateId) {
      toast.error("Please select a template.");
      return;
    }

    const template = templateMap.get(selectedTemplateId);
    if (!template) {
      toast.error("Template not found. Please pick another option.");
      return;
    }

    if ((userCredits ?? 0) < (template as any).creditCost) {
      const hasGeneratedBefore = jobs.length > 0;
      if (!hasGeneratedBefore && (userCredits ?? 0) === 0) {
        openFunnel({ mode: "first_generation" });
      } else {
        openFunnel({
          mode: "insufficient_credits",
          required: (template as any).creditCost,
          available: userCredits ?? 0,
        });
      }
      return;
    }

    const previewSection = document.getElementById("preview-section");
    previewSection?.scrollIntoView({ behavior: "smooth", block: "start" });

    setIsGenerating(true);
    setCurrentJobId(null);
    setPreviewAfter(null);

    try {
      const isVideo = (selectedTemplateObj as any)?.type === "video";
      if (isVideo && uploadedFiles.length > 3) {
        toast.error("You can upload up to 3 photos for video generation.");
        setIsGenerating(false);
        return;
      }

      // ✅ Upload files to Supabase Storage -> get public URLs
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
          templateId: (template as any).id,
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
        toast.success("Video generation started! This may take 5-10 minutes.");
      } else {
        const res: any = await triggerCreateJob({
          type: "image",
          templateId: (template as any).id,
          inputUrls,
          aspectRatio: selectedAspectRatio,
          userInstructions: customInstructions.trim() || undefined,
        });

        const jobId = String(res?.jobId ?? res?.id ?? res);
        setCurrentJobId(jobId);
        toast.success("Generation started! This may take 30-60 seconds.");
      }
    } catch (error: any) {
      setIsGenerating(false);
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
    selectedTemplateObj,
    openFunnel,
    jobs,
    selectedLanguage,
  ]);

  return (
    <div className="relative min-h-screen text-[#f6f8ff] overflow-x-hidden">
      <SnowBackground />

      {/* Upload area */}
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
        className="mx-auto my-8 max-w-4xl rounded-3xl border border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.06)] p-8 text-center cursor-pointer transition hover:bg-[rgba(255,255,255,.12)] hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]"
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

        <h2 className="text-xl font-semibold mb-2">
          {uploadedFiles.length > 0
            ? `✅ ${uploadedFiles.length} photo${uploadedFiles.length > 1 ? "s" : ""} uploaded`
            : "Drag & drop"}
        </h2>

        <p className="text-[#c1c8d8]">
          {uploadedFiles.length > 0 ? "Click to add more photos" : "or click to upload your reference photos"}
        </p>

        <p className="mt-4 text-sm text-[#c1c8d8]">
          {uploadedFiles.length > 0 && !selectedTemplateId ? "Now select your desired template below ⬇️" : ""}
        </p>
      </section>

      {modal.open && (
        <VideoModal
          src={modal.src}
          title={modal.title}
          onClose={() => setModal({ open: false, src: "", title: "" })}
        />
      )}

      {/* Uploaded preview */}
      {uploadedFiles.length > 0 && (
        <div className="mx-auto my-6 max-w-4xl px-4">
          <div className="flex flex-wrap gap-3 justify-center">
            {previewUrls.map((url, index) => (
              <div
                key={index}
                className="relative w-24 h-24 rounded-xl overflow-hidden border border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.06)] group"
              >
                <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(index);
                  }}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/90 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
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

      {/* Filters */}
      <div className="flex flex-row items-center justify-between gap-4 mb-6 px-4 max-w-5xl mx-auto">
        <div className="w-full max-w-[320px]">
          <Select value={activeCategory} onValueChange={setActiveCategory}>
            <SelectTrigger className="w-full bg-[rgba(255,255,255,.1)] border-[rgba(255,255,255,.2)] text-white">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="bg-[#0b1220] border-[rgba(255,255,255,.2)] text-white">
              {categories.map((c) => (
                <SelectItem key={c} value={c} className="focus:bg-[rgba(255,255,255,.1)] focus:text-white">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full max-w-[200px]">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="w-full bg-[rgba(255,255,255,.1)] border-[rgba(255,255,255,.2)] text-white">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent className="bg-[#0b1220] border-[rgba(255,255,255,.2)] text-white">
              <SelectItem value="all" className="focus:bg-[rgba(255,255,255,.1)] focus:text-white">
                All Media
              </SelectItem>
              <SelectItem value="image" className="focus:bg-[rgba(255,255,255,.1)] focus:text-white">
                Images
              </SelectItem>
              <SelectItem value="video" className="focus:bg-[rgba(255,255,255,.1)] focus:text-white">
                Videos
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Templates */}
      <div className="mx-auto grid max-w-5xl grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 px-4 pb-8">
        {filteredTemplates.map((t: any) => {
          const id = (t.id ?? t._id) as string;
          const isSelected = selectedTemplateId === id;
          return (
            <TemplateCard
              key={id}
              template={{ ...(t as any), id }}
              isSelected={isSelected}
              onSelect={handleTemplateSelect}
              onOpenModal={(src, title) => setModal({ open: true, src, title })}
            />
          );
        })}
      </div>

      {/* Before/After */}
      <div
        id="preview-section"
        className="mx-auto mt-4 w-[92%] max-w-5xl grid grid-cols-2 gap-6 text-center font-bold text-[#c1c8d8]"
      >
        <span>Before</span>
        <span>After</span>
      </div>

      <div
        className={cn(
          "mx-auto mt-2 w-[92%] max-w-5xl grid grid-cols-1 sm:grid-cols-2 gap-6 px-4 pb-32",
          selectedTemplateObj && (selectedTemplateObj as any).type === "video"
            ? "pb-72"
            : (selectedTemplateObj as any)?.type === "image"
              ? "pb-64"
              : ""
        )}
      >
        <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.06)] p-5 text-[#c1c8d8] shadow-[0_8px_26px_rgba(0,0,0,.45)] overflow-hidden">
          {previewUrls.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center items-center">
              {previewUrls.map((url, i) => (
                <img key={i} src={url} alt={`Input ${i + 1}`} className="max-w-full max-h-[240px] object-contain rounded-lg" />
              ))}
            </div>
          ) : (
            <span>No images uploaded</span>
          )}
        </div>

        <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.06)] p-5 text-[#c1c8d8] shadow-[0_8px_26px_rgba(0,0,0,.45)] overflow-hidden relative">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#ffd976] border-t-transparent" />
              <span className="text-sm">Generating magic...</span>
            </div>
          ) : previewAfter ? (
            <>
              {currentJob?.type === "video" ? (
                <video src={previewAfter} controls className="max-w-full max-h-full object-contain rounded-lg" autoPlay loop />
              ) : (
                <img src={previewAfter} alt="After" className="max-w-full max-h-full object-contain rounded-lg" />
              )}

              <button
                onClick={() => {
                  const ext = currentJob?.type === "video" ? "mp4" : "png";
                  const filename =
                    currentJob?.type === "video"
                      ? `video-${Date.now()}.${ext}`
                      : `christmas-card-${Date.now()}.${ext}`;
                  void handleDownload(previewAfter, filename);
                }}
                className="absolute bottom-4 right-4 bg-[#ffd976] text-[#1e1e1e] px-4 py-2 rounded-lg font-semibold hover:brightness-110 active:scale-95 transition"
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

      {/* Bottom controls */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 py-3 bg-[rgba(6,10,18,0.95)] backdrop-blur-xl border-t border-[rgba(255,255,255,.18)] shadow-[0_-8px_32px_rgba(0,0,0,.5)]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-3">
            {selectedTemplateObj ? (
              (selectedTemplateObj as any).type === "video" ? (
                <>
                  <p className="text-xs text-[#c1c8d8] mt-2 flex items-start sm:items-center gap-2">
                    <span className="mt-0.5">
                      <Info size={18} />
                    </span>
                    <span>
                      Video generation costs {(selectedTemplateObj as any)?.creditCost ?? "X"} credits per second. Enabling
                      "With Audio" will double the cost.
                    </span>
                  </p>

                  <div className="flex flex-col md:flex-row gap-3">
                    <textarea
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="Optional: Add custom instructions..."
                      className="flex-1 rounded-xl bg-[rgba(255,255,255,.1)] border border-[rgba(255,255,255,.2)] p-2.5 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976] resize-none min-h-[40px] max-h-[80px]"
                      rows={3}
                      disabled={isGenerating}
                    />

                    <textarea
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value.slice(0, 500))}
                      placeholder="Negative Prompt (Optional) e.g., blurry, low quality, distorted"
                      className="flex-1 rounded-xl bg-[rgba(255,255,255,.1)] border border-[rgba(255,255,255,.2)] p-2.5 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976] resize-none min-h-[40px]"
                      disabled={isGenerating}
                    />

                    <div className="flex flex-row md:flex-col justify-between gap-2">
                      <LanguageSelector value={selectedLanguage} onChange={setSelectedLanguage} disabled={isGenerating} />

                      <label className="flex items-center gap-2 text-sm text-white whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={generateAudio}
                          onChange={(e) => setGenerateAudio(e.target.checked)}
                          className="w-4 h-4"
                          disabled={isGenerating}
                        />
                        With Audio
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleGenerate()}
                      disabled={isGenerating || !selectedTemplateId}
                      className="rounded-xl px-5 py-2 font-semibold text-[#1e1e1e] border border-transparent bg-[linear-gradient(135deg,#ff4d4d,#ff9866,#ffd976)] hover:brightness-110 active:scale-[.98] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ml-auto h-10"
                    >
                      {isGenerating ? "Generating..." : "Generate"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full">
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Optional: Add custom instructions..."
                    className="flex-1 rounded-xl bg-[rgba(255,255,255,.1)] border border-[rgba(255,255,255,.2)] p-2.5 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976] resize-none min-h-[44px] max-h-[100px]"
                    rows={1}
                    disabled={isGenerating}
                  />

                  <div className="flex items-center justify-end gap-3">
                    <Select
                      value={selectedAspectRatio}
                      onValueChange={setSelectedAspectRatio}
                      disabled={isGenerating || uploadedFiles.length === 0 || !selectedTemplateId}
                    >
                      <SelectTrigger className="min-w-[120px] bg-[rgba(255,255,255,.1)] border-[rgba(255,255,255,.2)] text-white">
                        <SelectValue placeholder="Aspect ratio" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0b1220] border-[rgba(255,255,255,.2)] text-white">
                        {aspectRatioOptions.map((o) => (
                          <SelectItem
                            key={o.value}
                            value={o.value}
                            className="focus:bg-[rgba(255,255,255,.1)] focus:text-white"
                          >
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <button
                      type="button"
                      onClick={() => void handleGenerate()}
                      disabled={isGenerating || !selectedTemplateId}
                      className="rounded-xl px-5 py-2 font-semibold text-[#1e1e1e] border border-transparent bg-[linear-gradient(135deg,#ff4d4d,#ff9866,#ffd976)] hover:brightness-110 active:scale-[.98] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {isGenerating ? "Generating..." : "Generate"}
                    </button>
                  </div>
                </div>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}