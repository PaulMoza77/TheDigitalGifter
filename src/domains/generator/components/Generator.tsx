import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTemplatesQuery, useUserCreditsQuery, useJobsQuery } from "@/data";
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
  GENERATOR_LOOKS,
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
  templateMatchesLook,
  type GeneratorLookId,
} from "@/domains/generator/components/generatorUtils";
import { GENERATOR_SOURCE_BUCKET, aspectLabel } from "../../../../supabase/functions/_shared/higgsfieldImage";

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
  const [resultContentType, setResultContentType] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const [personalizedName, setPersonalizedName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("9:16");
  const [showMoreSizes, setShowMoreSizes] = useState(false);
  const [lookId, setLookId] = useState<GeneratorLookId>("for_you");
  const [showFilters, setShowFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replacePhotosRef = useRef(false);
  const generatingLockRef = useRef(false);

  const pollingRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);

  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("image");

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

    list = list.filter((template) => templateMatchesLook(template, lookId));

    return list;
  }, [categoryFilteredTemplates, lookId, selectedOccasion, selectedStyle]);

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
          .select("id, status, final_image_url, result_image_url, preview_image_url, error, metadata")
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
          const meta = (generation as GenerationRow & { metadata?: { result_content_type?: string } }).metadata;
          setResultContentType(meta?.result_content_type || null);
          setPreviewAfter(imageUrl);
          setIsGenerating(false);
          generatingLockRef.current = false;
          setCurrentGenerationId(null);
          refreshCredits();
          toast.success("Your creation is ready");
          return;
        }

        if (generation.status === "failed" || generation.status === "error") {
          stopGenerationPolling();
          setIsGenerating(false);
          generatingLockRef.current = false;
          setCurrentGenerationId(null);
          refreshCredits();
          toast.error(generation.error || "Generation is temporarily unavailable. Please try again shortly.");
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

  const addPhotos = useCallback((files: File[], replace: boolean) => {
    const accepted = new Set(["image/jpeg", "image/png", "image/webp"]);
    const valid = files.filter((file) => {
      if (!accepted.has(file.type)) {
        toast.error("Use a JPG, PNG, or WEBP photo.");
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Maximum 10MB.`);
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;
    setUploadedFiles((prev) => {
      const next = replace ? valid : [...prev, ...valid];
      if (next.length > 4) toast.error("You can add up to 4 photos. Extra photos were not added.");
      return next.slice(0, 4);
    });
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const replace = replacePhotosRef.current;
    replacePhotosRef.current = false;
    if (files.length > 0) addPhotos(files, replace);
    event.target.value = "";
  }, [addPhotos]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addPhotos(Array.from(event.dataTransfer.files), false);
  }, [addPhotos]);

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
    sourcePaths: string[];
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
      aspect_ratio: input.aspectRatio,
      user_instructions: customInstructions.trim() || null,
      personalized_name: personalizedName.trim() || null,
      source_storage_bucket: GENERATOR_SOURCE_BUCKET,
      source_storage_paths: input.sourcePaths,
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
        source_image_url: null,
        preview_image_url: null,
        prompt: "Personalized image",
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

    if (res.status === 202 || edgeData.status === "processing") {
      return generationId;
    }

    if (!res.ok) {
      throw new Error(
        safeString(edgeData.error || edgeData.message) ||
          "Generation is temporarily unavailable. Please try again shortly."
      );
    }

    if (edgeData.imageUrl && isHttpUrl(edgeData.imageUrl)) {
      setResultContentType(safeString(edgeData.contentType) || null);
      setPreviewAfter(edgeData.imageUrl);
      setCurrentGenerationId(null);
      setIsGenerating(false);
      generatingLockRef.current = false;
      refreshCredits();
      toast.success("Your creation is ready");
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

      toast.error(
        `You need ${requiredCredits} credit${requiredCredits === 1 ? "" : "s"} to generate. You have ${userCredits ?? 0}.`
      );

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

    if (generatingLockRef.current) return;
    generatingLockRef.current = true;
    setIsGenerating(true);
    setCurrentGenerationId(null);
    setPreviewAfter(null);
    setResultContentType(null);
    stopGenerationPolling();

    try {
      if (String(template.type || "image").toLowerCase() === "video") {
        throw new Error("Choose an image style.");
      }
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const ownerId = safeString(authUser?.id || (user as { id?: string }).id);
      if (!ownerId) throw new Error("No authenticated user found.");

      const sourcePaths = await Promise.all(
        uploadedFiles.slice(0, 4).map(async (file, index) => {
          const uploaded = await uploadFileToStorage(file, {
            bucket: GENERATOR_SOURCE_BUCKET,
            folder: ownerId,
            upsert: false,
            makePublicUrl: false,
          });
          if (!uploaded.path.startsWith(`${ownerId}/`)) {
            throw new Error("Could not save your photo.");
          }
          return uploaded.path || `${ownerId}/photo-${index}`;
        }),
      );

      const styleImageUrl = getTemplateImageUrl(template);
      if (!styleImageUrl || !isHttpUrl(styleImageUrl)) {
        throw new Error("Selected template has no valid preview image.");
      }

      await createGenerationAndRun({
        template,
        sourcePaths,
        aspectRatio: selectedAspectRatio,
      });
    } catch (error: unknown) {
      console.error("[handleGenerate] error", error);
      setIsGenerating(false);
      generatingLockRef.current = false;
      refreshCredits();
      const message = error instanceof Error ? error.message : "Failed to generate.";
      toast.error(message);
      if (/not enough credits/i.test(message)) {
        openFunnel({
          mode: "insufficient_credits",
          required: Number(template.creditCost ?? 1),
          available: userCredits ?? 0,
        });
      }
    }
    // createGenerationAndRun is recreated each render and already closed over here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    refreshCredits,
    selectedAspectRatio,
  ]);

  useEffect(() => {
    if (!currentGenerationId || !isGenerating) return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const { url: supabaseUrl, anon } = getPublicSupabaseConfig();
          const headers = await getEdgeFunctionHeaders(anon);
          const res = await fetch(`${supabaseUrl}/functions/v1/generate-nano-banana`, {
            method: "POST",
            headers,
            body: JSON.stringify({ generation_id: currentGenerationId }),
          });
          const edgeData = await safeReadJson(res);
          if (edgeData.imageUrl && isHttpUrl(edgeData.imageUrl)) {
            setResultContentType(safeString(edgeData.contentType) || null);
            setPreviewAfter(edgeData.imageUrl);
            setIsGenerating(false);
            generatingLockRef.current = false;
            setCurrentGenerationId(null);
            refreshCredits();
            toast.success("Your creation is ready");
            return;
          }
          if (!res.ok && res.status !== 202) {
            setIsGenerating(false);
            generatingLockRef.current = false;
            refreshCredits();
            toast.error(
              safeString(edgeData.error || edgeData.message) ||
                "Generation is temporarily unavailable. Please try again shortly.",
            );
          }
        } catch {
          setIsGenerating(false);
          generatingLockRef.current = false;
          toast.error("Generation is temporarily unavailable. Please try again shortly.");
        }
      })();
    }, 6000);
    return () => window.clearInterval(timer);
  }, [currentGenerationId, isGenerating, refreshCredits]);

  const photoCountLabel = uploadedFiles.length === 1 ? "1 photo" : `${uploadedFiles.length} photos`;
  const styleLabel = safeString(selectedTemplateObj?.title) || "Style";
  const summary = selectedTemplateObj
    ? `${photoCountLabel} · ${styleLabel} · ${aspectLabel(selectedAspectRatio)}`
    : "";
  const creditCost = selectedTemplateObj ? Number(selectedTemplateObj.creditCost ?? 1) : null;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--tdg-home-bg)] pb-4 text-[var(--tdg-home-text)]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFileSelect}
        aria-label="Select a photo"
        className="hidden"
      />
      {lookId === "christmas" ? <SnowBackground /> : null}

      <UploadSection
        uploadedFilesLength={uploadedFiles.length}
        onDrop={handleDrop}
        inputRef={fileInputRef}
      />

      <UploadedPreviewStrip
        previewUrls={previewUrls}
        onRemoveFile={handleRemoveFile}
        onReplace={() => {
          replacePhotosRef.current = true;
          fileInputRef.current?.click();
        }}
        onRemoveAll={() => setUploadedFiles([])}
      />

      <section className="mx-auto mt-8 w-full max-w-5xl px-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl text-[var(--tdg-home-text)]">Choose a look</h2>
            <p className="text-sm text-[var(--tdg-home-text-muted)]">Pick a style, then create.</p>
          </div>
          <button
            type="button"
            className="min-h-11 text-sm font-semibold text-[var(--tdg-home-accent)]"
            onClick={() => setShowFilters((open) => !open)}
          >
            Filters
          </button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {GENERATOR_LOOKS.map((look) => (
            <button
              key={look.id}
              type="button"
              onClick={() => setLookId(look.id)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${
                lookId === look.id
                  ? "bg-[var(--tdg-home-accent)] text-[#1a1208]"
                  : "border border-[var(--tdg-home-border)]"
              }`}
            >
              {look.label}
            </button>
          ))}
        </div>
      </section>

      {showFilters ? (
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
      ) : null}

      <TemplatesGrid
        filteredTemplates={filteredTemplates}
        selectedTemplateId={selectedTemplateId}
        onTemplateSelect={handleTemplateSelect}
        onOpenModal={() => undefined}
      />

      <BeforeAfterPreview
        previewAfter={previewAfter}
        resultContentType={resultContentType}
        isGenerating={isGenerating}
        hasPhoto={uploadedFiles.length > 0}
        hasStyle={Boolean(selectedTemplateId)}
        selectedTemplateObj={selectedTemplateObj}
        creditCost={creditCost}
        onDownload={(url, filename) => {
          void handleDownload(url, filename);
        }}
        onTryAnotherStyle={() => {
          setPreviewAfter(null);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("template");
            return next;
          });
        }}
        onCreateAnother={() => {
          setPreviewAfter(null);
          setUploadedFiles([]);
          setResultContentType(null);
        }}
        onRegenerate={() => void handleGenerate()}
      />

      <GenerationBar
        canGenerate={Boolean(selectedTemplateId && uploadedFiles.length > 0)}
        isGenerating={isGenerating}
        creditCost={creditCost}
        summary={summary}
        customInstructions={customInstructions}
        setCustomInstructions={setCustomInstructions}
        personalizedName={personalizedName}
        setPersonalizedName={setPersonalizedName}
        showName={normalizeKey(selectedTemplateObj?.occasion) === "name_cards"}
        selectedAspectRatio={selectedAspectRatio}
        setSelectedAspectRatio={setSelectedAspectRatio}
        showMoreSizes={showMoreSizes}
        setShowMoreSizes={setShowMoreSizes}
        onGenerate={() => void handleGenerate()}
      />
    </div>
  );
}