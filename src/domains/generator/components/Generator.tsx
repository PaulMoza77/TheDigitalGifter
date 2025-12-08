import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useBootstrapUser } from "@/hooks/useBootstrapUser";
import { toast } from "sonner";
import { Id } from "../../../../convex/_generated/dataModel";
import VideoModal from "@/components/VideoModal";
import TemplateCard from "@/components/TemplateCard";
import { TemplateSummary } from "@/types/templates";
import {
  useTemplatesQuery,
  useUserCreditsQuery,
  useJobsQuery,
  useCreateJobMutation,
  useGenerateUploadUrlMutation,
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
import { Info } from "lucide-react";
import LanguageSelector from "@/components/LanguageSelector";
import { useCreditsFunnel } from "@/contexts/CreditsFunnelContext";

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
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
    />
  );
}

// Aspect ratio options - defined outside component to prevent recreation on every render

export default function GeneratorPage() {
  const user = useBootstrapUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState("All");

  // URL-based template and occasion selection (persists on refresh)
  const selectedTemplate = searchParams.get(
    "template"
  ) as Id<"templates"> | null;
  const selectedOccasion =
    searchParams.get("occasion")?.toLowerCase().trim() || null;

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<Id<"jobs"> | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] =
    useState("match_input_image");

  const [modal, setModal] = useState<{
    open: boolean;
    src: string;
    title?: string;
  }>({
    open: false,
    src: "",
    title: "",
  });

  // Video feature is enabled in production: both Image and Video flows available.
  // Remove mediaType state, use selected template type for controls
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">(
    "all"
  );

  // Video-specific state (R2V enforced: duration=8, aspect_ratio=16:9, resolution=1080p)
  const [generateAudio, setGenerateAudio] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("English");

  const { data: templates = [] } = useTemplatesQuery();
  const templatesList = templates as TemplateSummary[];
  const { data: creditsData = 0 } = useUserCreditsQuery();
  const { data: jobs = [] } = useJobsQuery();
  const { mutateAsync: requestUploadUrl } = useGenerateUploadUrlMutation();
  const { mutateAsync: triggerCreateJob } = useCreateJobMutation();
  const { mutateAsync: triggerCreateVideoJob } = useCreateVideoJobMutation();
  const userCredits: number = (creditsData ?? 0) as number;

  // Note: occasion and template are now read directly from URL via searchParams (defined above)

  const categories = [
    "All",
    "Classic",
    "Cozy",
    "Snowy",
    "Romantic",
    // "Religious",
    // "Minimalist",
    // "Homey",
  ];

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

  // Filter templates by occasion (if specified), category and optional type (image/video)
  const filteredTemplates = useMemo(() => {
    let list = templatesList;

    // First filter by occasion if specified in query params
    if (selectedOccasion) {
      list = list.filter(
        (t) =>
          (t.occasion || "").toString().trim().toLowerCase() ===
          selectedOccasion
      );
    }

    // Then filter by category
    const activeNormalized = (activeCategory || "")
      .toString()
      .trim()
      .toLowerCase();
    if (activeNormalized && activeNormalized !== "all") {
      list = list.filter(
        (t) =>
          (t.category || "").toString().trim().toLowerCase() ===
          activeNormalized
      );
    }

    // Then filter by type
    if (typeFilter !== "all") {
      list = list.filter((t) => (t as any).type === typeFilter);
    }
    return list;
  }, [activeCategory, templatesList, typeFilter, selectedOccasion]);

  const templateMap = useMemo(() => {
    const lookup = new Map<string, TemplateSummary>();
    templatesList.forEach((template) => {
      lookup.set(template._id, template);
    });
    return lookup;
  }, [templatesList]);

  // Get selected template object
  const selectedTemplateObj = selectedTemplate
    ? templateMap.get(selectedTemplate)
    : null;

  // Watch for current job status updates
  const currentJob = useMemo(
    () =>
      currentJobId ? (jobs.find((j) => j._id === currentJobId) ?? null) : null,
    [jobs, currentJobId]
  );

  // Update preview URLs when files change
  useEffect(() => {
    const urls = uploadedFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [uploadedFiles]);

  // Monitor job status changes
  useEffect(() => {
    if (!currentJob) return;

    if (currentJob.status === "done" && currentJob.resultUrl) {
      setPreviewAfter(currentJob.resultUrl);
      setIsGenerating(false);
      if (currentJob.type === "video") {
        toast.success("🎬 Your video is ready!");
      } else {
        toast.success("🎄 Your Christmas card is ready!");
      }
    } else if (currentJob.status === "error") {
      setIsGenerating(false);
      const errorMsg =
        currentJob.errorMessage || "Failed to generate. Credits refunded.";
      toast.error(errorMsg);
    } else if (currentJob.status === "processing") {
      if (currentJob.type === "video") {
        toast.info("🎥 AI is creating your video...");
      } else {
        toast.info("🎨 AI is creating your Christmas card...");
      }
    }
  }, [currentJob]);

  // Update URL when template is selected (supports toggle/deselect)
  const handleTemplateSelect = useCallback(
    (template: TemplateSummary) => {
      setSearchParams(
        (prev) => {
          // Toggle: if same template clicked, deselect it
          if (prev.get("template") === template._id) {
            prev.delete("template");
            toast.success(`Deselected: ${template.title}`);
          } else {
            prev.set("template", template._id);
            // Also set occasion from template if not already set
            if (template.occasion && !prev.get("occasion")) {
              prev.set("occasion", template.occasion.toLowerCase().trim());
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

  // Handle file upload (multiple files)
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length > 0) {
        const validFiles = files.filter((file) => {
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
        if (validFiles.length > 0) {
          setUploadedFiles((prev) => [...prev, ...validFiles]);
          toast.success(`${validFiles.length} photo(s) uploaded!`);
        }
      }
      // Reset input to allow selecting the same file again
      event.target.value = "";
    },
    []
  );

  // Handle drag and drop (multiple files)
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files).filter((file) =>
      file.type.startsWith("image/")
    );
    if (files.length > 0) {
      const validFiles = files.filter((file) => {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large. Maximum 10MB.`);
          return false;
        }
        return true;
      });
      if (validFiles.length > 0) {
        setUploadedFiles((prev) => [...prev, ...validFiles]);
        toast.success(`${validFiles.length} photo(s) uploaded!`);
      }
    }
  }, []);

  // Remove uploaded file
  const handleRemoveFile = useCallback((index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handle download for both images and videos
  const handleDownload = useCallback(async (url: string, filename: string) => {
    if (!url) {
      toast.error("No file to download");
      return;
    }

    try {
      toast.info("Preparing download...");

      // Fetch the file as a blob
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create a blob URL
      const blobUrl = window.URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);

      toast.success("Download started!");
    } catch (error) {
      console.error("Download failed:", error);

      // Fallback: open in new tab
      toast.error("Direct download failed. Opening in new tab...");
      window.open(url, "_blank");
    }
  }, []);

  // Credits funnel popup context
  const { openFunnel } = useCreditsFunnel();

  // Handle generate
  const handleGenerate = useCallback(async () => {
    // Check if user is not logged in
    if (!user) {
      openFunnel({ mode: "not_logged_in" });
      return;
    }
    if (!selectedTemplate) {
      toast.error("Please select a template.");
      return;
    }

    // Note: Image upload is now optional for all template types
    // Users can generate with just a prompt or with reference images

    const template = templateMap.get(selectedTemplate);
    if (!template) {
      toast.error("Template not found. Please pick another option.");
      return;
    }

    // Check if user has insufficient credits
    if ((userCredits ?? 0) < template.creditCost) {
      // Determine if this is first generation (no jobs yet = first time user)
      const hasGeneratedBefore = jobs.length > 0;

      if (!hasGeneratedBefore && (userCredits ?? 0) === 0) {
        // First time user with 0 credits
        openFunnel({ mode: "first_generation" });
      } else {
        // Has some credits but not enough
        openFunnel({
          mode: "insufficient_credits",
          required: template.creditCost,
          available: userCredits ?? 0,
        });
      }
      return;
    }

    const previewSection = document.getElementById("preview-section");
    if (previewSection) {
      previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    setIsGenerating(true);
    setCurrentJobId(null);
    setPreviewAfter(null);

    try {
      // Video R2V validation: allow 0-3 images (optional)
      if (selectedTemplateObj && selectedTemplateObj.type === "video") {
        if (uploadedFiles.length > 3) {
          toast.error("You can upload up to 3 photos for video generation.");
          setIsGenerating(false);
          return;
        }
      }

      const filesToUpload = uploadedFiles;
      const storageIds = await Promise.all(
        filesToUpload.map(async (file) => {
          const uploadUrl = await requestUploadUrl();
          const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }
          const { storageId } = (await uploadResponse.json()) as {
            storageId: Id<"_storage">;
          };
          if (!storageId) {
            throw new Error("Upload response missing storage ID");
          }
          return storageId;
        })
      );

      if (selectedTemplateObj && selectedTemplateObj.type === "video") {
        // Validate video-specific fields
        if (customInstructions && customInstructions.length > 2000) {
          throw new Error("User instructions must be <= 2000 characters");
        }
        if (negativePrompt && negativePrompt.length > 500) {
          throw new Error("Negative prompt must be <= 500 characters");
        }

        // Build final prompt with language instruction if not English
        let finalUserInstructions = customInstructions.trim();
        if (selectedLanguage && selectedLanguage !== "English") {
          const languageInstruction = `The dialogue and any spoken words should be in ${selectedLanguage}.`;
          finalUserInstructions = finalUserInstructions
            ? `${finalUserInstructions} ${languageInstruction}`
            : languageInstruction;
        }

        // Enforce R2V parameters: always duration=8, aspect_ratio=16:9, resolution=1080p
        const res = await triggerCreateVideoJob({
          templateId: template._id,
          inputFileIds: storageIds as Id<"_storage">[],
          userInstructions: finalUserInstructions || undefined,
          duration: 8,
          resolution: "1080p",
          aspectRatio: "16:9",
          generateAudio,
          negativePrompt: negativePrompt.trim() || undefined,
        });

        const jobId = (res as any)?.jobId ?? (res as any as Id<"jobs">);
        setCurrentJobId(jobId);
        toast.success("Video generation started! This may take 5-10 minutes.");
      } else {
        const jobId = await triggerCreateJob({
          type: "image",
          inputFileIds: storageIds,
          templateId: template._id,
          aspectRatio: selectedAspectRatio,
          userInstructions: customInstructions.trim() || undefined,
        });

        setCurrentJobId(jobId);
        toast.success("Generation started! This may take 30-60 seconds.");
      }
    } catch (error: any) {
      setIsGenerating(false);
      const message = error?.message ?? "Failed to generate.";
      toast.error(message);
    }
  }, [
    user,
    selectedTemplate,
    uploadedFiles,
    templateMap,
    userCredits,
    requestUploadUrl,
    triggerCreateJob,
    triggerCreateVideoJob,
    selectedAspectRatio,
    customInstructions,
    generateAudio,
    negativePrompt,
    selectedTemplateObj,
    openFunnel,
    jobs,
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
        aria-label="Upload photos for your Christmas card. Drag and drop or click to select images."
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
          {uploadedFiles.length > 0
            ? "Click to add more photos"
            : "or click to upload your reference photos"}
        </p>
        <p className="mt-4 text-sm text-[#c1c8d8]">
          {uploadedFiles.length > 0 && !selectedTemplate
            ? "Now select your desired template below ⬇️"
            : ""}
        </p>
      </section>

      {/* Video preview modal (full view) */}
      {modal.open && (
        <VideoModal
          src={modal.src}
          title={modal.title}
          onClose={() => setModal({ open: false, src: "", title: "" })}
        />
      )}

      {/* Uploaded images preview */}
      {uploadedFiles.length > 0 && (
        <div className="mx-auto my-6 max-w-4xl px-4">
          <div className="flex flex-wrap gap-3 justify-center">
            {previewUrls.map((url, index) => (
              <div
                key={index}
                className="relative w-24 h-24 rounded-xl overflow-hidden border border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.06)] group"
              >
                <img
                  src={url}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(index);
                  }}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/90 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inline filter row: left (category), right (media type) */}
      <div className="flex flex-row items-center justify-between gap-4 mb-6 px-4 max-w-5xl mx-auto">
        <div className="w-full max-w-[320px]">
          <Select value={activeCategory} onValueChange={setActiveCategory}>
            <SelectTrigger className="w-full bg-[rgba(255,255,255,.1)] border-[rgba(255,255,255,.2)] text-white">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="bg-[#0b1220] border-[rgba(255,255,255,.2)] text-white">
              {categories.map((c) => (
                <SelectItem
                  key={c}
                  value={c}
                  className="focus:bg-[rgba(255,255,255,.1)] focus:text-white"
                >
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full max-w-[200px]">
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as "all" | "image" | "video")}
          >
            <SelectTrigger className="w-full bg-[rgba(255,255,255,.1)] border-[rgba(255,255,255,.2)] text-white">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent className="bg-[#0b1220] border-[rgba(255,255,255,.2)] text-white">
              <SelectItem
                value="all"
                className="focus:bg-[rgba(255,255,255,.1)] focus:text-white"
              >
                All Media
              </SelectItem>
              <SelectItem
                value="image"
                className="focus:bg-[rgba(255,255,255,.1)] focus:text-white"
              >
                Images
              </SelectItem>
              <SelectItem
                value="video"
                className="focus:bg-[rgba(255,255,255,.1)] focus:text-white"
              >
                Videos
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Template cards */}
      <div className="mx-auto grid max-w-5xl grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 px-4 pb-8">
        {filteredTemplates.map((template) => {
          const isSelected = selectedTemplate === template._id;
          return (
            <TemplateCard
              key={template._id}
              template={template}
              isSelected={isSelected}
              onSelect={handleTemplateSelect}
              onOpenModal={(src, title) =>
                setModal({ open: true, src, title: title })
              }
            />
          );
        })}
      </div>

      {/* Before/After labels */}
      <div
        id="preview-section"
        className="mx-auto mt-4 w-[92%] max-w-5xl grid grid-cols-2 gap-6 text-center font-bold text-[#c1c8d8]"
      >
        <span>Before</span>
        <span>After</span>
      </div>

      {/* Before/After panels */}
      <div
        className={cn(
          `mx-auto mt-2 w-[92%] max-w-5xl grid grid-cols-1 sm:grid-cols-2 gap-6 px-4 pb-32`,
          selectedTemplateObj && selectedTemplateObj.type === "video"
            ? "pb-72"
            : selectedTemplateObj?.type === "image" && "pb-64"
        )}
      >
        <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.06)] p-5 text-[#c1c8d8] shadow-[0_8px_26px_rgba(0,0,0,.45)] overflow-hidden">
          {previewUrls.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center items-center">
              {previewUrls.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Input ${index + 1}`}
                  className="max-w-full max-h-[240px] object-contain rounded-lg"
                />
              ))}
            </div>
          ) : (
            <span>No images uploaded</span>
          )}
        </div>
        <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.06)] p-5 text-[#c1c8d8] shadow-[0_8px_26px_rgba(0,0,0,.45)] overflow-hidden relative">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#ffd976] border-t-transparent"></div>
              <span className="text-sm">Generating magic...</span>
            </div>
          ) : previewAfter ? (
            <>
              {currentJob?.type === "video" ? (
                <video
                  src={previewAfter}
                  controls
                  className="max-w-full max-h-full object-contain rounded-lg"
                  autoPlay
                  loop
                />
              ) : (
                <img
                  src={previewAfter}
                  alt="After"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              )}
              <button
                onClick={() => {
                  const extension =
                    currentJob?.type === "video" ? "mp4" : "png";
                  const filename =
                    currentJob?.type === "video"
                      ? `video-${Date.now()}.${extension}`
                      : `christmas-card-${Date.now()}.${extension}`;
                  void handleDownload(previewAfter, filename);
                }}
                className="absolute bottom-4 right-4 bg-[#ffd976] text-[#1e1e1e] px-4 py-2 rounded-lg font-semibold hover:brightness-110 active:scale-95 transition"
                type="button"
                aria-label={`Download ${currentJob?.type === "video" ? "video" : "image"}`}
              >
                Download
              </button>
            </>
          ) : (
            <span>No image generated yet</span>
          )}
        </div>
      </div>

      {/* Dynamic controls based on selected template type */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 py-3 bg-[rgba(6,10,18,0.95)] backdrop-blur-xl border-t border-[rgba(255,255,255,.18)] shadow-[0_-8px_32px_rgba(0,0,0,.5)]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-3">
            {/* Show controls only when a template is selected. Render video controls for video templates, image controls for image templates. */}
            {selectedTemplateObj ? (
              selectedTemplateObj.type === "video" ? (
                <>
                  {/* R2V notice shown in the video controls area */}
                  <p className="text-xs text-[#c1c8d8] mt-2 flex items-start sm:items-center gap-2">
                    <div>
                      <Info size={18} />
                    </div>
                    <span>
                      Video generation costs{" "}
                      {selectedTemplateObj?.creditCost ?? "X"} credits per
                      second. Enabling "Generate With Audio" will double the
                      credit cost (e.g.,{" "}
                      {selectedTemplateObj?.creditCost
                        ? selectedTemplateObj.creditCost * 2
                        : "2X"}{" "}
                      credits per second). Please specify the age's as well for
                      better results.
                    </span>
                  </p>

                  {/*Instructions and Negative Prompt */}
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
                      onChange={(e) =>
                        setNegativePrompt(e.target.value.slice(0, 500))
                      }
                      placeholder="Negative Prompt (Optional) e.g., blurry, low quality, distorted"
                      className="flex-1 rounded-xl bg-[rgba(255,255,255,.1)] border border-[rgba(255,255,255,.2)] p-2.5 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976] resize-none min-h-[40px]"
                    />

                    {/* Bottom row: Controls + Generate button */}
                    <div className="flex flex-row md:flex-col justify-between gap-2">
                      {/* Video controls - will wrap on small screens */}

                      {/* Language Selector */}
                      <LanguageSelector
                        value={selectedLanguage}
                        onChange={setSelectedLanguage}
                        disabled={isGenerating}
                      />

                      <label className="flex items-center gap-2 text-sm text-white whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={generateAudio}
                          onChange={(e) => setGenerateAudio(e.target.checked)}
                          className="w-4 h-4"
                        />
                        With Audio
                      </label>
                    </div>

                    {/* Generate button - pushes to right on large screens, stays on left after wrapping on small screens */}
                    <button
                      type="button"
                      onClick={() => {
                        void handleGenerate();
                      }}
                      aria-label="Generate your AI Christmas card video"
                      disabled={isGenerating || !selectedTemplate}
                      className="rounded-xl px-5 py-2 font-semibold text-[#1e1e1e] border border-transparent bg-[linear-gradient(135deg,#ff4d4d,#ff9866,#ffd976)] hover:brightness-110 active:scale-[.98] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ml-auto h-10"
                    >
                      {isGenerating ? "Generating..." : "Generate"}
                    </button>
                  </div>
                </>
              ) : (
                // IMAGE controls
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full">
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Optional: Add custom instructions..."
                    className="flex-1 rounded-xl bg-[rgba(255,255,255,.1)] border border-[rgba(255,255,255,.2)] p-2.5 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976] resize-none min-h-[44px] max-h-[100px]"
                    rows={1}
                    disabled={isGenerating}
                  />

                  {selectedTemplateObj &&
                    selectedTemplateObj.type === "image" && (
                      <div className="flex items-center justify-end gap-3">
                        <div className="relative">
                          <Select
                            value={selectedAspectRatio}
                            onValueChange={setSelectedAspectRatio}
                            disabled={
                              isGenerating ||
                              uploadedFiles.length === 0 ||
                              !selectedTemplate
                            }
                          >
                            <SelectTrigger className="min-w-[120px] bg-[rgba(255,255,255,.1)] border-[rgba(255,255,255,.2)] text-white">
                              <SelectValue placeholder="Aspect ratio" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0b1220] border-[rgba(255,255,255,.2)] text-white">
                              {aspectRatioOptions.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                  className="focus:bg-[rgba(255,255,255,.1)] focus:text-white"
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void handleGenerate();
                          }}
                          disabled={isGenerating || !selectedTemplate}
                          className="rounded-xl px-5 py-2 font-semibold text-[#1e1e1e] border border-transparent bg-[linear-gradient(135deg,#ff4d4d,#ff9866,#ffd976)] hover:brightness-110 active:scale-[.98] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {isGenerating ? "Generating..." : "Generate"}
                        </button>
                      </div>
                    )}
                </div>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
