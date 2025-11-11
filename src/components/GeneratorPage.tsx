import React, { useState, useEffect } from "react";
import { Id } from "../../convex/_generated/dataModel";
import UploadCard from "./UploadCard";
import PreviewCard from "./PreviewCard";
import TemplateSelector from "./TemplateSelector";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useBootstrapUser } from "../hooks/useBootstrapUser";




// Note: You need to create the `uploadFile` action in convex/storage.ts to handle this upload.


const TEMPLATE_STYLES = [
  { id: "classic", title: "Classic" },
  { id: "snowy", title: "Snowy" },
  { id: "romantic", title: "Romantic" },
  { id: "minimalist", title: "Minimalist" },
];

export default function GeneratorPage() {
  const user = useBootstrapUser();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewBefore, setPreviewBefore] = useState<string | null>(null);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const sendJob = useMutation(api.jobs.create);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (uploadedFile) {
      const url = URL.createObjectURL(uploadedFile);
      setPreviewBefore(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewBefore(null);
    }
  }, [uploadedFile]);

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
    try {
      // Here you would upload the file to storage and then call the mutation with the file id and template
      // For now, simulate a delay and set a dummy after preview
      await new Promise((r) => setTimeout(r, 3000));
      setPreviewAfter(previewBefore); // For demo, just show the same image
      // Call sendJob mutation with actual data
      const uploadFileToStorage = async (file: File): Promise<Id<"_storage">> => {
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const uploadUrl = await generateUploadUrl();
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error("Failed to upload file");
  }
  const { storageId } = await response.json();
  return storageId;
};

const fileId = await uploadFileToStorage(uploadedFile);
      await sendJob({
        type: "card",
        prompt: selectedTemplate,
        inputFileId: fileId,
      });
    } catch (e) {
      setError("Failed to generate card.");
    } finally {
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
          onClick={handleGenerate}
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
