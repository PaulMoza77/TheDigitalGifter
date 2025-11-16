import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useBootstrapUser } from "../hooks/useBootstrapUser";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { Coins } from "lucide-react";
import { TEMPLATES } from "@/constants/templates";

// Snow Animation Background Component
function SnowBackground() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  React.useEffect(() => {
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

// Template data structure

export default function GeneratorPage() {
  const user = useBootstrapUser();
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<Id<"jobs"> | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] =
    useState("match_input_image");

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createJob = useMutation(api.jobs.create);
  const userCredits = useQuery(api.credits.getUserCredits);
  const jobs = useQuery(api.jobs.list) || [];
  const dbTemplates = useQuery(api.templates.list) || [];

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

  // Filter templates by category
  const filteredTemplates =
    activeCategory === "All"
      ? TEMPLATES
      : TEMPLATES.filter((t) => t.category === activeCategory);

  // Watch for current job status updates
  const currentJob = currentJobId
    ? jobs.find((j) => j._id === currentJobId)
    : null;

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
      toast.success("🎄 Your Christmas card is ready!");
    } else if (currentJob.status === "error") {
      setIsGenerating(false);
      const errorMsg =
        currentJob.errorMessage || "Failed to generate. Credits refunded.";
      toast.error(errorMsg);
    } else if (currentJob.status === "processing") {
      toast.info("🎨 AI is creating your Christmas card...");
    }
  }, [currentJob]);

  // Handle file upload (multiple files)
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  // Handle drag and drop (multiple files)
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
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
  };

  // Remove uploaded file
  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle download
  async function handleDownload(url: string, filename: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch image");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Download started!");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to download image");
    }
  }

  // Handle generate
  async function handleGenerate() {
    if (!user) {
      toast.error("Please sign in to generate.");
      return;
    }
    if (!selectedTemplate) {
      toast.error("Please select a template.");
      return;
    }
    if (uploadedFiles.length === 0) {
      toast.error("Please upload at least one photo.");
      return;
    }

    const template = TEMPLATES.find((t) => t.id === selectedTemplate);
    if (!template) return;

    // Find matching database template by title
    const dbTemplate = dbTemplates.find((t) => t.title === template.title);
    const templateId = dbTemplate?._id;

    if ((userCredits || 0) < template.creditCost) {
      toast.error(`Not enough credits. Need ${template.creditCost} credits.`);
      return;
    }

    // Scroll to preview section
    const previewSection = document.getElementById("preview-section");
    if (previewSection) {
      previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    setIsGenerating(true);
    setCurrentJobId(null);
    setPreviewAfter(null);

    try {
      // Upload all files
      const storageIds: Id<"_storage">[] = [];
      for (const file of uploadedFiles) {
        const uploadUrl = await generateUploadUrl();
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await uploadResponse.json();
        storageIds.push(storageId);
      }

      // Build final prompt with custom instructions
      let finalPrompt = template.prompt;
      if (customInstructions.trim()) {
        finalPrompt += ` Additional instructions: ${customInstructions.trim()}`;
      }

      // Create job with multiple input files
      // Pass creditCost from constants template to ensure correct deduction
      const jobId = await createJob({
        type: "image",
        prompt: finalPrompt,
        inputFileIds: storageIds,
        templateId: templateId,
        aspectRatio: selectedAspectRatio,
        creditCost: template.creditCost, // Always use template's creditCost
      });

      setCurrentJobId(jobId);
      toast.success("Generation started! This may take 30-60 seconds.");
    } catch (error: any) {
      setIsGenerating(false);
      const message = error.message || "Failed to generate.";
      toast.error(message);
    }
  }

  return (
    <div className="relative min-h-screen text-[#f6f8ff] overflow-x-hidden">
      <SnowBackground />

      {/* Upload area */}
      <section
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById("file-input")?.click()}
        className="mx-auto my-8 max-w-4xl rounded-3xl border border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.06)] p-8 text-center cursor-pointer transition hover:bg-[rgba(255,255,255,.12)] hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]"
      >
        <input
          id="file-input"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
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

      {/* Category buttons */}
      <div className="flex flex-wrap justify-center gap-2 mb-6 px-4">
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          const activeStyle = isActive
            ? "text-[#1e1e1e] bg-[linear-gradient(135deg,#ffd976,#ff9f66)] border-[rgba(255,235,200,.8)] shadow-[0_12px_30px_rgba(255,170,90,.35)]"
            : "text-[#c1c8d8] bg-[rgba(255,255,255,.06)] border-[rgba(255,255,255,.18)] hover:text-[#1e1e1e] hover:bg-[linear-gradient(135deg,#ffe6a3,#ffb482)] hover:border-[rgba(255,210,150,.6)] hover:shadow-[0_10px_24px_rgba(255,200,140,.35)] hover:-translate-y-[1px]";
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-xl border px-3 py-2 font-bold transition-all duration-200 ${activeStyle}`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Template cards */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 px-4 pb-8">
        {filteredTemplates.map((template) => {
          const isSelected = selectedTemplate === template.id;
          return (
            <div
              key={template.id}
              onClick={() => {
                setSelectedTemplate(template.id);
                toast.success(`Selected: ${template.title}`);
              }}
              className={`rounded-3xl border overflow-hidden hover:-translate-y-0.5 transition group cursor-pointer ${
                isSelected
                  ? "border-[#ffd976] ring-2 ring-[#ffd976] shadow-[0_0_20px_rgba(255,217,118,0.5)]"
                  : "border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.06)]"
              }`}
            >
              <div className="relative aspect-[4/5] w-full">
                <img
                  src={template.previewUrl}
                  alt={template.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 flex items-center gap-2 bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] text-[#1a1a1a] text-xs font-extrabold px-2 py-1 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.3)]">
                  <Coins size={14} className="text-[#1a1a1a]" />{" "}
                  {template.creditCost}
                </div>

                {isSelected && (
                  <div className="absolute inset-0 bg-[rgba(255,217,118,0.2)] flex items-center justify-center">
                    <span className="text-4xl">✓</span>
                  </div>
                )}
              </div>
              <div className="p-4 bg-[rgba(255,255,255,.06)]">
                <h3 className="font-semibold text-base leading-tight">
                  {template.title}
                </h3>
                <p className="text-xs text-[#c1c8d8] mt-1">
                  {template.category}
                </p>
              </div>
            </div>
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
      <div className="mx-auto mt-2 w-[92%] max-w-5xl grid grid-cols-1 sm:grid-cols-2 gap-6 px-4 pb-32">
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
              <img
                src={previewAfter}
                alt="After"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
              <button
                onClick={() => {
                  const filename = `christmas-card-${Date.now()}.png`;
                  void handleDownload(previewAfter, filename);
                }}
                className="absolute bottom-4 right-4 bg-[#ffd976] text-[#1e1e1e] px-4 py-2 rounded-lg font-semibold hover:brightness-110 transition"
              >
                Download
              </button>
            </>
          ) : (
            <span>No image generated yet</span>
          )}
        </div>
      </div>

      {/* Floating Bottom Action Panel */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 py-3 bg-[rgba(6,10,18,0.95)] backdrop-blur-xl border-t border-[rgba(255,255,255,.18)] shadow-[0_-8px_32px_rgba(0,0,0,.5)]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Instructions textarea */}
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Optional: Add custom instructions..."
              className="flex-1 rounded-xl bg-[rgba(255,255,255,.1)] border border-[rgba(255,255,255,.2)] p-2.5 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976] resize-none min-h-[44px] max-h-[100px]"
              rows={1}
              disabled={isGenerating}
            />

            {/* Aspect Ratio & Generate */}
            <div className="flex items-center justify-end gap-3">
              <div className="relative">
                <select
                  value={selectedAspectRatio}
                  onChange={(e) => setSelectedAspectRatio(e.target.value)}
                  disabled={
                    isGenerating ||
                    uploadedFiles.length === 0 ||
                    !selectedTemplate
                  }
                  className="rounded-xl px-4 py-2 pr-9 font-semibold text-[#1e1e1e] border border-transparent bg-[linear-gradient(135deg,#ff4d4d,#ff9866,#ffd976)] hover:brightness-110 active:scale-[.98] transition disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer text-sm"
                >
                  <option value="match_input_image">Match input</option>
                  <option value="1:1">1:1</option>
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                  <option value="4:3">4:3</option>
                  <option value="3:4">3:4</option>
                  <option value="3:2">3:2</option>
                  <option value="2:3">2:3</option>
                  <option value="4:5">4:5</option>
                  <option value="5:4">5:4</option>
                  <option value="21:9">21:9</option>
                  <option value="9:21">9:21</option>
                  <option value="2:1">2:1</option>
                  <option value="1:2">1:2</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M6 9L1 4H11L6 9Z" fill="#1e1e1e" />
                  </svg>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleGenerate();
                }}
                disabled={
                  isGenerating ||
                  uploadedFiles.length === 0 ||
                  !selectedTemplate
                }
                className="rounded-xl px-5 py-2 font-semibold text-[#1e1e1e] border border-transparent bg-[linear-gradient(135deg,#ff4d4d,#ff9866,#ffd976)] hover:brightness-110 active:scale-[.98] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isGenerating ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
