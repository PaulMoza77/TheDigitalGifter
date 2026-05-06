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
  created_at: string | null;
};

type OccasionGroup = {
  occasion: string;
  label: string;
  mainCategory: MainCategory;
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

const OCCASIONS: Array<{ key: string; label: string }> = [
  { key: "new_born", label: "Newborn" },
  { key: "birthday", label: "Birthday" },
  { key: "wedding", label: "Wedding" },
  { key: "anniversary", label: "Anniversary" },
  { key: "christmas", label: "Christmas" },
  { key: "valentines_day", label: "Valentine’s Day" },
  { key: "mothers_day", label: "Mother’s Day" },
  { key: "fathers_day", label: "Father’s Day" },
  { key: "graduation", label: "Graduation" },
  { key: "baby_reveal", label: "Baby Reveal" },
  { key: "pregnancy", label: "Pregnancy" },
  { key: "new_years_eve", label: "New Year’s Eve" },
  { key: "thanksgiving", label: "Thanksgiving" },
  { key: "thank_you", label: "Thank You" },
  { key: "sorry", label: "Sorry" },
  { key: "name_cards", label: "Name Cards" },
  { key: "kids", label: "Kids" },
  { key: "bible_verses", label: "Bible Verses" },
  { key: "prayer", label: "Prayer" },
  { key: "dogs", label: "Dogs" },
  { key: "cats", label: "Cats" },
  { key: "pet_loss", label: "Pet Loss" },
];

function norm(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeOccasion(value: unknown) {
  const x = norm(value).toLowerCase();

  if (!x) return "new_born";

  if (x === "newborn" || x === "new-born" || x === "new_born") {
    return "new_born";
  }

  if (x === "valentines-day") return "valentines_day";
  if (x === "mothers-day") return "mothers_day";
  if (x === "fathers-day") return "fathers_day";
  if (x === "new-years-eve") return "new_years_eve";
  if (x === "baby-reveal") return "baby_reveal";
  if (x === "thank-you") return "thank_you";
  if (x === "name-cards") return "name_cards";
  if (x === "bible-verses") return "bible_verses";
  if (x === "pet-loss") return "pet_loss";

  return x.replace(/-/g, "_");
}

function normalizeMainCategory(value: unknown): MainCategory {
  const x = norm(value).toLowerCase();

  if (x === "personal") return "personal";
  if (x === "spiritual") return "spiritual";
  if (x === "pets") return "pets";

  return "occasions";
}

function labelForOccasion(key: string) {
  const normalized = normalizeOccasion(key);

  return (
    OCCASIONS.find((item) => item.key === normalized)?.label ??
    normalized
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
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
  const [rows, setRows] = useState<TemplateDbRow[]>([]);

  const [q, setQ] = useState("");
  const [occasion, setOccasion] = useState<string>("new_born");

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [editing, setEditing] = useState<TemplateDbRow | null>(null);

  const [boardSearch, setBoardSearch] = useState("");
  const [draggedOccasion, setDraggedOccasion] = useState<string | null>(null);
  const [savingOccasion, setSavingOccasion] = useState<string | null>(null);

  const [form, setForm] = useState({
    occasion: "new_born",
    main_category: "occasions" as MainCategory,
    title: "",
    style_id: "",
    prompt: "",
    isactive: true,
    ai_notes: "",
  });

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
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
          "created_at",
        ].join(",")
      )
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as unknown as TemplateDbRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const groupedOccasions = useMemo(() => {
    const map = new Map<string, OccasionGroup>();

    rows.forEach((row) => {
      const normalizedOccasion = normalizeOccasion(row.occasion);

      if (!normalizedOccasion) return;

      const mainCategory = normalizeMainCategory(row.main_category);
      const isActive = row.is_active ?? row.isactive ?? true;
      const previewUrl = row.preview_url || row.previewurl || null;

      const existing = map.get(normalizedOccasion);

      if (existing) {
        existing.total += 1;
        existing.active += isActive ? 1 : 0;
        existing.inactive += isActive ? 0 : 1;

        if (!existing.previewUrl && previewUrl) {
          existing.previewUrl = previewUrl;
        }

        return;
      }

      map.set(normalizedOccasion, {
        occasion: normalizedOccasion,
        label: labelForOccasion(normalizedOccasion),
        mainCategory,
        total: 1,
        active: isActive ? 1 : 0,
        inactive: isActive ? 0 : 1,
        previewUrl,
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [rows]);

  const boardFilteredOccasions = useMemo(() => {
    const search = boardSearch.trim().toLowerCase();

    if (!search) return groupedOccasions;

    return groupedOccasions.filter((item) => {
      return (
        item.label.toLowerCase().includes(search) ||
        item.occasion.toLowerCase().includes(search) ||
        item.mainCategory.toLowerCase().includes(search)
      );
    });
  }, [groupedOccasions, boardSearch]);

  const occasionsByCategory = useMemo(() => {
    const grouped: Record<MainCategory, OccasionGroup[]> = {
      occasions: [],
      personal: [],
      spiritual: [],
      pets: [],
    };

    boardFilteredOccasions.forEach((item) => {
      grouped[item.mainCategory].push(item);
    });

    return grouped;
  }, [boardFilteredOccasions]);

  const dashboardStats = useMemo(() => {
    const totalTemplates = rows.length;
    const activeTemplates = rows.filter(
      (row) => row.is_active ?? row.isactive ?? true
    ).length;

    return {
      totalOccasions: groupedOccasions.length,
      totalTemplates,
      activeTemplates,
      inactiveTemplates: totalTemplates - activeTemplates,
    };
  }, [groupedOccasions.length, rows]);

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    const occ = normalizeOccasion(occasion);

    return (rows ?? []).filter((row) => {
      const rocc = normalizeOccasion(row.occasion ?? "");
      if (rocc !== occ) return false;
      if (!nq) return true;

      const hay = `${row.title ?? ""} ${row.style_id ?? ""} ${
        row.prompt ?? ""
      }`.toLowerCase();

      return hay.includes(nq);
    });
  }, [rows, q, occasion]);

  const stats = useMemo(() => {
    const occ = normalizeOccasion(occasion);
    const inOcc = (rows ?? []).filter(
      (row) => normalizeOccasion(row.occasion ?? "") === occ
    );

    const total = inOcc.length;
    const active = inOcc.filter(
      (row) => row.is_active ?? row.isactive ?? true
    ).length;
    const inactive = total - active;

    return { total, active, inactive };
  }, [rows, occasion]);

  function getMainCategoryForOccasion(occasionKey: string): MainCategory {
    const normalized = normalizeOccasion(occasionKey);

    const found = groupedOccasions.find(
      (item) => item.occasion === normalized
    );

    return found?.mainCategory ?? "occasions";
  }

  function openCreate() {
    setEditing(null);

    const occ = normalizeOccasion(occasion);

    setForm({
      occasion: occ,
      main_category: getMainCategoryForOccasion(occ),
      title: "",
      style_id: "",
      prompt: "",
      isactive: true,
      ai_notes: "",
    });

    setOpen(true);
  }

  function openEdit(row: TemplateDbRow) {
    setEditing(row);

    const occ = normalizeOccasion(row.occasion ?? occasion);

    setForm({
      occasion: occ,
      main_category: normalizeMainCategory(row.main_category),
      title: row.title ?? "",
      style_id: row.style_id ?? "",
      prompt: row.prompt ?? "",
      isactive: row.is_active ?? row.isactive ?? true,
      ai_notes: "",
    });

    setOpen(true);
  }

  async function moveOccasionToCategory(
    occasionKey: string,
    nextCategory: MainCategory
  ) {
    const normalizedOccasion = normalizeOccasion(occasionKey);

    if (!normalizedOccasion) return;

    setSavingOccasion(normalizedOccasion);

    const previousRows = rows;

    setRows((currentRows) =>
      currentRows.map((row) => {
        if (normalizeOccasion(row.occasion) !== normalizedOccasion) return row;

        return {
          ...row,
          main_category: nextCategory,
        };
      })
    );

    const { error } = await supabase
      .from("templates")
      .update({ main_category: nextCategory })
      .eq("occasion", normalizedOccasion);

    if (error) {
      setRows(previousRows);
      toast.error(error.message);
      setSavingOccasion(null);
      return;
    }

    toast.success(
      `${labelForOccasion(normalizedOccasion)} moved to ${labelForMainCategory(
        nextCategory
      )}`
    );

    setSavingOccasion(null);
  }

  async function toggleOccasionActive(occasionKey: string, next: boolean) {
    const normalizedOccasion = normalizeOccasion(occasionKey);

    if (!normalizedOccasion) return;

    const previousRows = rows;

    setRows((currentRows) =>
      currentRows.map((row) => {
        if (normalizeOccasion(row.occasion) !== normalizedOccasion) return row;

        return {
          ...row,
          isactive: next,
          is_active: next,
        };
      })
    );

    const { error } = await supabase
      .from("templates")
      .update({
        isactive: next,
        is_active: next,
      })
      .eq("occasion", normalizedOccasion);

    if (error) {
      setRows(previousRows);
      toast.error(error.message);
      return;
    }

    toast.success(next ? "Occasion enabled" : "Occasion disabled");
  }

  async function save() {
    const payload = {
      occasion: normalizeOccasion(form.occasion),
      main_category: normalizeMainCategory(form.main_category),
      title: norm(form.title) || null,
      style_id:
        norm(form.style_id) ||
        (norm(form.title) ? makeStyleIdFromTitle(form.title) : null),
      prompt: norm(form.prompt) || null,
      isactive: !!form.isactive,
      is_active: !!form.isactive,
    };

    if (!payload.occasion) {
      toast.error("Occasion is required");
      return;
    }

    if (!payload.main_category) {
      toast.error("Main category is required");
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

    setSaving(true);

    try {
      if (editing?.id) {
        const { error } = await supabase
          .from("templates")
          .update(payload)
          .eq("id", editing.id);

        if (error) throw error;

        toast.success("Style updated");
      } else {
        const { error } = await supabase.from("templates").insert(payload);

        if (error) throw error;

        toast.success("Style created");
      }

      setOpen(false);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: TemplateDbRow, next: boolean) {
    const prev = row.is_active ?? row.isactive ?? true;

    setRows((currentRows) =>
      currentRows.map((item) =>
        item.id === row.id
          ? { ...item, isactive: next, is_active: next }
          : item
      )
    );

    const { error } = await supabase
      .from("templates")
      .update({ isactive: next, is_active: next })
      .eq("id", row.id);

    if (error) {
      setRows((currentRows) =>
        currentRows.map((item) =>
          item.id === row.id
            ? { ...item, isactive: prev, is_active: prev }
            : item
        )
      );

      toast.error(error.message);
    }
  }

  async function del(row: TemplateDbRow) {
    if (!confirm("Delete this style?")) return;

    const { error } = await supabase.from("templates").delete().eq("id", row.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Deleted");
    await load();
  }

  async function generateWithAI() {
    const occ = normalizeOccasion(form.occasion);
    const notes = norm(form.ai_notes);

    if (!occ) {
      toast.error("Pick an occasion first");
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
          occasion: occ,
          notes,
          existing_style_ids: (rows ?? [])
            .filter((row) => normalizeOccasion(row.occasion ?? "") === occ)
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
      const style_id =
        norm((data as any)?.style_id) ||
        (title ? makeStyleIdFromTitle(title) : "");
      const prompt = norm((data as any)?.prompt);

      if (!title || !prompt) {
        toast.error("AI response invalid (missing title/prompt)");
        return;
      }

      setForm((state) => ({
        ...state,
        title,
        style_id: style_id || state.style_id,
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
            Controlează categoriile principale, ocaziile și stilurile folosite
            în Home, Templates, Generator și Funnel Style Select.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

          <Button className="rounded-xl" onClick={openCreate}>
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
            <CardTitle>{dashboardStats.totalOccasions}</CardTitle>
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
            <CardDescription className="text-slate-400">
              Active
            </CardDescription>
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
            Drag & drop o ocazie între coloane pentru a o muta între
            Occasions, Personal, Spiritual și Pets.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

            <Input
              value={boardSearch}
              onChange={(event) => setBoardSearch(event.target.value)}
              placeholder="Search occasion, collection or category..."
              className="rounded-xl border-slate-800 bg-slate-900 pl-9 text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            {MAIN_CATEGORIES.map((column) => {
              const Icon = column.icon;
              const items = occasionsByCategory[column.key];

              return (
                <Card
                  key={column.key}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();

                    const droppedOccasion =
                      draggedOccasion ||
                      event.dataTransfer.getData("text/plain") ||
                      "";

                    setDraggedOccasion(null);

                    if (!droppedOccasion) return;

                    void moveOccasionToCategory(droppedOccasion, column.key);
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

                      <Badge className="rounded-xl border border-slate-800 bg-slate-950 text-slate-200">
                        {items.length}
                      </Badge>
                    </div>
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
                        const isSaving = savingOccasion === item.occasion;
                        const isEnabled = item.active > 0;

                        return (
                          <div
                            key={item.occasion}
                            draggable
                            onDragStart={(event) => {
                              setDraggedOccasion(item.occasion);
                              event.dataTransfer.setData(
                                "text/plain",
                                item.occasion
                              );
                              event.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => setDraggedOccasion(null)}
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
                                    alt={item.label}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Sparkles className="h-5 w-5 text-slate-500" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-slate-50">
                                      {item.label}
                                    </div>

                                    <div className="truncate text-xs text-slate-500">
                                      {item.occasion}
                                    </div>
                                  </div>

                                  <GripVertical className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-slate-300" />
                                </div>

                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <Badge className="rounded-lg border border-slate-800 bg-slate-900 text-[10px] text-slate-300">
                                    {item.total} templates
                                  </Badge>

                                  <Badge className="rounded-lg border border-slate-800 bg-emerald-950/30 text-[10px] text-emerald-200">
                                    {item.active} active
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            <Separator className="my-3 bg-slate-800" />

                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                {isEnabled ? (
                                  <Eye className="h-3.5 w-3.5 text-emerald-300" />
                                ) : (
                                  <EyeOff className="h-3.5 w-3.5 text-rose-300" />
                                )}
                                {isEnabled ? "Visible" : "Hidden"}
                              </div>

                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-slate-500">
                                  Active
                                </Label>

                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={(value) =>
                                    void toggleOccasionActive(
                                      item.occasion,
                                      value
                                    )
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
            <CardTitle className="text-base">Occasion & Search</CardTitle>
            <CardDescription className="text-slate-400">
              Alege o ocazie și gestionează stilurile care apar în Style Select.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Occasion</Label>

                <Select
                  value={normalizeOccasion(occasion)}
                  onValueChange={(value) =>
                    setOccasion(normalizeOccasion(value))
                  }
                >
                  <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 text-slate-100">
                    <SelectValue placeholder="Select occasion" />
                  </SelectTrigger>

                  <SelectContent className="z-50 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
                    {OCCASIONS.map((item) => (
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
                <Label className="text-slate-300">Search</Label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <Input
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                    placeholder="Search styles..."
                    className="rounded-xl border-slate-800 bg-slate-900 pl-9 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-slate-800" />

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200">
                Occasion: {labelForOccasion(occasion)}
              </Badge>

              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200">
                Category: {labelForMainCategory(getMainCategoryForOccasion(occasion))}
              </Badge>

              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200">
                Total: {stats.total}
              </Badge>

              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-emerald-200">
                Active: {stats.active}
              </Badge>

              <Badge className="rounded-xl border border-slate-800 bg-slate-900 text-rose-200">
                Inactive: {stats.inactive}
              </Badge>

              {q.trim() ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                  onClick={() => setQ("")}
                >
                  Clear search
                </Button>
              ) : (
                <span className="ml-auto text-xs text-slate-500">
                  Search filters only current occasion
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50 lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tip</CardTitle>
            <CardDescription className="text-slate-400">
              În FunnelStyleSelect se face query pe <b>templates</b> filtrat după{" "}
              <b>occasion</b> + <b>isactive</b>.
            </CardDescription>
          </CardHeader>

          <CardContent className="text-sm text-slate-300">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <div className="font-medium text-slate-100">Recomandare</div>

              <div className="mt-1 text-slate-400">
                Păstrează <b>style_id</b> stabil (slug), iar <b>title</b> poate
                fi “pretty”.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Styles</CardTitle>

          <CardDescription className="text-slate-400">
            {labelForOccasion(occasion)} • {filtered.length} shown
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="py-6 text-sm text-slate-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
              <div className="text-sm font-semibold text-slate-100">
                No styles found
              </div>

              <div className="mt-1 text-xs text-slate-400">
                Creează primul style pentru{" "}
                <b>{labelForOccasion(occasion)}</b>.
              </div>

              <div className="mt-4">
                <Button className="rounded-xl" onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  New style
                </Button>
              </div>
            </div>
          ) : (
            filtered.map((row) => {
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
                        {normalizeOccasion(row.occasion ?? "")}
                      </Badge>

                      <Badge className="rounded-xl border border-slate-800 bg-slate-950 text-slate-200">
                        {labelForMainCategory(normalizeMainCategory(row.main_category))}
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
                        onCheckedChange={(value) => toggleActive(row, value)}
                      />
                    </div>

                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>

                    <Button
                      variant="destructive"
                      className="rounded-xl"
                      onClick={() => del(row)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit style" : "Create style"}
            </DialogTitle>

            <DialogDescription className="text-slate-400">
              Aceste valori se folosesc în <b>FunnelStyleSelect</b> (title +
              prompt) pentru ocazia aleasă.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-slate-300">Main Category</Label>

                <Select
                  value={form.main_category}
                  onValueChange={(value) =>
                    setForm((state) => ({
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
                <Label className="text-slate-300">Occasion</Label>

                <Select
                  value={normalizeOccasion(form.occasion)}
                  onValueChange={(value) =>
                    setForm((state) => ({
                      ...state,
                      occasion: normalizeOccasion(value),
                      main_category: getMainCategoryForOccasion(value),
                    }))
                  }
                >
                  <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 text-slate-100">
                    <SelectValue placeholder="Select occasion" />
                  </SelectTrigger>

                  <SelectContent className="z-50 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
                    {OCCASIONS.map((item) => (
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
                    {form.isactive ? "Enabled" : "Disabled"}
                  </span>

                  <Switch
                    checked={!!form.isactive}
                    onCheckedChange={(value) =>
                      setForm((state) => ({ ...state, isactive: value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-slate-300">AI notes (optional)</Label>

                <Input
                  value={form.ai_notes}
                  onChange={(event) =>
                    setForm((state) => ({
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
                  onClick={generateWithAI}
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
                  value={form.title}
                  onChange={(event) => {
                    const title = event.target.value;

                    setForm((state) => ({
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
                <Label className="text-slate-300">style_id (slug)</Label>

                <Input
                  value={form.style_id}
                  onChange={(event) =>
                    setForm((state) => ({
                      ...state,
                      style_id: event.target.value,
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
                value={form.prompt}
                onChange={(event) =>
                  setForm((state) => ({
                    ...state,
                    prompt: event.target.value,
                  }))
                }
                placeholder="Write the exact Replicate prompt here..."
                className={cn(
                  "min-h-[240px] rounded-xl font-mono text-xs",
                  "border border-slate-700 bg-white text-slate-900",
                  "placeholder:text-slate-500",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-0"
                )}
              />

              <div className="text-xs text-slate-500">
                Tip: ține prompturile consistente per ocazie (același format),
                ca să fie ușor de întreținut.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>

              <Button className="rounded-xl" onClick={save} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}