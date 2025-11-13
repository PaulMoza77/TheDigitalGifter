import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Doc, Id } from "../../convex/_generated/dataModel";
import TemplatesGrid from "./TemplatesGrid";
import { uploadFileToStorage } from "../lib/uploadFileToStorage";
import { getErrorMessage } from "../lib/getErrorMessage";

export function TemplateJobCreator() {
  const [selectedTemplate, setSelectedTemplate] =
    useState<Doc<"templates"> | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [customText, setCustomText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<Id<"jobs"> | null>(null);

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createFromTemplate = useMutation(api.templates.createFromTemplate);
  const credits = useQuery(api.credits.getUserCredits);
  const jobs = useQuery(api.jobs.list) || [];

  // Watch for current job status updates
  const currentJob = currentJobId
    ? jobs.find((j) => j._id === currentJobId)
    : null;

  // Monitor job status changes
  useEffect(() => {
    if (!currentJob) return;

    if (currentJob.status === "done" && currentJob.resultUrl) {
      setIsUploading(false);
      toast.success("🎄 Your Christmas card is ready!");
    } else if (currentJob.status === "error") {
      setIsUploading(false);
      const errorMsg =
        currentJob.errorMessage ||
        "Failed to create card. Credits have been refunded.";
      toast.error(errorMsg);
    } else if (currentJob.status === "processing") {
      toast.info("🎨 AI is creating your Christmas card...");
    }
  }, [currentJob]);

  const hasEnoughCredits = selectedTemplate
    ? (credits || 0) >= selectedTemplate.creditCost
    : true;

  const handleTemplateSelect = (template: Doc<"templates">) => {
    setSelectedTemplate(template);
    setCustomText(template.textDefault); // Pre-fill with default text
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTemplate || !selectedFile) {
      toast.error("Please select a template and upload a photo");
      return;
    }

    if (!hasEnoughCredits) {
      toast.error(
        `You need ${selectedTemplate.creditCost} credits to create this Christmas card. Please purchase more credits.`
      );
      return;
    }

    setIsUploading(true);

    try {
      const storageId = await uploadFileToStorage(
        generateUploadUrl,
        selectedFile
      );

      // Build enhanced prompt with custom text
      let enhancedPrompt = additionalPrompt.trim();
      if (customText.trim()) {
        enhancedPrompt += ` Include text: "${customText.trim()}"`;
      }

      // Create job from template
      const result = await createFromTemplate({
        templateId: selectedTemplate._id,
        inputFileId: storageId,
        additionalPrompt: enhancedPrompt || undefined,
      });

      // Extract jobId from result if available, otherwise find it from jobs list
      if (result.jobId) {
        setCurrentJobId(result.jobId);
      }

      toast.success(
        `🎄 Christmas card creation started! Template: ${result.template}`
      );

      // Reset form (but keep template selected for status monitoring)
      setSelectedFile(null);
      setAdditionalPrompt("");
      setCustomText("");
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Failed to create Christmas card."
      );
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        🎄 Create Christmas Card from Template
      </h3>

      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="space-y-6"
      >
        {/* Template Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Choose a Christmas Template
          </label>
          <TemplatesGrid
            onPick={handleTemplateSelect}
            selectedTemplateId={selectedTemplate?._id}
          />
        </div>

        {/* Selected Template Info */}
        {selectedTemplate && (
          <div className="bg-gradient-to-r from-red-50 to-green-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <img
                src={selectedTemplate.previewUrl}
                alt={selectedTemplate.title}
                className="w-20 h-16 object-cover rounded-lg border-2 border-red-200"
              />
              <div className="flex-1">
                <h4 className="font-medium text-red-800 mb-1">
                  {selectedTemplate.title}
                </h4>
                <p className="text-sm text-red-700 mb-2">
                  {selectedTemplate.prompt}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-600 font-medium">
                    💳 {selectedTemplate.creditCost} credits
                  </span>
                  <span className="text-gray-600">
                    📐 {selectedTemplate.orientation}
                  </span>
                </div>
                <div className="flex gap-1 mt-2">
                  {selectedTemplate.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {!hasEnoughCredits && (
              <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                ⚠️ You need {selectedTemplate.creditCost - (credits || 0)} more
                credits to create this card.
              </div>
            )}
          </div>
        )}

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Your Photo *
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
            required
          />
          {selectedFile && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <span>📷 Selected: {selectedFile.name}</span>
              <span className="text-gray-400">
                ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
              </span>
            </div>
          )}
        </div>

        {/* Custom Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Text
          </label>
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Enter your Christmas message..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            maxLength={50}
          />
          <p className="text-xs text-gray-500 mt-1">
            {customText.length}/50 characters
          </p>
        </div>

        {/* Additional Prompt */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Instructions (Optional)
          </label>
          <textarea
            value={additionalPrompt}
            onChange={(e) => setAdditionalPrompt(e.target.value)}
            placeholder="Any specific requests or modifications to the template..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            rows={3}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={
            !selectedTemplate ||
            !selectedFile ||
            isUploading ||
            !hasEnoughCredits
          }
          className="w-full bg-gradient-to-r from-red-600 to-green-600 text-white py-3 px-4 rounded-md hover:from-red-700 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isUploading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              🎄 Creating Christmas Magic...
            </div>
          ) : !hasEnoughCredits && selectedTemplate ? (
            `💳 Need ${selectedTemplate.creditCost - (credits || 0)} More Credits`
          ) : (
            `🎁 Create Christmas Card ${selectedTemplate ? `(${selectedTemplate.creditCost} credits)` : ""}`
          )}
        </button>
      </form>

      {/* Tips */}
      <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-green-800 mb-2">
          💡 Tips for Best Results
        </h4>
        <ul className="text-xs text-green-700 space-y-1">
          <li>• Use high-quality photos with clear faces</li>
          <li>• Portrait orientation works best for family photos</li>
          <li>• Keep custom text short and festive</li>
          <li>• Processing takes 30-60 seconds</li>
        </ul>
      </div>
    </div>
  );
}
