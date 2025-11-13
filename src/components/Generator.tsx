import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useBootstrapUser } from "../hooks/useBootstrapUser";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { Coins } from "lucide-react";

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
const TEMPLATES = [
  {
    id: "family-tree-cozy",
    title: "Family by Tree",
    category: "Cozy",
    orientation: "portrait",
    previewUrl:
      "https://images.unsplash.com/photo-1543589077-47d81606c1bf?q=80&w=900",
    prompt:
      "Transform this person into a cozy family Christmas scene. Place them by a warm fireplace with a decorated Christmas tree in the background, soft golden lighting, wearing a festive red sweater, holding a cup of hot cocoa, surrounded by wrapped presents and stockings. Photorealistic, warm atmosphere, professional photography style.",
    creditCost: 10,
    tags: ["family", "warm", "cozy"],
  },
  {
    id: "faces-ornaments",
    title: "Faces on Ornaments",
    category: "Classic",
    orientation: "portrait",
    previewUrl:
      "https://images.unsplash.com/photo-1543583101-7954cac4f9a1?q=80&w=900",
    prompt:
      "Transform this person into a classic Christmas ornament scene. Place their face inside glossy baubles on a Christmas tree, beautiful bokeh lights in background, festive Christmas atmosphere, professional photography style.",
    creditCost: 12,
    tags: ["ornaments", "classic"],
  },
  {
    id: "fireplace-evening",
    title: "Fireplace Evening",
    category: "Cozy",
    orientation: "portrait",
    previewUrl:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=900",
    prompt:
      "Transform this person into a cozy fireplace Christmas scene. Place them in a living room with crackling fireplace, stockings, garland, soft orange light, warm intimate atmosphere, professional Christmas card style.",
    creditCost: 10,
    tags: ["fireplace", "cozy"],
  },
  {
    id: "winter-wonderland",
    title: "Winter Wonderland",
    category: "Snowy",
    orientation: "landscape",
    previewUrl:
      "https://images.unsplash.com/photo-1544273677-6e4c999de2a6?q=80&w=1200",
    prompt:
      "Transform this person into a magical winter wonderland scene. Place them in a snowy forest with falling snowflakes, wearing a warm winter coat and scarf, Christmas lights twinkling in the background trees, soft evening light, photorealistic style, cinematic quality.",
    creditCost: 10,
    tags: ["outdoor", "snow", "winter"],
  },
  {
    id: "romantic-evening",
    title: "Romantic Evening",
    category: "Romantic",
    orientation: "portrait",
    previewUrl:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=900",
    prompt:
      "Transform this person into a romantic Christmas scene with soft candlelight, warm intimate atmosphere, elegant decorations, romantic winter evening, cozy fireplace setting, beautiful romantic Christmas card style.",
    creditCost: 10,
    tags: ["romantic", "cozy"],
  },
  {
    id: "minimalist-modern",
    title: "Minimalist Modern",
    category: "Minimalist",
    orientation: "portrait",
    previewUrl:
      "https://images.unsplash.com/photo-1513885535751-8b9238bd345d?q=80&w=900",
    prompt:
      "Transform this into a minimalist modern Christmas card with clean design, simple elegant decorations, minimal Christmas elements, contemporary style, subtle holiday touches, sophisticated minimalist aesthetic.",
    creditCost: 10,
    tags: ["minimal", "modern"],
  },
  {
    id: "cookies-gathering",
    title: "Cookies Gathering",
    category: "Homey",
    orientation: "landscape",
    previewUrl:
      "https://images.unsplash.com/photo-1512406926044-444d641267ee?q=80&w=1200",
    prompt:
      "Transform this person into a festive cookie baking scene. Place them at a table with Christmas cookies, mugs of hot cocoa, pine cones, warm kitchen lighting, cozy family atmosphere, professional Christmas photography style.",
    creditCost: 10,
    tags: ["kitchen", "family", "homey"],
  },
  {
    id: "religious-nativity",
    title: "Nativity Scene",
    category: "Religious",
    orientation: "portrait",
    previewUrl:
      "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
    prompt:
      "Transform this into a peaceful religious Christmas scene with nativity elements, soft divine lighting, reverent atmosphere, traditional religious Christmas card style.",
    creditCost: 12,
    tags: ["religious", "peaceful"],
  },
];

