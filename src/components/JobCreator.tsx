import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { uploadFileToStorage } from "../lib/uploadFileToStorage";
import { Id } from "../../convex/_generated/dataModel";
import { getErrorMessage } from "../lib/getErrorMessage";

type ContentType = "image" | "video" | "card";

// Credit costs for each content type
const CREDIT_COSTS: Record<ContentType, number> = {
  image: 6,
  video: 12,
  card: 10,
};

export function JobCreator() {
  const [contentType, setContentType] = useState<ContentType>("image");
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<Id<"jobs"> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createJob = useMutation(api.jobs.create);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
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
      setIsSubmitting(false);
      toast.success("Content generated successfully!");
    } else if (currentJob.status === "error") {
      setIsSubmitting(false);
      const errorMsg =
        currentJob.errorMessage ||
        "Failed to generate content. Credits have been refunded.";
      toast.error(errorMsg);
    } else if (currentJob.status === "processing") {
      toast.info("Generating your content...");
    }
  }, [currentJob]);

  const requiredCredits = CREDIT_COSTS[contentType];
  const hasEnoughCredits = (credits || 0) >= requiredCredits;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    if (!hasEnoughCredits) {
      toast.error(
        `You need ${requiredCredits} credits to create ${contentType} content. Please purchase more credits.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      let inputFileId;

      const file = fileInputRef.current?.files?.[0];
      if (file) {
        inputFileId = await uploadFileToStorage(generateUploadUrl, file);
      }

      const jobId = await createJob({
        type: contentType,
        prompt: prompt.trim(),
        inputFileId,
      });

      setCurrentJobId(jobId);
      toast.success("Job created! AI generation started...");
      setPrompt("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Failed to create job. Please try again."
      );
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content Type
          </label>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value as ContentType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="image">
              AI Image ({CREDIT_COSTS.image} credits)
            </option>
            <option value="video">
              AI Video ({CREDIT_COSTS.video} credits) - Coming Soon
            </option>
            <option value="card">
              Greeting Card ({CREDIT_COSTS.card} credits)
            </option>
          </select>

          {/* Credit status indicator */}
          <div className="mt-2 text-sm">
            <span className="text-gray-600">
              You have{" "}
              <span className="font-medium text-purple-600">
                {credits || 0}
              </span>{" "}
              credits
            </span>
            {!hasEnoughCredits && (
              <span className="text-red-600 ml-2">
                (Need {requiredCredits - (credits || 0)} more)
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to create..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reference Image (Optional)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !prompt.trim() || !hasEnoughCredits}
          className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting
            ? "Creating..."
            : !hasEnoughCredits
              ? `Need ${requiredCredits} Credits`
              : `Create Content (${requiredCredits} credits)`}
        </button>
      </form>
    </div>
  );
}
