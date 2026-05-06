import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

import {
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  Save,
  Sparkles,
  GripVertical,
  Eye,
  EyeOff,
  CalendarDays,
  Heart,
  Cross,
  PawPrint,
  LayoutGrid,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MainCategory = "occasions" | "personal" | "spiritual" | "pets";

type TemplateDbRow = {
  id: string;
  title: string | null;
  prompt: string | null;
  occasion: string | null;
  category: string | null;
  main_category: MainCategory | null;
  style_id: string | null;
  isactive: boolean | null;
  is_active: boolean | null;
  preview_url: string | null;
  previewurl: string | null;
  thumbnail_url: string | null;
  thumbnailurl: string | null;
  preview_image_url: string | null;
  created_at: string | null;
};

type OccasionCollectionRow = {
  id: string;
  slug: string;
  title: string;
  main_category: MainCategory;
  label: string | null;
  description: string | null;
  image_url: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  sort_order: number;
  is_active: boolean;
  is_trending: boolean;
  created_at: string;
  updated_at: string;
};

type OccasionGroup = {
  id: string;
  slug: string;
  title: string;
  label: string;
  description: string | null;
  mainCategory: MainCategory;
  sortOrder: number;
  isActive: boolean;
  isTrending: boolean;
  total: number;
  active: number;
  inactive: number;
  previewUrl: string | null;
};

const MAIN_CATEGORIES: Array<{
  key: MainCategory;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    key: "occasions",
    label: "Occasions",
    description: "Birthdays, holidays, weddings",
    icon: CalendarDays,
  },
  {
    key: "personal",
    label: "Personal",
    description: "Names, kids, love, apologies",
    icon: Heart,
  },
  {
    key: "spiritual",
    label: "Spiritual",
    description: "Faith, prayer, encouragement",
    icon: Cross,
  },
  {
    key: "pets",
    label: "Pets",
    description: "Dogs, cats, pet memories",
    icon: PawPrint,
  },
];