export default function GeneratorPage() {
  const user = useBootstrapUser();
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewBefore, setPreviewBefore] = useState<string | null>(null);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<Id<"jobs"> | null>(null);

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createJob = useMutation(api.jobs.create);
  const userCredits = useQuery(api.credits.getUserCredits);
  const jobs = useQuery(api.jobs.list) || [];

  const categories = [
    "All",
    "Classic",
    "Cozy",
    "Snowy",
    "Romantic",
    "Religious",
    "Minimalist",
    "Homey",
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

  useEffect(() => {
    if (uploadedFile) {
      const url = URL.createObjectURL(uploadedFile);
      setPreviewBefore(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewBefore(null);
    }
  }, [uploadedFile]);

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

  // Handle file upload
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large. Maximum 10MB.");
        return;
      }
      setUploadedFile(file);
      toast.success("Photo uploaded! Now select a template.");
    }
  };

  // Handle drag and drop
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large. Maximum 10MB.");
        return;
      }
      setUploadedFile(file);
      toast.success("Photo uploaded! Now select a template.");
    }
  };

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
    if (!uploadedFile) {
      toast.error("Please upload a photo.");
      return;
    }

    const template = TEMPLATES.find((t) => t.id === selectedTemplate);
    if (!template) return;

    if ((userCredits || 0) < template.creditCost) {
      toast.error(`Not enough credits. Need ${template.creditCost} credits.`);
      return;
    }

    setIsGenerating(true);
    setCurrentJobId(null);
    setPreviewAfter(null);

    try {
      // Upload file
      const uploadUrl = await generateUploadUrl();
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": uploadedFile.type },
        body: uploadedFile,
      });
      const { storageId } = await uploadResponse.json();

      // Build final prompt with custom instructions
      let finalPrompt = template.prompt;
      if (customInstructions.trim()) {
        finalPrompt += ` Additional instructions: ${customInstructions.trim()}`;
      }

      // Create job
      const jobId = await createJob({
        type: "card",
        prompt: finalPrompt,
        inputFileId: storageId,
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
          onChange={handleFileSelect}
          className="hidden"
        />
        <h2 className="text-xl font-semibold mb-2">
          {uploadedFile ? `✅ ${uploadedFile.name}` : "Drag & drop"}
        </h2>
        <p className="text-[#c1c8d8]">
          {uploadedFile
            ? "Click to change photo"
            : "or click to upload your reference family photo"}
        </p>
        <p className="mt-4 text-sm text-[#c1c8d8]">
          {uploadedFile && !selectedTemplate
            ? "Now select your desired template below ⬇️"
            : ""}
        </p>
      </section>

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
      <div className="mx-auto grid max-w-5xl grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 px-4 pb-8">
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

      {/* Custom instructions + Generate */}
      <div className="mx-auto max-w-3xl mb-8 px-4">
        <div className="rounded-2xl border border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.08)] backdrop-blur-md px-4 py-3 shadow-[0_12px_34px_rgba(0,0,0,.45)] flex flex-col gap-3">
          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="Optional: Add custom instructions (e.g., 'add Santa hat', 'make background snowy', etc.)"
            className="w-full rounded-xl bg-[rgba(255,255,255,.1)] border border-[rgba(255,255,255,.2)] p-3 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976]"
            rows={3}
            disabled={isGenerating}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                void handleGenerate();
              }}
              disabled={isGenerating || !uploadedFile || !selectedTemplate}
              className="rounded-xl px-5 py-2 font-semibold text-[#1e1e1e] border border-transparent bg-[linear-gradient(135deg,#ff4d4d,#ff9866,#ffd976)] hover:brightness-110 active:scale-[.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      </div>

      {/* Before/After labels */}
      <div className="mx-auto mt-4 w-[92%] max-w-5xl grid grid-cols-2 gap-6 text-center font-bold text-[#c1c8d8]">
        <span>Before</span>
        <span>After</span>
      </div>

      {/* Before/After panels */}
      <div className="mx-auto mt-2 w-[92%] max-w-5xl grid grid-cols-1 sm:grid-cols-2 gap-6 px-4 pb-28">
        <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.06)] p-5 text-[#c1c8d8] shadow-[0_8px_26px_rgba(0,0,0,.45)] overflow-hidden">
          {previewBefore ? (
            <img
              src={previewBefore}
              alt="Before"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          ) : (
            <span>No image uploaded</span>
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
              <a
                href={previewAfter}
                download
                className="absolute bottom-4 right-4 bg-[#ffd976] text-[#1e1e1e] px-4 py-2 rounded-lg font-semibold hover:brightness-110 transition"
              >
                Download
              </a>
            </>
          ) : (
            <span>No image generated yet</span>
          )}
        </div>
      </div>
    </div>
  );
}
