import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import VideoModal from "@/components/VideoModal";
import { useTemplatesQuery, useUserCreditsQuery, useJobsQuery } from "@/data";
import { useCreateVideoJobMutation } from "@/data";
import { useCreditsFunnel } from "@/contexts/CreditsFunnelContext";
import { useBootstrapUser } from "@/hooks/useBootstrapUser";
import { uploadFileToStorage } from "@/lib/uploadFileToStorage";
import { supabase } from "@/lib/supabase";

import SnowBackground from "@/domains/generator/components/SnowBackground";
import UploadSection from "@/domains/generator/components/UploadSection";
import UploadedPreviewStrip from "@/domains/generator/components/UploadedPreviewStrip";
import GeneratorFilters from "@/domains/generator/components/GeneratorFilters";
import TemplatesGrid from "@/domains/generator/components/TemplatesGrid";
import BeforeAfterPreview from "@/domains/generator/components/BeforeAfterPreview";
import GenerationBar from "@/domains/generator/components/GenerationBar";

import {
  ALL_CATEGORIES,
  ALL_OCCASIONS,
  ALL_STYLES,
  type AnyTemplate,
  type CategoryKey,
  type GenerationRow,
  type JobRow,
} from "@/domains/generator/components/generatorTypes";

import {
  buildPrompt,
  dispatchCreditsRefresh,
  formatLabel,
  getPublicSupabaseConfig,
  getTemplateId,
  getTemplateImageUrl,
  getTemplateMainCategory,
  getTemplateStyleId,
  isHttpUrl,
  normalizeCategory,
  normalizeKey,
  normalizeTemplate,
  safeReadJson,
  safeString,
} from "@/domains/generator/components/generatorUtils";