function norm(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeSlug(value: unknown) {
  const raw = norm(value).toLowerCase();

  if (!raw) return "";

  if (raw === "newborn" || raw === "new-born" || raw === "new_born") {
    return "new_born";
  }

  if (raw === "valentines-day") return "valentines_day";
  if (raw === "mothers-day") return "mothers_day";
  if (raw === "fathers-day") return "fathers_day";
  if (raw === "new-years-eve") return "new_years_eve";
  if (raw === "baby-reveal") return "baby_reveal";
  if (raw === "thank-you") return "thank_you";
  if (raw === "name-cards") return "name_cards";
  if (raw === "bible-verses") return "bible_verses";
  if (raw === "pet-loss") return "pet_loss";

  return raw
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeMainCategory(value: unknown): MainCategory {
  const raw = norm(value).toLowerCase();

  if (raw === "personal") return "personal";
  if (raw === "spiritual") return "spiritual";
  if (raw === "pets") return "pets";

  return "occasions";
}

function formatLabel(value: unknown) {
  const raw = norm(value);

  if (!raw) return "";

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bNew Years Eve\b/g, "New Year’s Eve")
    .replace(/\bValentines Day\b/g, "Valentine’s Day")
    .replace(/\bMothers Day\b/g, "Mother’s Day")
    .replace(/\bFathers Day\b/g, "Father’s Day");
}

function labelForMainCategory(category: MainCategory) {
  return MAIN_CATEGORIES.find((item) => item.key === category)?.label ?? category;
}

function makeStyleIdFromTitle(title: string) {
  return norm(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function getTemplatePreviewUrl(row: TemplateDbRow) {
  return (
    row.preview_url ||
    row.previewurl ||
    row.thumbnail_url ||
    row.thumbnailurl ||
    row.preview_image_url ||
    null
  );
}

function extractInvokeErrorMessage(err: any) {
  const status = err?.context?.status ?? err?.status;
  const body = err?.context?.body ?? err?.body;

  let bodyMsg = "";

  if (typeof body === "string") bodyMsg = body;
  else if (body?.error) bodyMsg = String(body.error);
  else if (body?.message) bodyMsg = String(body.message);

  const msg = bodyMsg || err?.message || "Request failed";
  return `${status ? `(${status}) ` : ""}${msg}`;
}

export default function AdminFunnelPage() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateDbRow[]>([]);
  const [collections, setCollections] = useState<OccasionCollectionRow[]>([]);

  const [boardSearch, setBoardSearch] = useState("");
  const [draggedSlug, setDraggedSlug] = useState<string | null>(null);
  const [savingCollectionSlug, setSavingCollectionSlug] = useState<string | null>(
    null
  );

  const [selectedSlug, setSelectedSlug] = useState<string>("new_born");
  const [styleSearch, setStyleSearch] = useState("");

  const [styleDialogOpen, setStyleDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);

  const [savingStyle, setSavingStyle] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  const [editingStyle, setEditingStyle] = useState<TemplateDbRow | null>(null);
  const [editingCollection, setEditingCollection] =
    useState<OccasionCollectionRow | null>(null);

  const [styleForm, setStyleForm] = useState({
    occasion: "new_born",
    main_category: "occasions" as MainCategory,
    title: "",
    style_id: "",
    prompt: "",
    isactive: true,
    ai_notes: "",
  });

  const [collectionForm, setCollectionForm] = useState({
    slug: "",
    title: "",
    main_category: "occasions" as MainCategory,
    label: "",
    description: "",
    image_url: "",
    gradient_from: "from-[#020617]",
    gradient_to: "to-[#1d4ed8]",
    sort_order: 999,
    is_active: true,
    is_trending: false,
  });

  async function load() {
    setLoading(true);

    try {
      const [templatesResult, collectionsResult] = await Promise.all([
        supabase
          .from("templates")
          .select(
            [
              "id",
              "title",
              "prompt",
              "occasion",
              "category",
              "main_category",
              "style_id",
              "isactive",
              "is_active",
              "preview_url",
              "previewurl",
              "thumbnail_url",
              "thumbnailurl",
              "preview_image_url",
              "created_at",
            ].join(",")
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("occasion_collections")
          .select(
            [
              "id",
              "slug",
              "title",
              "main_category",
              "label",
              "description",
              "image_url",
              "gradient_from",
              "gradient_to",
              "sort_order",
              "is_active",
              "is_trending",
              "created_at",
              "updated_at",
            ].join(",")
          )
          .order("main_category", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("title", { ascending: true }),
      ]);

      if (templatesResult.error) {
        throw templatesResult.error;
      }

      if (collectionsResult.error) {
        throw collectionsResult.error;
      }

      const nextTemplates = (templatesResult.data ?? []) as unknown as TemplateDbRow[];
      const nextCollections = (collectionsResult.data ??
        []) as unknown as OccasionCollectionRow[];

      setTemplates(nextTemplates);
      setCollections(nextCollections);

      if (nextCollections.length > 0) {
        const currentExists = nextCollections.some(
          (item) => normalizeSlug(item.slug) === normalizeSlug(selectedSlug)
        );

        if (!currentExists) {
          setSelectedSlug(normalizeSlug(nextCollections[0].slug));
        }
      }
    } catch (error: any) {
      console.error("[AdminFunnelPage] load error:", error);
      toast.error(error?.message || "Failed to load admin funnel data");
      setTemplates([]);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const templateStatsBySlug = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        active: number;
        inactive: number;
        previewUrl: string | null;
      }
    >();

    templates.forEach((template) => {
      const slug = normalizeSlug(template.occasion);
      if (!slug) return;

      const isActive = template.is_active ?? template.isactive ?? true;
      const previewUrl = getTemplatePreviewUrl(template);

      const existing = map.get(slug);

      if (existing) {
        existing.total += 1;
        existing.active += isActive ? 1 : 0;
        existing.inactive += isActive ? 0 : 1;

        if (!existing.previewUrl && previewUrl) {
          existing.previewUrl = previewUrl;
        }

        return;
      }

      map.set(slug, {
        total: 1,
        active: isActive ? 1 : 0,
        inactive: isActive ? 0 : 1,
        previewUrl,
      });
    });

    return map;
  }, [templates]);

  const groupedCollections = useMemo(() => {
    return collections
      .map<OccasionGroup>((collection) => {
        const slug = normalizeSlug(collection.slug);
        const stats = templateStatsBySlug.get(slug);

        return {
          id: collection.id,
          slug,
          title: collection.title,
          label: collection.label || collection.title,
          description: collection.description,
          mainCategory: normalizeMainCategory(collection.main_category),
          sortOrder: collection.sort_order ?? 999,
          isActive: collection.is_active !== false,
          isTrending: collection.is_trending === true,
          total: stats?.total ?? 0,
          active: stats?.active ?? 0,
          inactive: stats?.inactive ?? 0,
          previewUrl: collection.image_url || stats?.previewUrl || null,
        };
      })
      .filter((item) => item.slug)
      .sort((a, b) => {
        if (a.mainCategory !== b.mainCategory) {
          return a.mainCategory.localeCompare(b.mainCategory);
        }

        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }

        return a.title.localeCompare(b.title);
      });
  }, [collections, templateStatsBySlug]);

  const boardFilteredCollections = useMemo(() => {
    const search = boardSearch.trim().toLowerCase();

    if (!search) return groupedCollections;

    return groupedCollections.filter((item) => {
      return (
        item.title.toLowerCase().includes(search) ||
        item.label.toLowerCase().includes(search) ||
        item.slug.toLowerCase().includes(search) ||
        item.mainCategory.toLowerCase().includes(search)
      );
    });
  }, [groupedCollections, boardSearch]);

  const collectionsByCategory = useMemo(() => {
    const grouped: Record<MainCategory, OccasionGroup[]> = {
      occasions: [],
      personal: [],
      spiritual: [],
      pets: [],
    };

    boardFilteredCollections.forEach((item) => {
      grouped[item.mainCategory].push(item);
    });

    return grouped;
  }, [boardFilteredCollections]);

  const dashboardStats = useMemo(() => {
    const totalTemplates = templates.length;
    const activeTemplates = templates.filter(
      (row) => row.is_active ?? row.isactive ?? true
    ).length;

    return {
      totalCollections: groupedCollections.length,
      totalTemplates,
      activeTemplates,
      inactiveTemplates: totalTemplates - activeTemplates,
    };
  }, [groupedCollections.length, templates]);

  const collectionOptions = useMemo(() => {
    return groupedCollections.map((item) => ({
      value: item.slug,
      label: item.title,
      mainCategory: item.mainCategory,
    }));
  }, [groupedCollections]);

  const selectedCollection = useMemo(() => {
    return groupedCollections.find((item) => item.slug === selectedSlug) ?? null;
  }, [groupedCollections, selectedSlug]);

  const filteredStyles = useMemo(() => {
    const search = styleSearch.trim().toLowerCase();

    return templates.filter((row) => {
      const slug = normalizeSlug(row.occasion);
      if (slug !== selectedSlug) return false;

      if (!search) return true;

      const hay = `${row.title ?? ""} ${row.style_id ?? ""} ${
        row.prompt ?? ""
      } ${row.category ?? ""}`.toLowerCase();

      return hay.includes(search);
    });
  }, [templates, selectedSlug, styleSearch]);

  const selectedStyleStats = useMemo(() => {
    const stats = templateStatsBySlug.get(selectedSlug);

    return {
      total: stats?.total ?? 0,
      active: stats?.active ?? 0,
      inactive: stats?.inactive ?? 0,
    };
  }, [templateStatsBySlug, selectedSlug]);

  function getMainCategoryForSlug(slugValue: string): MainCategory {
    const slug = normalizeSlug(slugValue);

    const collection = groupedCollections.find((item) => item.slug === slug);

    return collection?.mainCategory ?? "occasions";
  }

  function openCreateCollection(category: MainCategory = "occasions") {
    setEditingCollection(null);

    setCollectionForm({
      slug: "",
      title: "",
      main_category: category,
      label: "",
      description: "",
      image_url: "",
      gradient_from: "from-[#020617]",
      gradient_to: "to-[#1d4ed8]",
      sort_order: 999,
      is_active: true,
      is_trending: false,
    });

    setCollectionDialogOpen(true);
  }

  function openEditCollection(slugValue: string) {
    const slug = normalizeSlug(slugValue);
    const collection = collections.find(
      (item) => normalizeSlug(item.slug) === slug
    );

    if (!collection) {
      toast.error("Collection not found");
      return;
    }

    setEditingCollection(collection);

    setCollectionForm({
      slug: collection.slug,
      title: collection.title,
      main_category: normalizeMainCategory(collection.main_category),
      label: collection.label || "",
      description: collection.description || "",
      image_url: collection.image_url || "",
      gradient_from: collection.gradient_from || "from-[#020617]",
      gradient_to: collection.gradient_to || "to-[#1d4ed8]",
      sort_order: collection.sort_order ?? 999,
      is_active: collection.is_active !== false,
      is_trending: collection.is_trending === true,
    });

    setCollectionDialogOpen(true);
  }

  function openCreateStyle() {
    setEditingStyle(null);

    setStyleForm({
      occasion: selectedSlug,
      main_category: getMainCategoryForSlug(selectedSlug),
      title: "",
      style_id: "",
      prompt: "",
      isactive: true,
      ai_notes: "",
    });

    setStyleDialogOpen(true);
  }

  function openEditStyle(row: TemplateDbRow) {
    const slug = normalizeSlug(row.occasion ?? selectedSlug);

    setEditingStyle(row);

    setStyleForm({
      occasion: slug,
      main_category: normalizeMainCategory(
        row.main_category || getMainCategoryForSlug(slug)
      ),
      title: row.title ?? "",
      style_id: row.style_id ?? "",
      prompt: row.prompt ?? "",
      isactive: row.is_active ?? row.isactive ?? true,
      ai_notes: "",
    });

    setStyleDialogOpen(true);
  }

  async function saveCollection() {
    const nextSlug = normalizeSlug(collectionForm.slug || collectionForm.title);
    const nextTitle = norm(collectionForm.title);

    if (!nextSlug) {
      toast.error("Slug is required");
      return;
    }

    if (!nextTitle) {
      toast.error("Title is required");
      return;
    }

    setSavingCollection(true);

    try {
      const payload = {
        slug: nextSlug,
        title: nextTitle,
        main_category: normalizeMainCategory(collectionForm.main_category),
        label: norm(collectionForm.label) || nextTitle,
        description: norm(collectionForm.description) || null,
        image_url: norm(collectionForm.image_url) || null,
        gradient_from: norm(collectionForm.gradient_from) || "from-[#020617]",
        gradient_to: norm(collectionForm.gradient_to) || "to-[#1d4ed8]",
        sort_order: Number(collectionForm.sort_order || 999),
        is_active: !!collectionForm.is_active,
        is_trending: !!collectionForm.is_trending,
      };

      if (editingCollection?.id) {
        const oldSlug = normalizeSlug(editingCollection.slug);

        const { error: updateCollectionError } = await supabase
          .from("occasion_collections")
          .update(payload)
          .eq("id", editingCollection.id);

        if (updateCollectionError) throw updateCollectionError;

        if (oldSlug !== nextSlug) {
          const { error: updateTemplatesSlugError } = await supabase
            .from("templates")
            .update({
              occasion: nextSlug,
              main_category: payload.main_category,
            })
            .eq("occasion", oldSlug);

          if (updateTemplatesSlugError) throw updateTemplatesSlugError;
        } else {
          const { error: updateTemplatesCategoryError } = await supabase
            .from("templates")
            .update({
              main_category: payload.main_category,
            })
            .eq("occasion", nextSlug);

          if (updateTemplatesCategoryError) throw updateTemplatesCategoryError;
        }

        toast.success("Collection updated");
      } else {
        const { error: insertError } = await supabase
          .from("occasion_collections")
          .insert(payload);

        if (insertError) throw insertError;

        toast.success("Collection created");
      }

      setSelectedSlug(nextSlug);
      setCollectionDialogOpen(false);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save collection");
    } finally {
      setSavingCollection(false);
    }
  }

  async function deleteCollection(collection: OccasionGroup) {
    if (collection.total > 0) {
      toast.error("Cannot delete a collection that still has templates.");
      return;
    }

    if (!confirm(`Delete ${collection.title}?`)) return;

    const { error } = await supabase
      .from("occasion_collections")
      .delete()
      .eq("slug", collection.slug);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Collection deleted");
    await load();
  }

  async function moveCollectionToCategory(
    slugValue: string,
    nextCategory: MainCategory
  ) {
    const slug = normalizeSlug(slugValue);

    if (!slug) return;

    setSavingCollectionSlug(slug);

    const previousCollections = collections;
    const previousTemplates = templates;

    setCollections((current) =>
      current.map((item) =>
        normalizeSlug(item.slug) === slug
          ? { ...item, main_category: nextCategory }
          : item
      )
    );

    setTemplates((current) =>
      current.map((item) =>
        normalizeSlug(item.occasion) === slug
          ? { ...item, main_category: nextCategory }
          : item
      )
    );

    try {
      const { error: collectionError } = await supabase
        .from("occasion_collections")
        .update({ main_category: nextCategory })
        .eq("slug", slug);

      if (collectionError) throw collectionError;

      const { error: templatesError } = await supabase
        .from("templates")
        .update({ main_category: nextCategory })
        .eq("occasion", slug);

      if (templatesError) throw templatesError;

      toast.success(
        `${formatLabel(slug)} moved to ${labelForMainCategory(nextCategory)}`
      );
    } catch (error: any) {
      setCollections(previousCollections);
      setTemplates(previousTemplates);
      toast.error(error?.message || "Failed to move collection");
    } finally {
      setSavingCollectionSlug(null);
    }
  }

  async function toggleCollectionActive(slugValue: string, next: boolean) {
    const slug = normalizeSlug(slugValue);

    const previousCollections = collections;

    setCollections((current) =>
      current.map((item) =>
        normalizeSlug(item.slug) === slug ? { ...item, is_active: next } : item
      )
    );

    const { error } = await supabase
      .from("occasion_collections")
      .update({ is_active: next })
      .eq("slug", slug);

    if (error) {
      setCollections(previousCollections);
      toast.error(error.message);
      return;
    }

    toast.success(next ? "Collection visible" : "Collection hidden");
  }

  async function toggleCollectionTrending(slugValue: string, next: boolean) {
    const slug = normalizeSlug(slugValue);

    const previousCollections = collections;

    setCollections((current) =>
      current.map((item) =>
        normalizeSlug(item.slug) === slug
          ? { ...item, is_trending: next }
          : item
      )
    );

    const { error } = await supabase
      .from("occasion_collections")
      .update({ is_trending: next })
      .eq("slug", slug);

    if (error) {
      setCollections(previousCollections);
      toast.error(error.message);
      return;
    }

    toast.success(next ? "Added to trending" : "Removed from trending");
  }

  async function saveStyle() {
    const slug = normalizeSlug(styleForm.occasion);
    const mainCategory = normalizeMainCategory(styleForm.main_category);

    const payload = {
      occasion: slug,
      main_category: mainCategory,
      title: norm(styleForm.title) || null,
      style_id:
        norm(styleForm.style_id) ||
        (norm(styleForm.title) ? makeStyleIdFromTitle(styleForm.title) : null),
      prompt: norm(styleForm.prompt) || null,
      category: "General",
      type: "image",
      isactive: !!styleForm.isactive,
      is_active: !!styleForm.isactive,
      creditcost: 1,
      credit_cost: 1,
      tags: [],
    };

    if (!payload.occasion) {
      toast.error("Collection is required");
      return;
    }

    if (!payload.title) {
      toast.error("Title is required");
      return;
    }

    if (!payload.style_id) {
      toast.error("style_id is required");
      return;
    }

    if (!payload.prompt) {
      toast.error("Prompt is required");
      return;
    }

    setSavingStyle(true);

    try {
      const collectionExists = collections.some(
        (item) => normalizeSlug(item.slug) === slug
      );

      if (!collectionExists) {
        const { error: collectionError } = await supabase
          .from("occasion_collections")
          .insert({
            slug,
            title: formatLabel(slug),
            label: formatLabel(slug),
            main_category: mainCategory,
            description:
              "Create beautiful personalized cards for this collection.",
            sort_order: 999,
            is_active: true,
            is_trending: false,
            gradient_from: "from-[#020617]",
            gradient_to: "to-[#1d4ed8]",
          });

        if (collectionError) throw collectionError;
      }

      if (editingStyle?.id) {
        const { error } = await supabase
          .from("templates")
          .update(payload)
          .eq("id", editingStyle.id);

        if (error) throw error;

        toast.success("Style updated");
      } else {
        const { error } = await supabase.from("templates").insert(payload);

        if (error) throw error;

        toast.success("Style created");
      }

      setSelectedSlug(slug);
      setStyleDialogOpen(false);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save style");
    } finally {
      setSavingStyle(false);
    }
  }

  async function toggleStyleActive(row: TemplateDbRow, next: boolean) {
    const prev = row.is_active ?? row.isactive ?? true;

    setTemplates((current) =>
      current.map((item) =>
        item.id === row.id ? { ...item, isactive: next, is_active: next } : item
      )
    );

    const { error } = await supabase
      .from("templates")
      .update({ isactive: next, is_active: next })
      .eq("id", row.id);

    if (error) {
      setTemplates((current) =>
        current.map((item) =>
          item.id === row.id
            ? { ...item, isactive: prev, is_active: prev }
            : item
        )
      );

      toast.error(error.message);
    }
  }

  async function deleteStyle(row: TemplateDbRow) {
    if (!confirm("Delete this style?")) return;

    const { error } = await supabase.from("templates").delete().eq("id", row.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Style deleted");
    await load();
  }

  async function generateWithAI() {
    const slug = normalizeSlug(styleForm.occasion);
    const notes = norm(styleForm.ai_notes);

    if (!slug) {
      toast.error("Pick a collection first");
      return;
    }

    setAiGenerating(true);

    try {
      const { data: sess, error: sessErr } = await supabase.auth.getSession();

      if (sessErr) {
        toast.error(sessErr.message);
        return;
      }

      const token = sess.session?.access_token;

      if (!token) {
        toast.error("Not authenticated. Please re-login.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("generate-style", {
        body: {
          occasion: slug,
          notes,
          existing_style_ids: templates
            .filter((row) => normalizeSlug(row.occasion) === slug)
            .map((row) => row.style_id)
            .filter(Boolean),
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error) {
        console.error("generate-style invoke error:", error);
        toast.error(extractInvokeErrorMessage(error));
        return;
      }

      const title = norm((data as any)?.title);
      const styleId =
        norm((data as any)?.style_id) ||
        (title ? makeStyleIdFromTitle(title) : "");
      const prompt = norm((data as any)?.prompt);

      if (!title || !prompt) {
        toast.error("AI response invalid. Missing title/prompt.");
        return;
      }

      setStyleForm((state) => ({
        ...state,
        title,
        style_id: styleId || state.style_id,
        prompt,
      }));

      toast.success("Generated");
    } catch (error: any) {
      console.error("generateWithAI exception:", error);
      toast.error(error?.message || "AI generation failed");
    } finally {
      setAiGenerating(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
            Admin Control
          </div>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
            Occasions, Categories & Styles
          </h1>

          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Controlează categoriile principale, colecțiile și stilurile folosite
            în Home, Templates, Generator și Funnel Style Select.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", loading && "animate-spin")}
            />
            Refresh
          </Button>

          <Button
            variant="outline"
            className="rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
            onClick={() => openCreateCollection()}
          >
            <Plus className="mr-2 h-4 w-4" />
            New collection
          </Button>

          <Button className="rounded-xl" onClick={openCreateStyle}>
            <Plus className="mr-2 h-4 w-4" />
            New style
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              Collections
            </CardDescription>
            <CardTitle>{dashboardStats.totalCollections}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              Templates
            </CardDescription>
            <CardTitle>{dashboardStats.totalTemplates}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">Active</CardDescription>
            <CardTitle className="text-emerald-300">
              {dashboardStats.activeTemplates}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              Inactive
            </CardDescription>
            <CardTitle className="text-rose-300">
              {dashboardStats.inactiveTemplates}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutGrid className="h-4 w-4 text-[#ffd976]" />
            Category Board
          </CardTitle>

          <CardDescription className="text-slate-400">
            Drag & drop o colecție între coloane pentru a o muta între
            Occasions, Personal, Spiritual și Pets.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

            <Input
              value={boardSearch}
              onChange={(event) => setBoardSearch(event.target.value)}
              placeholder="Search collection or category..."
              className="rounded-xl border-slate-800 bg-slate-900 pl-9 text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            {MAIN_CATEGORIES.map((column) => {
              const Icon = column.icon;
              const items = collectionsByCategory[column.key];

              return (
                <Card
                  key={column.key}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();

                    const droppedSlug =
                      draggedSlug ||
                      event.dataTransfer.getData("text/plain") ||
                      "";

                    setDraggedSlug(null);

                    if (!droppedSlug) return;

                    void moveCollectionToCategory(droppedSlug, column.key);
                  }}
                  className="min-h-[460px] rounded-2xl border-slate-800 bg-slate-900/40 text-slate-50"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Icon className="h-4 w-4 text-[#ffd976]" />
                          {column.label}
                        </CardTitle>

                        <CardDescription className="mt-1 text-slate-400">
                          {column.description}
                        </CardDescription>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                        onClick={() => openCreateCollection(column.key)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <Badge className="mt-2 w-fit rounded-xl border border-slate-800 bg-slate-950 text-slate-200">
                      {items.length} collections
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {loading ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-400">
                        Loading...
                      </div>
                    ) : items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 p-6 text-center text-sm text-slate-500">
                        Drop collections here
                      </div>
                    ) : (
                      items.map((item) => {
                        const isSaving = savingCollectionSlug === item.slug;

                        return (
                          <div
                            key={item.slug}
                            draggable
                            onDragStart={(event) => {
                              setDraggedSlug(item.slug);
                              event.dataTransfer.setData("text/plain", item.slug);
                              event.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => setDraggedSlug(null)}
                            className={cn(
                              "group cursor-grab rounded-2xl border border-slate-800 bg-slate-950/80 p-3 transition active:cursor-grabbing",
                              "hover:border-slate-700 hover:bg-slate-950",
                              isSaving && "opacity-60"
                            )}
                          >
                            <div className="flex gap-3">
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                                {item.previewUrl ? (
                                  <img
                                    src={item.previewUrl}
                                    alt={item.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Sparkles className="h-5 w-5 text-slate-500" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSlug(item.slug)}
                                    className="min-w-0 text-left"
                                  >
                                    <div className="truncate text-sm font-semibold text-slate-50">
                                      {item.title}
                                    </div>

                                    <div className="truncate text-xs text-slate-500">
                                      {item.slug}
                                    </div>
                                  </button>

                                  <GripVertical className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-slate-300" />
                                </div>

                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <Badge className="rounded-lg border border-slate-800 bg-slate-900 text-[10px] text-slate-300">
                                    {item.total} templates
                                  </Badge>

                                  <Badge className="rounded-lg border border-slate-800 bg-emerald-950/30 text-[10px] text-emerald-200">
                                    {item.active} active
                                  </Badge>

                                  {item.isTrending ? (
                                    <Badge className="rounded-lg border border-amber-500/20 bg-amber-950/30 text-[10px] text-amber-200">
                                      trending
                                    </Badge>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <Separator className="my-3 bg-slate-800" />

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                {item.isActive ? (
                                  <Eye className="h-3.5 w-3.5 text-emerald-300" />
                                ) : (
                                  <EyeOff className="h-3.5 w-3.5 text-rose-300" />
                                )}
                                {item.isActive ? "Visible" : "Hidden"}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void toggleCollectionTrending(
                                      item.slug,
                                      !item.isTrending
                                    )
                                  }
                                  className={cn(
                                    "rounded-lg border px-2 py-1 text-xs transition",
                                    item.isTrending
                                      ? "border-amber-400/30 bg-amber-500/15 text-amber-200"
                                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                                  )}
                                >
                                  <Star className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openEditCollection(item.slug)}
                                  className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>

                                <Switch
                                  checked={item.isActive}
                                  onCheckedChange={(value) =>
                                    void toggleCollectionActive(item.slug, value)
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50 lg:col-span-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Collection & Search</CardTitle>
            <CardDescription className="text-slate-400">
              Alege o colecție și gestionează stilurile/template-urile care apar
              în Style Select.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Collection</Label>

                <Select
                  value={selectedSlug}
                  onValueChange={(value) => setSelectedSlug(normalizeSlug(value))}
                >
                  <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 text-slate-100">
                    <SelectValue placeholder="Select collection" />
                  </SelectTrigger>

                  <SelectContent className="z-50 max-h-[360px] rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
                    {collectionOptions.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                        className="focus:bg-slate-800 focus:text-slate-50 data-[highlighted]:bg-slate-800 data-[highlighted]:text-slate-50"
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Search styles</Label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <Input
                    value={styleSearch}
                    onChange={(event) => setStyleSearch(event.target.value)}
                    placeholder="Search styles..."
                    className="rounded-xl border-slate-800 bg-slate-900 pl-9 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-slate-800" />

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200">
                Collection: {selectedCollection?.title || formatLabel(selectedSlug)}
              </Badge>

              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200">
                Category:{" "}
                {labelForMainCategory(
                  selectedCollection?.mainCategory ||
                    getMainCategoryForSlug(selectedSlug)
                )}
              </Badge>

              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200">
                Total: {selectedStyleStats.total}
              </Badge>

              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-emerald-200">
                Active: {selectedStyleStats.active}
              </Badge>

              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-rose-200">
                Inactive: {selectedStyleStats.inactive}
              </Badge>

              {styleSearch.trim() ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                  onClick={() => setStyleSearch("")}
                >
                  Clear search
                </Button>
              ) : (
                <span className="ml-auto text-xs text-slate-500">
                  Search filters only current collection
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50 lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tip</CardTitle>
            <CardDescription className="text-slate-400">
              Collections se salvează în <b>occasion_collections</b>. Templates
              rămân în <b>templates</b>.
            </CardDescription>
          </CardHeader>

          <CardContent className="text-sm text-slate-300">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <div className="font-medium text-slate-100">Recomandare</div>

              <div className="mt-1 text-slate-400">
                Creează întâi colecția, apoi adaugă templates/stiluri în ea.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Styles</CardTitle>

              <CardDescription className="text-slate-400">
                {selectedCollection?.title || formatLabel(selectedSlug)} •{" "}
                {filteredStyles.length} shown
              </CardDescription>
            </div>

            <Button className="rounded-xl" onClick={openCreateStyle}>
              <Plus className="mr-2 h-4 w-4" />
              New style
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="py-6 text-sm text-slate-400">Loading…</div>
          ) : filteredStyles.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
              <div className="text-sm font-semibold text-slate-100">
                No styles found
              </div>

              <div className="mt-1 text-xs text-slate-400">
                Creează primul style pentru{" "}
                <b>{selectedCollection?.title || formatLabel(selectedSlug)}</b>.
              </div>

              <div className="mt-4">
                <Button className="rounded-xl" onClick={openCreateStyle}>
                  <Plus className="mr-2 h-4 w-4" />
                  New style
                </Button>
              </div>
            </div>
          ) : (
            filteredStyles.map((row) => {
              const isActive = row.is_active ?? row.isactive ?? true;

              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-semibold text-slate-50">
                        {row.title || (
                          <span className="text-slate-500">(no title)</span>
                        )}
                      </div>

                      <Badge className="rounded-xl border border-slate-800 bg-slate-950 text-slate-200">
                        {normalizeSlug(row.occasion)}
                      </Badge>

                      <Badge className="rounded-xl border border-slate-800 bg-slate-950 text-slate-200">
                        {labelForMainCategory(
                          normalizeMainCategory(row.main_category)
                        )}
                      </Badge>

                      <Badge
                        className={cn(
                          "rounded-xl border border-slate-800",
                          isActive
                            ? "bg-emerald-950/40 text-emerald-200"
                            : "bg-rose-950/30 text-rose-200"
                        )}
                      >
                        {isActive ? "active" : "inactive"}
                      </Badge>
                    </div>

                    <div className="truncate text-xs text-slate-400">
                      style_id:{" "}
                      <span className="text-slate-200">
                        {row.style_id ?? "—"}
                      </span>{" "}
                      • id: <span className="text-slate-200">{row.id}</span>
                    </div>

                    <div className="line-clamp-2 text-xs text-slate-400">
                      {row.prompt ?? (
                        <span className="text-slate-500">(no prompt)</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                      <span className="text-xs text-slate-400">Active</span>

                      <Switch
                        checked={isActive}
                        onCheckedChange={(value) =>
                          void toggleStyleActive(row, value)
                        }
                      />
                    </div>

                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                      onClick={() => openEditStyle(row)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>

                    <Button
                      variant="destructive"
                      className="rounded-xl"
                      onClick={() => void deleteStyle(row)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
        <DialogContent className="max-w-3xl rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
          <DialogHeader>
            <DialogTitle>
              {editingCollection ? "Edit collection" : "Create collection"}
            </DialogTitle>

            <DialogDescription className="text-slate-400">
              Colecțiile controlează ce apare în Home, Templates și Generator.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-slate-300">Title</Label>

                <Input
                  value={collectionForm.title}
                  onChange={(event) => {
                    const title = event.target.value;

                    setCollectionForm((state) => ({
                      ...state,
                      title,
                      slug: state.slug || (title ? normalizeSlug(title) : ""),
                      label: state.label || title,
                    }));
                  }}
                  placeholder="Bible Verses"
                  className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Main Category</Label>

                <Select
                  value={collectionForm.main_category}
                  onValueChange={(value) =>
                    setCollectionForm((state) => ({
                      ...state,
                      main_category: normalizeMainCategory(value),
                    }))
                  }
                >
                  <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 text-slate-100">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>

                  <SelectContent className="z-50 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
                    {MAIN_CATEGORIES.map((item) => (
                      <SelectItem
                        key={item.key}
                        value={item.key}
                        className="focus:bg-slate-800 focus:text-slate-50 data-[highlighted]:bg-slate-800 data-[highlighted]:text-slate-50"
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Slug</Label>

                <Input
                  value={collectionForm.slug}
                  onChange={(event) =>
                    setCollectionForm((state) => ({
                      ...state,
                      slug: normalizeSlug(event.target.value),
                    }))
                  }
                  placeholder="bible_verses"
                  className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Label</Label>

                <Input
                  value={collectionForm.label}
                  onChange={(event) =>
                    setCollectionForm((state) => ({
                      ...state,
                      label: event.target.value,
                    }))
                  }
                  placeholder="Faith & hope"
                  className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Description</Label>

              <Textarea
                value={collectionForm.description}
                onChange={(event) =>
                  setCollectionForm((state) => ({
                    ...state,
                    description: event.target.value,
                  }))
                }
                placeholder="Beautiful spiritual cards with meaningful Bible-inspired messages."
                className="min-h-[100px] rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Image URL</Label>

              <Input
                value={collectionForm.image_url}
                onChange={(event) =>
                  setCollectionForm((state) => ({
                    ...state,
                    image_url: event.target.value,
                  }))
                }
                placeholder="https://..."
                className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-slate-300">Gradient From</Label>

                <Input
                  value={collectionForm.gradient_from}
                  onChange={(event) =>
                    setCollectionForm((state) => ({
                      ...state,
                      gradient_from: event.target.value,
                    }))
                  }
                  className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Gradient To</Label>

                <Input
                  value={collectionForm.gradient_to}
                  onChange={(event) =>
                    setCollectionForm((state) => ({
                      ...state,
                      gradient_to: event.target.value,
                    }))
                  }
                  className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Sort Order</Label>

                <Input
                  type="number"
                  value={collectionForm.sort_order}
                  onChange={(event) =>
                    setCollectionForm((state) => ({
                      ...state,
                      sort_order: Number(event.target.value || 999),
                    }))
                  }
                  className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                <span className="text-sm text-slate-200">Visible</span>

                <Switch
                  checked={collectionForm.is_active}
                  onCheckedChange={(value) =>
                    setCollectionForm((state) => ({
                      ...state,
                      is_active: value,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                <span className="text-sm text-slate-200">Trending</span>

                <Switch
                  checked={collectionForm.is_trending}
                  onCheckedChange={(value) =>
                    setCollectionForm((state) => ({
                      ...state,
                      is_trending: value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              {editingCollection ? (
                <Button
                  variant="destructive"
                  className="rounded-xl"
                  onClick={() => {
                    const group = groupedCollections.find(
                      (item) =>
                        normalizeSlug(item.slug) ===
                        normalizeSlug(editingCollection.slug)
                    );

                    if (group) {
                      void deleteCollection(group);
                      setCollectionDialogOpen(false);
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                  onClick={() => setCollectionDialogOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  className="rounded-xl"
                  onClick={() => void saveCollection()}
                  disabled={savingCollection}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {savingCollection ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={styleDialogOpen} onOpenChange={setStyleDialogOpen}>
        <DialogContent className="max-w-3xl rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
          <DialogHeader>
            <DialogTitle>
              {editingStyle ? "Edit style" : "Create style"}
            </DialogTitle>

            <DialogDescription className="text-slate-400">
              Aceste valori se folosesc în FunnelStyleSelect.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-slate-300">Collection</Label>

                <Select
                  value={styleForm.occasion}
                  onValueChange={(value) => {
                    const slug = normalizeSlug(value);

                    setStyleForm((state) => ({
                      ...state,
                      occasion: slug,
                      main_category: getMainCategoryForSlug(slug),
                    }));
                  }}
                >
                  <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 text-slate-100">
                    <SelectValue placeholder="Select collection" />
                  </SelectTrigger>

                  <SelectContent className="z-50 max-h-[360px] rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
                    {collectionOptions.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                        className="focus:bg-slate-800 focus:text-slate-50 data-[highlighted]:bg-slate-800 data-[highlighted]:text-slate-50"
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Main Category</Label>

                <Select
                  value={styleForm.main_category}
                  onValueChange={(value) =>
                    setStyleForm((state) => ({
                      ...state,
                      main_category: normalizeMainCategory(value),
                    }))
                  }
                >
                  <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 text-slate-100">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>

                  <SelectContent className="z-50 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
                    {MAIN_CATEGORIES.map((item) => (
                      <SelectItem
                        key={item.key}
                        value={item.key}
                        className="focus:bg-slate-800 focus:text-slate-50 data-[highlighted]:bg-slate-800 data-[highlighted]:text-slate-50"
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Active</Label>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                  <span className="text-sm text-slate-200">
                    {styleForm.isactive ? "Enabled" : "Disabled"}
                  </span>

                  <Switch
                    checked={!!styleForm.isactive}
                    onCheckedChange={(value) =>
                      setStyleForm((state) => ({
                        ...state,
                        isactive: value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-slate-300">AI notes optional</Label>

                <Input
                  value={styleForm.ai_notes}
                  onChange={(event) =>
                    setStyleForm((state) => ({
                      ...state,
                      ai_notes: event.target.value,
                    }))
                  }
                  placeholder='e.g. "warm golden light, film look, joyful family, premium, clean background"'
                  className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2 sm:col-span-1">
                <Label className="text-slate-300">Generate</Label>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                  onClick={() => void generateWithAI()}
                  disabled={aiGenerating}
                >
                  <Sparkles
                    className={cn(
                      "mr-2 h-4 w-4",
                      aiGenerating && "animate-pulse"
                    )}
                  />
                  {aiGenerating ? "Generating..." : "Generate with AI"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Title</Label>

                <Input
                  value={styleForm.title}
                  onChange={(event) => {
                    const title = event.target.value;

                    setStyleForm((state) => ({
                      ...state,
                      title,
                      style_id:
                        state.style_id ||
                        (title ? makeStyleIdFromTitle(title) : ""),
                    }));
                  }}
                  placeholder="Golden Memory"
                  className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">style_id slug</Label>

                <Input
                  value={styleForm.style_id}
                  onChange={(event) =>
                    setStyleForm((state) => ({
                      ...state,
                      style_id: normalizeSlug(event.target.value),
                    }))
                  }
                  placeholder="golden_memory"
                  className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Prompt</Label>

              <Textarea
                value={styleForm.prompt}
                onChange={(event) =>
                  setStyleForm((state) => ({
                    ...state,
                    prompt: event.target.value,
                  }))
                }
                placeholder="Write the exact prompt here..."
                className={cn(
                  "min-h-[240px] rounded-xl font-mono text-xs",
                  "border border-slate-700 bg-white text-slate-900",
                  "placeholder:text-slate-500",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-0"
                )}
              />

              <div className="text-xs text-slate-500">
                Tip: păstrează prompturile consistente per colecție.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                onClick={() => setStyleDialogOpen(false)}
              >
                Cancel
              </Button>

              <Button
                className="rounded-xl"
                onClick={() => void saveStyle()}
                disabled={savingStyle}
              >
                <Save className="mr-2 h-4 w-4" />
                {savingStyle ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}