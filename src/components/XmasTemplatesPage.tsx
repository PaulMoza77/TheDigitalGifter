import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Doc } from "../../convex/_generated/dataModel";
import TemplatesGrid from "./TemplatesGrid";

export default function XmasTemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<Doc<"templates"> | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createFromTemplate = useMutation(api.templates.createFromTemplate);
  const credits = useQuery(api.credits.getUserCredits);
  const templates = useQuery(api.templates.list) || [];

  const hasEnoughCredits = selectedTemplate ? (credits || 0) >= selectedTemplate.creditCost : true;

  const onPick = (template: Doc<"templates">) => {
    setSelectedTemplate(template);
    // Scroll to the form section
    document.getElementById('template-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTemplate || !selectedFile) {
      toast.error("Please select a template and upload a photo");
      return;
    }

    if (!hasEnoughCredits) {
      toast.error(`You need ${selectedTemplate.creditCost} credits to create this Christmas card. Please purchase more credits.`);
      return;
    }

    setIsUploading(true);

    try {
      // Upload the file
      const uploadUrl = await generateUploadUrl();
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedFile.type },
        body: selectedFile,
      });

      if (!uploadResult.ok) {
        throw new Error("Failed to upload file");
      }

      const { storageId } = await uploadResult.json();

      // Create job from template
      const result = await createFromTemplate({
        templateId: selectedTemplate._id,
        inputFileId: storageId,
        additionalPrompt: additionalPrompt.trim() || undefined,
      });

      toast.success(`Christmas card creation started! Template: ${result.template}`);
      
      // Reset form
      setSelectedTemplate(null);
      setSelectedFile(null);
      setAdditionalPrompt("");
      
    } catch (error) {
      console.error("Error creating template job:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create Christmas card");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-green-50 to-red-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-red-600 mb-2">
              🎄 Christmas Card Templates
            </h1>
            <p className="text-lg text-gray-600">
              Choose from {templates.length} magical Christmas templates to create your perfect holiday card
            </p>
            <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-500">
              <span>💳 You have <strong className="text-green-600">{credits || 0}</strong> credits</span>
              <span>•</span>
              <span>🎨 Templates from 10-20 credits</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Templates Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Select Your Template
          </h2>
          <TemplatesGrid 
            onPick={onPick}
            selectedTemplateId={selectedTemplate?._id}
          />
        </div>

        {/* Selected Template Form */}
        {selectedTemplate && (
          <div id="template-form" className="bg-white rounded-lg shadow-lg border p-6">
            <div className="flex items-start gap-4 mb-6">
              <img
                src={selectedTemplate.previewUrl}
                alt={selectedTemplate.title}
                className="w-24 h-18 object-cover rounded-lg border-2 border-red-200"
              />
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {selectedTemplate.title}
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {selectedTemplate.prompt}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-red-600 font-medium">
                    {selectedTemplate.creditCost} credits
                  </span>
                  <div className="flex gap-1">
                    {selectedTemplate.tags.map((tag) => (
                      <span key={tag} className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {!hasEnoughCredits && (
                  <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                    ⚠️ You need {selectedTemplate.creditCost - (credits || 0)} more credits to create this card.
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: {selectedFile.name}
                  </p>
                )}
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

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Change Template
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || isUploading || !hasEnoughCredits}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isUploading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Creating Christmas Card...
                    </div>
                  ) : !hasEnoughCredits ? (
                    `Need ${selectedTemplate.creditCost - (credits || 0)} More Credits`
                  ) : (
                    `Create Christmas Card (${selectedTemplate.creditCost} credits)`
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-3">
            🎁 How to Create Your Christmas Card
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-green-700">
            <div className="flex items-start gap-2">
              <span className="bg-green-200 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="font-medium">Choose Template</p>
                <p>Browse and select your favorite Christmas scene</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-green-200 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="font-medium">Upload Photo</p>
                <p>Add your family photo or portrait</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-green-200 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="font-medium">Create Magic</p>
                <p>AI will blend your photo into the Christmas scene</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