async function getEdgeFunctionHeaders(anonKey: string): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token?.trim();

  return {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${accessToken || anonKey}`,
  };
}

export default function GeneratorPage() {
  const user = useBootstrapUser();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedTemplateId = searchParams.get("template") || null;
  const selectedCategoryParam = normalizeCategory(searchParams.get("category"));
  const selectedOccasionParam = normalizeKey(searchParams.get("occasion"));
  const selectedStyleParam = normalizeKey(searchParams.get("style"));

  const selectedCategory = selectedCategoryParam;

  const selectedOccasion =
    selectedOccasionParam && selectedOccasionParam !== ALL_OCCASIONS
      ? selectedOccasionParam
      : ALL_OCCASIONS;

  const selectedStyle =
    selectedStyleParam && selectedStyleParam !== ALL_STYLES
      ? selectedStyleParam
      : ALL_STYLES;

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const [personalizedName, setPersonalizedName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("match_input_image");

  const pollingRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);

  const [modal, setModal] = useState({
    open: false,
    src: "",
    title: "",
  });

  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("all");
  const [generateAudio, setGenerateAudio] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("English");

  const { data: templates = [] } = useTemplatesQuery();

  const templatesList = useMemo(
    () =>
      (templates as AnyTemplate[])
        .map((template) => normalizeTemplate(template))
        .filter((template) => getTemplateId(template)),
    [templates]
  );

  const { data: creditsData = 0 } = useUserCreditsQuery();
  const userCredits = Number(creditsData ?? 0);

  const { data: jobsRaw = [] } = useJobsQuery();
  const jobs = (jobsRaw as JobRow[]) || [];

  const { mutateAsync: triggerCreateVideoJob } = useCreateVideoJobMutation();
  const { openFunnel } = useCreditsFunnel();

  const categoryFilteredTemplates = useMemo(() => {
    if (selectedCategory === ALL_CATEGORIES) return templatesList;

    return templatesList.filter((template) => {
      return getTemplateMainCategory(template) === selectedCategory;
    });
  }, [templatesList, selectedCategory]);

  const occasionOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; count: number }>();

    categoryFilteredTemplates.forEach((template) => {
      const key = normalizeKey(template.occasion || "other");
      if (!key) return;

      const existing = map.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          value: key,
          label: formatLabel(template.occasion || "Other"),
          count: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [categoryFilteredTemplates]);

  const styleOptions = useMemo(() => {
    if (selectedOccasion === ALL_OCCASIONS) return [];

    const source = categoryFilteredTemplates.filter((template) => {
      return normalizeKey(template.occasion) === selectedOccasion;
    });

    const map = new Map<string, { value: string; label: string; count: number }>();

    source.forEach((template) => {
      const styleRaw = safeString(
        (template as any).style_id ||
          (template as any).styleId ||
          template.category ||
          "general"
      );

      const key = normalizeKey(styleRaw || "general");
      if (!key) return;

      const existing = map.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          value: key,
          label: formatLabel(styleRaw || "General"),
          count: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [categoryFilteredTemplates, selectedOccasion]);

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

  const selectedCategoryLabel =
    selectedCategory === "all" ? "All" : formatLabel(selectedCategory);

  const selectedOccasionLabel =
    selectedOccasion === ALL_OCCASIONS
      ? "All Occasions"
      : occasionOptions.find((item) => item.value === selectedOccasion)?.label ||
        formatLabel(selectedOccasion);

  const selectedStyleLabel =
    selectedStyle === ALL_STYLES
      ? "All Styles"
      : styleOptions.find((item) => item.value === selectedStyle)?.label ||
        formatLabel(selectedStyle);

  const updateFilterParams = useCallback(
    (updates: {
      category?: CategoryKey;
      occasion?: string;
      style?: string;
      type?: "all" | "image" | "video";
    }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);

          if (updates.category !== undefined) {
            if (updates.category === ALL_CATEGORIES) next.delete("category");
            else next.set("category", updates.category);

            next.delete("occasion");
            next.delete("style");
            next.delete("template");
          }

          if (updates.occasion !== undefined) {
            if (updates.occasion === ALL_OCCASIONS) next.delete("occasion");
            else next.set("occasion", updates.occasion);

            next.delete("style");
            next.delete("template");
          }

          if (updates.style !== undefined) {
            if (updates.style === ALL_STYLES) next.delete("style");
            else next.set("style", updates.style);

            next.delete("template");
          }

          return next;
        },
        { replace: true }
      );

      if (updates.type) setTypeFilter(updates.type);
    },
    [setSearchParams]
  );

  const refreshCredits = useCallback(() => {
    dispatchCreditsRefresh();

    void queryClient.invalidateQueries({ queryKey: ["userCredits"] });
    void queryClient.invalidateQueries({ queryKey: ["credits"] });
    void queryClient.invalidateQueries({ queryKey: ["user-credits"] });
    void queryClient.invalidateQueries({ queryKey: ["userCreditsQuery"] });

    void queryClient.refetchQueries({ queryKey: ["userCredits"] });
    void queryClient.refetchQueries({ queryKey: ["credits"] });
    void queryClient.refetchQueries({ queryKey: ["user-credits"] });
    void queryClient.refetchQueries({ queryKey: ["userCreditsQuery"] });
  }, [queryClient]);

  const filteredTemplates = useMemo(() => {
    let list = categoryFilteredTemplates;

    if (selectedOccasion !== ALL_OCCASIONS) {
      list = list.filter((template) => normalizeKey(template.occasion) === selectedOccasion);
    }

    if (selectedStyle !== ALL_STYLES) {
      list = list.filter((template) => {
        const templateStyle = normalizeKey(
          (template as any).style_id ||
            (template as any).styleId ||
            template.category ||
            "general"
        );

        return templateStyle === selectedStyle;
      });
    }

    if (typeFilter !== "all") {
      list = list.filter((template) => String(template.type || "").toLowerCase() === typeFilter);
    }

    return list;
  }, [categoryFilteredTemplates, typeFilter, selectedOccasion, selectedStyle]);

  const templateMap = useMemo(() => {
    const lookup = new Map<string, AnyTemplate>();

    templatesList.forEach((template) => {
      const id = getTemplateId(template);
      lookup.set(id, normalizeTemplate(template));
    });

    return lookup;
  }, [templatesList]);

  const selectedTemplateObj = selectedTemplateId
    ? templateMap.get(selectedTemplateId) ?? null
    : null;

  const currentJob = useMemo(() => {
    if (!currentJobId) return null;
    return jobs.find((job) => job.id === currentJobId) ?? null;
  }, [jobs, currentJobId]);

  const stopGenerationPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    isPollingRef.current = false;
  }, []);

  const checkGenerationStatus = useCallback(
    async (generationId: string) => {
      if (isPollingRef.current) return;

      isPollingRef.current = true;

      try {
        const { data, error } = await supabase
          .from("generations")
          .select("id, status, final_image_url, result_image_url, preview_image_url, error")
          .eq("id", generationId)
          .maybeSingle();

        if (error) {
          console.error("[generations poll] error", error);
          return;
        }

        if (!data) {
          console.warn("[generations poll] generation not found yet", generationId);
          return;
        }

        const generation = data as GenerationRow;
        const imageUrl =
          generation.final_image_url ||
          generation.result_image_url ||
          generation.preview_image_url ||
          null;

        if (generation.status === "completed" && imageUrl) {
          stopGenerationPolling();
          setPreviewAfter(imageUrl);
          setIsGenerating(false);
          setCurrentGenerationId(null);
          refreshCredits();
          toast.success("Your card is ready!");
          return;
        }

        if (generation.status === "failed" || generation.status === "error") {
          stopGenerationPolling();
          setIsGenerating(false);
          setCurrentGenerationId(null);
          refreshCredits();
          toast.error(generation.error || "Failed to generate. Please try again.");
        }
      } finally {
        isPollingRef.current = false;
      }
    },
    [stopGenerationPolling, refreshCredits]
  );

  useEffect(() => {
    if (!currentGenerationId) {
      stopGenerationPolling();
      return;
    }

    void checkGenerationStatus(currentGenerationId);

    pollingRef.current = window.setInterval(() => {
      void checkGenerationStatus(currentGenerationId);
    }, 2500);

    return () => {
      stopGenerationPolling();
    };
  }, [currentGenerationId, checkGenerationStatus, stopGenerationPolling]);

  useEffect(() => {
    const urls = uploadedFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [uploadedFiles]);

  useEffect(() => {
    if (!currentJob) return;
    if (currentJob.type !== "video") return;

    if (currentJob.status === "done" && currentJob.result_url) {
      setPreviewAfter(currentJob.result_url);
      setIsGenerating(false);
      refreshCredits();
      toast.success("Your video is ready!");
    } else if (currentJob.status === "error") {
      setIsGenerating(false);
      refreshCredits();
      toast.error(currentJob.error_message || "Failed to generate. Please try again.");
    }
  }, [currentJob, refreshCredits]);

  const handleTemplateSelect = useCallback(
    (template: AnyTemplate) => {
      const id = getTemplateId(template);

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);

          if (next.get("template") === id) {
            next.delete("template");
            toast.success(`Deselected: ${template.title}`);
          } else {
            next.set("template", id);

            const occasion = normalizeKey(template.occasion);
            const style = normalizeKey(
              (template as any).style_id ||
                (template as any).styleId ||
                template.category ||
                "general"
            );
            const category = getTemplateMainCategory(template);

            if (category !== "all") next.set("category", category);
            if (occasion) next.set("occasion", occasion);
            if (style) next.set("style", style);

            toast.success(`Selected: ${template.title}`);
          }

          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const valid = files.filter((file) => {
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

    if (valid.length > 0) {
      setUploadedFiles((prev) => [...prev, ...valid]);
      toast.success(`${valid.length} photo(s) uploaded!`);
    }

    event.target.value = "";
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const files = Array.from(event.dataTransfer.files).filter((file) =>
      file.type.startsWith("image/")
    );

    const valid = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Maximum 10MB.`);
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
    if (!url) {
      toast.error("No file to download");
      return;
    }

    try {
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
    } catch (err) {
      console.error("Download failed:", err);
      window.open(url, "_blank");
    }
  }, []);

  async function createGenerationAndRun(input: {
    template: AnyTemplate;
    sourceImageUrl: string;
    styleImageUrl: string;
    prompt: string;
    aspectRatio: string;
  }) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const effectiveUserId = safeString(authUser?.id || (user as any)?.id) || null;
    const effectiveEmail = safeString(authUser?.email || (user as any)?.email) || null;

    const templateId = getTemplateId(input.template);
    const styleId = getTemplateStyleId(input.template);

    const metadata = {
      source: "tdg_generator_page",
      template_id: templateId,
      style_id: styleId,
      template_title: safeString(input.template.title),
      template_prompt: safeString((input.template as any).prompt),
      style_image_url: input.styleImageUrl,
      source_image_url: input.sourceImageUrl,
      aspect_ratio: input.aspectRatio,
      user_id: effectiveUserId,
      email: effectiveEmail,
      category: getTemplateMainCategory(input.template),
    };

    const { data: created, error: createError } = await supabase
      .from("generations")
      .insert({
        user_id: effectiveUserId,
        email: effectiveEmail,
        occasion_slug: safeString(input.template.occasion) || null,
        style_slug: styleId || null,
        style_id: styleId || null,
        template_id: templateId || null,
        title: safeString(input.template.title) || "tdg_generation",
        source_image_url: input.sourceImageUrl,
        preview_image_url: input.sourceImageUrl,
        prompt: input.prompt,
        status: "pending",
        metadata,
      })
      .select("id")
      .single();

    if (createError || !created?.id) {
      throw new Error(createError?.message || "Failed to create generation.");
    }

    const generationId = String(created.id);
    setCurrentGenerationId(generationId);

    const { url: supabaseUrl, anon } = getPublicSupabaseConfig();
    const headers = await getEdgeFunctionHeaders(anon);

    const res = await fetch(`${supabaseUrl}/functions/v1/generate-nano-banana`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        generation_id: generationId,
      }),
    });

    const edgeData = await safeReadJson(res);

    if (!res.ok) {
      throw new Error(
        safeString(edgeData.error || edgeData.message) ||
          `Edge Function returned a non-2xx status code (${res.status})`
      );
    }

    if (edgeData.imageUrl && isHttpUrl(edgeData.imageUrl)) {
      setPreviewAfter(edgeData.imageUrl);
      setCurrentGenerationId(null);
      setIsGenerating(false);
      refreshCredits();
      toast.success("Your card is ready!");
    }

    return generationId;
  }

  const handleGenerate = useCallback(async () => {
    if (!user) {
      toast.error("No authenticated user found.");
      openFunnel({ mode: "not_logged_in" });
      return;
    }

    if (!selectedTemplateId) {
      toast.error("Please select a template.");
      return;
    }

    if (uploadedFiles.length === 0) {
      toast.error("Please upload at least one photo.");
      return;
    }

    const template = templateMap.get(selectedTemplateId);

    if (!template) {
      toast.error("Template not found. Please pick another option.");
      return;
    }

    if (normalizeKey(template.occasion) === "name_cards" && !personalizedName.trim()) {
      toast.error("Please add the name you want on the card.");
      return;
    }

    const requiredCredits = Number((template as any).creditCost ?? 1);

    if ((userCredits ?? 0) < requiredCredits) {
      const hasGeneratedBefore = jobs.length > 0;

      if (!hasGeneratedBefore && (userCredits ?? 0) === 0) {
        openFunnel({ mode: "first_generation" });
      } else {
        openFunnel({
          mode: "insufficient_credits",
          required: requiredCredits,
          available: userCredits ?? 0,
        });
      }

      return;
    }

    document.getElementById("preview-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    setIsGenerating(true);
    setCurrentJobId(null);
    setCurrentGenerationId(null);
    setPreviewAfter(null);
    stopGenerationPolling();

    try {
      const isVideo = String(template.type || "image").toLowerCase() === "video";

      if (isVideo && uploadedFiles.length > 3) {
        toast.error("You can upload up to 3 photos for video generation.");
        setIsGenerating(false);
        return;
      }

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
          templateId: getTemplateId(template),
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
        refreshCredits();
        toast.success("Video generation started!");
        return;
      }

      const sourceImageUrl = inputUrls[0];
      const styleImageUrl = getTemplateImageUrl(template);

      if (!sourceImageUrl || !isHttpUrl(sourceImageUrl)) {
        throw new Error("Uploaded image URL is invalid.");
      }

      if (!styleImageUrl || !isHttpUrl(styleImageUrl)) {
        throw new Error("Selected template has no valid public image URL.");
      }

      const prompt = buildPrompt({
        template,
        customInstructions,
        personalizedName,
      });

      const generationId = await createGenerationAndRun({
        template,
        sourceImageUrl,
        styleImageUrl,
        prompt,
        aspectRatio: selectedAspectRatio,
      });

      setCurrentGenerationId(generationId);
      refreshCredits();
      toast.success("Generation started!");
    } catch (error: any) {
      console.error("[handleGenerate] error", error);
      setIsGenerating(false);
      refreshCredits();
      toast.error(error?.message ?? "Failed to generate.");
    }
  }, [
    user,
    selectedTemplateId,
    uploadedFiles,
    templateMap,
    personalizedName,
    userCredits,
    jobs,
    openFunnel,
    stopGenerationPolling,
    customInstructions,
    negativePrompt,
    selectedLanguage,
    triggerCreateVideoJob,
    generateAudio,
    refreshCredits,
    selectedAspectRatio,
  ]);

  return (
    <div className="relative min-h-screen overflow-x-hidden text-[#f6f8ff]">
      <SnowBackground />

      <UploadSection
        uploadedFilesLength={uploadedFiles.length}
        hasSelectedTemplate={!!selectedTemplateId}
        onDrop={handleDrop}
        onFileSelect={handleFileSelect}
      />

      {modal.open && (
        <VideoModal
          src={modal.src}
          title={modal.title}
          onClose={() => setModal({ open: false, src: "", title: "" })}
        />
      )}

      <UploadedPreviewStrip
        previewUrls={previewUrls}
        onRemoveFile={handleRemoveFile}
      />

      <GeneratorFilters
        selectedCategory={selectedCategory}
        selectedOccasion={selectedOccasion}
        selectedStyle={selectedStyle}
        selectedCategoryLabel={selectedCategoryLabel}
        selectedOccasionLabel={selectedOccasionLabel}
        selectedStyleLabel={selectedStyleLabel}
        filteredTemplatesLength={filteredTemplates.length}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        occasionOptions={occasionOptions}
        styleOptions={styleOptions}
        updateFilterParams={updateFilterParams}
      />

      <TemplatesGrid
        filteredTemplates={filteredTemplates}
        selectedTemplateId={selectedTemplateId}
        onTemplateSelect={handleTemplateSelect}
        onOpenModal={(src, title) => setModal({ open: true, src, title: title || "" })}
      />

      <BeforeAfterPreview
        previewUrls={previewUrls}
        previewAfter={previewAfter}
        isGenerating={isGenerating}
        currentJob={currentJob}
        selectedTemplateObj={selectedTemplateObj}
        onDownload={handleDownload}
      />

      <GenerationBar
        selectedTemplateObj={selectedTemplateObj}
        selectedTemplateId={selectedTemplateId}
        uploadedFilesLength={uploadedFiles.length}
        isGenerating={isGenerating}
        customInstructions={customInstructions}
        setCustomInstructions={setCustomInstructions}
        personalizedName={personalizedName}
        setPersonalizedName={setPersonalizedName}
        negativePrompt={negativePrompt}
        setNegativePrompt={setNegativePrompt}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        generateAudio={generateAudio}
        setGenerateAudio={setGenerateAudio}
        selectedAspectRatio={selectedAspectRatio}
        setSelectedAspectRatio={setSelectedAspectRatio}
        aspectRatioOptions={aspectRatioOptions}
        onGenerate={() => void handleGenerate()}
      />
    </div>
  );
}