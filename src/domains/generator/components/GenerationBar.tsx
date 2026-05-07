import { Info, ImageIcon, Video } from "lucide-react";

import LanguageSelector from "@/components/LanguageSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

import type { AnyTemplate } from "./generatorTypes";
import { normalizeKey } from "./generatorUtils";

type Props = {
  selectedTemplateObj: AnyTemplate | null;
  selectedTemplateId: string | null;
  uploadedFilesLength: number;
  isGenerating: boolean;
  customInstructions: string;
  setCustomInstructions: (value: string) => void;
  personalizedName: string;
  setPersonalizedName: (value: string) => void;
  negativePrompt: string;
  setNegativePrompt: (value: string) => void;
  selectedLanguage: string;
  setSelectedLanguage: (value: string) => void;
  generateAudio: boolean;
  setGenerateAudio: (value: boolean) => void;
  selectedAspectRatio: string;
  setSelectedAspectRatio: (value: string) => void;
  aspectRatioOptions: Array<{ label: string; value: string }>;
  onGenerate: () => void;
};

export default function GenerationBar({
  selectedTemplateObj,
  selectedTemplateId,
  uploadedFilesLength,
  isGenerating,
  customInstructions,
  setCustomInstructions,
  personalizedName,
  setPersonalizedName,
  negativePrompt,
  setNegativePrompt,
  selectedLanguage,
  setSelectedLanguage,
  generateAudio,
  setGenerateAudio,
  selectedAspectRatio,
  setSelectedAspectRatio,
  aspectRatioOptions,
  onGenerate,
}: Props) {
  const isNameCards =
    normalizeKey(selectedTemplateObj?.occasion) === "name_cards";

  return (
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
                    Video generation costs {selectedTemplateObj.creditCost ?? "X"} credits per
                    second. Enabling "With Audio" will double the cost.
                  </span>
                </p>

                <div className="flex flex-col gap-3 md:flex-row">
                  <textarea
                    value={customInstructions}
                    onChange={(event) => setCustomInstructions(event.target.value)}
                    placeholder="Optional: Add custom instructions..."
                    className="max-h-[80px] min-h-[40px] flex-1 resize-none rounded-xl border border-white/15 bg-white/[0.1] p-2.5 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976]"
                    rows={3}
                    disabled={isGenerating}
                  />

                  <textarea
                    value={negativePrompt}
                    onChange={(event) => setNegativePrompt(event.target.value.slice(0, 500))}
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
                        onChange={(event) => setGenerateAudio(event.target.checked)}
                        className="h-4 w-4"
                        disabled={isGenerating}
                      />
                      With Audio
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={onGenerate}
                    disabled={isGenerating || !selectedTemplateId}
                    className="ml-auto h-10 whitespace-nowrap rounded-xl border border-transparent bg-[linear-gradient(135deg,#ff4d4d,#ff9866,#ffd976)] px-5 py-2 font-semibold text-[#1e1e1e] transition hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isGenerating ? "Generating..." : "Generate"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex w-full flex-col items-stretch gap-3 md:flex-row md:items-center">
                {isNameCards ? (
                  <input
                    value={personalizedName}
                    onChange={(event) => setPersonalizedName(event.target.value)}
                    placeholder="Name to include..."
                    disabled={isGenerating}
                    className="min-h-[44px] w-full rounded-xl border border-white/15 bg-white/[0.1] p-2.5 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976] md:max-w-[240px]"
                  />
                ) : null}

                <textarea
                  value={customInstructions}
                  onChange={(event) => setCustomInstructions(event.target.value)}
                  placeholder="Optional: Add custom instructions..."
                  className="max-h-[100px] min-h-[44px] flex-1 resize-none rounded-xl border border-white/15 bg-white/[0.1] p-2.5 text-sm text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976]"
                  rows={1}
                  disabled={isGenerating}
                />

                <div className="flex items-center justify-end gap-3">
                  <Select
                    value={selectedAspectRatio}
                    onValueChange={setSelectedAspectRatio}
                    disabled={isGenerating || uploadedFilesLength === 0 || !selectedTemplateId}
                  >
                    <SelectTrigger className="min-w-[120px] border-white/15 bg-white/[0.1] text-white">
                      <SelectValue placeholder="Aspect ratio" />
                    </SelectTrigger>

                    <SelectContent className="border-white/15 bg-[#0b1220] text-white">
                      {aspectRatioOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <button
                    type="button"
                    onClick={onGenerate}
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
  );
}