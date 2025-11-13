import React, { useState, useEffect } from "react";
import UploadCard from "./UploadCard";
import PreviewCard from "./PreviewCard";
import TemplateSelector from "./TemplateSelector";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useBootstrapUser } from "../hooks/useBootstrapUser";
import { uploadFileToStorage } from "../lib/uploadFileToStorage";
import { getErrorMessage } from "../lib/getErrorMessage";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";

// Template styles with descriptive prompts for AI image transformation
const TEMPLATE_STYLES = [
  {
    id: "classic",
    title: "Classic",
    prompt:
      "Transform this into a classic Christmas card scene with traditional red and gold decorations, warm lighting, elegant holiday atmosphere, festive Christmas tree in background, cozy winter setting, professional Christmas card style",
  },
  {
    id: "snowy",
    title: "Snowy",
    prompt:
      "Transform this into a snowy winter wonderland Christmas scene with falling snow, winter landscape, snow-covered trees, peaceful winter atmosphere, soft winter lighting, magical snowy Christmas card",
  },
  {
    id: "romantic",
    title: "Romantic",
    prompt:
      "Transform this into a romantic Christmas scene with soft candlelight, warm intimate atmosphere, elegant decorations, romantic winter evening, cozy fireplace setting, beautiful romantic Christmas card style",
  },
  {
    id: "minimalist",
    title: "Minimalist",
    prompt:
      "Transform this into a minimalist modern Christmas card with clean design, simple elegant decorations, minimal Christmas elements, contemporary style, subtle holiday touches, sophisticated minimalist aesthetic",
  },
];

export default function GeneratorPage() {
  const user = useBootstrapUser();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewBefore, setPreviewBefore] = useState<string | null>(null);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<Id<"jobs"> | null>(null);
  const sendJob = useMutation(api.jobs.create);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const jobs = useQuery(api.jobs.list) || [];
  const [error, setError] = useState<string | null>(null);

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
        currentJob.errorMessage ||
        "Failed to generate card. Credits have been refunded.";
      toast.error(errorMsg);
      setError(errorMsg);
    } else if (currentJob.status === "processing") {
      toast.info("🎨 AI is creating your Christmas card...");
    }
  }, [currentJob]);

  async function handleGenerate() {
    if (!user) {
      setError("You must be signed in to generate.");
      return;
    }
    if (!selectedTemplate) {
      setError("Please select a template style.");
      return;
    }
    if (!uploadedFile) {
      setError("Please upload a photo.");
      return;
    }
    setError(null);
    setIsGenerating(true);
    setCurrentJobId(null);
    try {
      const fileId = await uploadFileToStorage(generateUploadUrl, uploadedFile);

      // Find the selected template to get its descriptive prompt
      const template = TEMPLATE_STYLES.find((t) => t.id === selectedTemplate);
      if (!template) {
        throw new Error("Template not found");
      }

      const jobId = await sendJob({
        type: "card",
        prompt: template.prompt, // Use descriptive prompt instead of just template ID
        inputFileId: fileId,
      });

      setCurrentJobId(jobId);
      toast.success("Job created! AI generation started...");
    } catch (error) {
      const message = getErrorMessage(error, "Failed to generate card.");
      toast.error(message);
      setError(message);
      setIsGenerating(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <UploadCard onFileSelected={setUploadedFile} />
      <TemplateSelector
        templates={TEMPLATE_STYLES}
        selectedTemplateId={selectedTemplate}
        onSelectTemplate={setSelectedTemplate}
      />
      <div className="flex justify-center mt-6">
        <button
          onClick={() => {
            void handleGenerate();
          }}
          disabled={isGenerating}
          className="btn-festive px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 disabled:opacity-50"
        >
          {isGenerating ? "Generating..." : "Generate"}
        </button>
      </div>
      {error && <p className="text-red-600 mt-4 text-center">{error}</p>}
      <PreviewCard beforeImage={previewBefore} afterImage={previewAfter} />
    </div>
  );
}
