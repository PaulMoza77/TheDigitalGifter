// src/pages/admin/funnel/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";

import { Plus, RefreshCw, Search, Pencil, Trash2, Save, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type TemplateDbRow = {
  id: string;
  title: string | null;
  prompt: string | null;
  occasion: string | null;
  style_id: string | null;
  isactive: boolean | null;
  created_at: string | null;
};

const OCCASIONS: Array<{ key: string; label: string }> = [
  { key: "newborn", label: "Newborn" },
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
];

function norm(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeOccasion(v: string) {
  const x = norm(v).toLowerCase();
  if (!x) return "newborn";
  if (x === "new_born" || x === "new-born") return "newborn";
  if (x === "valentines-day") return "valentines_day";
  if (x === "mothers-day") return "mothers_day";
  if (x === "fathers-day") return "fathers_day";
  if (x === "new-years-eve") return "new_years_eve";
  if (x === "baby-reveal") return "baby_reveal";
  return x;
}

function labelForOccasion(key: string) {
  const k = normalizeOccasion(key);
  return OCCASIONS.find((o) => o.key === k)?.label ?? k;
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
  const [occasion, setOccasion] = useState<string>("newborn");

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [editing, setEditing] = useState<TemplateDbRow | null>(null);

  const [form, setForm] = useState({
    occasion: "newborn",
    title: "",
    style_id: "",
    prompt: "",
    isactive: true,
    ai_notes: "",
  });

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    const occ = normalizeOccasion(occasion);

    return (rows ?? []).filter((r) => {
      const rocc = normalizeOccasion(r.occasion ?? "");
      if (rocc !== occ) return false;
      if (!nq) return true;

      const hay = `${r.title ?? ""} ${r.style_id ?? ""} ${r.prompt ?? ""}`.toLowerCase();
      return hay.includes(nq);
    });
  }, [rows, q, occasion]);

  const stats = useMemo(() => {
    const occ = normalizeOccasion(occasion);
    const inOcc = (rows ?? []).filter((r) => normalizeOccasion(r.occasion ?? "") === occ);
    const total = inOcc.length;
    const active = inOcc.filter((r) => !!r.isactive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [rows, occasion]);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("templates")
      .select("id,title,prompt,occasion,style_id,isactive,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as TemplateDbRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    const occ = normalizeOccasion(occasion);

    setForm({
      occasion: occ,
      title: "",
      style_id: "",
      prompt: "",
      isactive: true,
      ai_notes: "",
    });

    setOpen(true);
  }

  function openEdit(r: TemplateDbRow) {
    setEditing(r);

    setForm({
      occasion: normalizeOccasion(r.occasion ?? occasion),
      title: r.title ?? "",
      style_id: r.style_id ?? "",
      prompt: r.prompt ?? "",
      isactive: !!r.isactive,
      ai_notes: "",
    });

    setOpen(true);
  }

  async function save() {
    const payload = {
      occasion: normalizeOccasion(form.occasion),
      title: norm(form.title) || null,
      style_id: norm(form.style_id) || (norm(form.title) ? makeStyleIdFromTitle(form.title) : null),
      prompt: norm(form.prompt) || null,
      isactive: !!form.isactive,
    };

    if (!payload.occasion) return toast.error("Occasion is required");
    if (!payload.title) return toast.error("Title is required");
    if (!payload.style_id) return toast.error("style_id is required");
    if (!payload.prompt) return toast.error("Prompt is required");

    setSaving(true);

    try {
      if (editing?.id) {
        const { error } = await supabase.from("templates").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Style updated");
      } else {
        const { error } = await supabase.from("templates").insert(payload);
        if (error) throw error;
        toast.success("Style created");
      }

      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: TemplateDbRow, next: boolean) {
    const prev = !!r.isactive;

    setRows((p) => p.map((x) => (x.id === r.id ? { ...x, isactive: next } : x)));

    const { error } = await supabase.from("templates").update({ isactive: next }).eq("id", r.id);
    if (error) {
      setRows((p) => p.map((x) => (x.id === r.id ? { ...x, isactive: prev } : x)));
      toast.error(error.message);
    }
  }

  async function del(r: TemplateDbRow) {
    if (!confirm("Delete this style?")) return;

    const { error } = await supabase.from("templates").delete().eq("id", r.id);
    if (error) return toast.error(error.message);

    toast.success("Deleted");
    await load();
  }

  // ✅ AI generate (Bearer token explicit) + better error surfacing
  async function generateWithAI() {
    const occ = normalizeOccasion(form.occasion);
    const notes = norm(form.ai_notes);

    if (!occ) return toast.error("Pick an occasion first");

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
            .filter((r) => normalizeOccasion(r.occasion ?? "") === occ)
            .map((r) => r.style_id)
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
      const style_id = norm((data as any)?.style_id) || (title ? makeStyleIdFromTitle(title) : "");
      const prompt = norm((data as any)?.prompt);

      if (!title || !prompt) {
        toast.error("AI response invalid (missing title/prompt)");
        return;
      }

      setForm((s) => ({
        ...s,
        title,
        style_id: style_id || s.style_id,
        prompt,
      }));

      toast.success("Generated");
    } catch (e: any) {
      console.error("generateWithAI exception:", e);
      toast.error(e?.message || "AI generation failed");
    } finally {
      setAiGenerating(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs tracking-[0.22em] uppercase text-slate-400">Admin</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">Funnel</h1>
          <p className="mt-1 text-sm text-slate-400">
            Configurează ocaziile + stilurile (title + prompt) folosite în Funnel Style Select.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
            onClick={() => load()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>

          <Button className="rounded-xl" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New style
          </Button>
        </div>
      </div>

      {/* filters + stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8 rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
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
                <Select value={normalizeOccasion(occasion)} onValueChange={(v) => setOccasion(normalizeOccasion(v))}>
                  <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 text-slate-100">
                    <SelectValue placeholder="Select occasion" />
                  </SelectTrigger>

                  <SelectContent className="z-50 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
                    {OCCASIONS.map((o) => (
                      <SelectItem
                        key={o.key}
                        value={o.key}
                        className="focus:bg-slate-800 focus:text-slate-50 data-[highlighted]:bg-slate-800 data-[highlighted]:text-slate-50"
                      >
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search styles..."
                    className="pl-9 rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-slate-800" />

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge className="rounded-xl bg-slate-900 text-slate-200 border border-slate-800">
                Occasion: {labelForOccasion(occasion)}
              </Badge>
              <Badge className="rounded-xl bg-slate-900 text-slate-200 border border-slate-800">
                Total: {stats.total}
              </Badge>
              <Badge className="rounded-xl bg-slate-900 text-emerald-200 border border-slate-800">
                Active: {stats.active}
              </Badge>
              <Badge className="rounded-xl bg-slate-900 text-rose-200 border border-slate-800">
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
                <span className="ml-auto text-xs text-slate-500">Search filters only current occasion</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tip</CardTitle>
            <CardDescription className="text-slate-400">
              În FunnelStyleSelect se face query pe <b>templates</b> filtrat după <b>occasion</b> + <b>isactive</b>.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-300">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <div className="font-medium text-slate-100">Recomandare</div>
              <div className="mt-1 text-slate-400">
                Păstrează <b>style_id</b> stabil (slug), iar <b>title</b> poate fi “pretty”.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* list */}
      <Card className="rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Styles</CardTitle>
          <CardDescription className="text-slate-400">
            {labelForOccasion(occasion)} • {filtered.length} shown
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-slate-400 py-6">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
              <div className="text-sm font-semibold text-slate-100">No styles found</div>
              <div className="mt-1 text-xs text-slate-400">
                Creează primul style pentru <b>{labelForOccasion(occasion)}</b>.
              </div>
              <div className="mt-4">
                <Button className="rounded-xl" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  New style
                </Button>
              </div>
            </div>
          ) : (
            filtered.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-slate-50 truncate">
                      {r.title || <span className="text-slate-500">(no title)</span>}
                    </div>

                    <Badge className="rounded-xl border border-slate-800 bg-slate-950 text-slate-200">
                      {normalizeOccasion(r.occasion ?? "")}
                    </Badge>

                    <Badge
                      className={cn(
                        "rounded-xl border border-slate-800",
                        r.isactive ? "bg-emerald-950/40 text-emerald-200" : "bg-rose-950/30 text-rose-200"
                      )}
                    >
                      {r.isactive ? "active" : "inactive"}
                    </Badge>
                  </div>

                  <div className="text-xs text-slate-400 truncate">
                    style_id: <span className="text-slate-200">{r.style_id ?? "—"}</span> • id:{" "}
                    <span className="text-slate-200">{r.id}</span>
                  </div>

                  <div className="text-xs text-slate-400 line-clamp-2">
                    {r.prompt ?? <span className="text-slate-500">(no prompt)</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                    <span className="text-xs text-slate-400">Active</span>
                    <Switch checked={!!r.isactive} onCheckedChange={(v) => toggleActive(r, v)} />
                  </div>

                  <Button
                    variant="outline"
                    className="rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                    onClick={() => openEdit(r)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>

                  <Button variant="destructive" className="rounded-xl" onClick={() => del(r)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl rounded-2xl border-slate-800 bg-slate-950 text-slate-50">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit style" : "Create style"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Aceste valori se folosesc în <b>FunnelStyleSelect</b> (title + prompt) pentru ocazia aleasă.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Occasion</Label>
                <Select
                  value={normalizeOccasion(form.occasion)}
                  onValueChange={(v) => setForm((s) => ({ ...s, occasion: normalizeOccasion(v) }))}
                >
                  <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900 text-slate-100">
                    <SelectValue placeholder="Select occasion" />
                  </SelectTrigger>

                  <SelectContent className="z-50 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
                    {OCCASIONS.map((o) => (
                      <SelectItem
                        key={o.key}
                        value={o.key}
                        className="focus:bg-slate-800 focus:text-slate-50 data-[highlighted]:bg-slate-800 data-[highlighted]:text-slate-50"
                      >
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Active</Label>
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                  <span className="text-sm text-slate-200">{form.isactive ? "Enabled" : "Disabled"}</span>
                  <Switch checked={!!form.isactive} onCheckedChange={(v) => setForm((s) => ({ ...s, isactive: v }))} />
                </div>
              </div>
            </div>

            {/* AI helper */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2 space-y-2">
                <Label className="text-slate-300">AI notes (optional)</Label>
                <Input
                  value={form.ai_notes}
                  onChange={(e) => setForm((s) => ({ ...s, ai_notes: e.target.value }))}
                  placeholder='e.g. "warm golden light, film look, joyful family, premium, clean background"'
                  className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="sm:col-span-1 space-y-2">
                <Label className="text-slate-300">Generate</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-900"
                  onClick={generateWithAI}
                  disabled={aiGenerating}
                >
                  <Sparkles className={cn("h-4 w-4 mr-2", aiGenerating && "animate-pulse")} />
                  {aiGenerating ? "Generating..." : "Generate with AI"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((s) => ({
                      ...s,
                      title,
                      style_id: s.style_id || (title ? makeStyleIdFromTitle(title) : ""),
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
                  onChange={(e) => setForm((s) => ({ ...s, style_id: e.target.value }))}
                  placeholder="golden_memory"
                  className="rounded-xl border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* ✅ Prompt readable */}
            <div className="space-y-2">
              <Label className="text-slate-300">Prompt</Label>
              <Textarea
                value={form.prompt}
                onChange={(e) => setForm((s) => ({ ...s, prompt: e.target.value }))}
                placeholder="Write the exact Replicate prompt here..."
                className={cn(
                  "rounded-xl min-h-[240px] font-mono text-xs",
                  "border border-slate-700 bg-white text-slate-900",
                  "placeholder:text-slate-500",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-0"
                )}
              />
              <div className="text-xs text-slate-500">
                Tip: ține prompturile consistente per ocazie (același format), ca să fie ușor de întreținut.
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
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}