// src/pages/admin/funnel/Index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";

// icons
import { Plus, RefreshCw, Save, Trash2, Pencil, Search } from "lucide-react";

type TemplateDbRow = {
  id: string;
  title: string | null;
  prompt: string | null;
  occasion: string | null;
  style_id: string | null;
  isactive: boolean | null;
  created_at?: string | null;
};

const OCCASIONS = [
  { key: "christmas", label: "Christmas" },
  { key: "birthday", label: "Birthday" },
  { key: "pregnancy", label: "Pregnancy" },
  { key: "wedding", label: "Wedding" },
  { key: "anniversary", label: "Anniversary" },
  { key: "valentines-day", label: "Valentine’s Day" },
  { key: "new-years-eve", label: "New Year’s Eve" },
  { key: "thanksgiving", label: "Thanksgiving" },
  { key: "baby-reveal", label: "Baby Reveal" },
  { key: "new-born", label: "New Born" },
  { key: "easter", label: "Easter" },
  { key: "mothers-day", label: "Mother’s Day" },
  { key: "fathers-day", label: "Father’s Day" },
  { key: "graduation", label: "Graduation" },
] as const;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeString(x: unknown) {
  return String(x ?? "").trim();
}

function normalizeOccasion(raw: string) {
  const x = safeString(raw).toLowerCase();
  if (x === "newborn" || x === "new_born") return "new-born";
  return x;
}

function parseStyleId(v: string) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function nextStyleId(existing: TemplateDbRow[]) {
  const used = new Set(
    existing
      .map((r) => safeString(r.style_id))
      .filter(Boolean)
      .map((v) => parseStyleId(v))
      .filter((n): n is number => typeof n === "number")
  );

  for (let i = 1; i <= 99; i++) {
    if (!used.has(i)) return String(i).padStart(2, "0");
  }
  return "01";
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <Badge
      className={cn(
        "rounded-full",
        active ? "bg-emerald-600 hover:bg-emerald-600" : "bg-slate-500 hover:bg-slate-500"
      )}
    >
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

type EditorDraft = {
  id?: string;
  occasion: string;
  style_id: string;
  title: string;
  prompt: string;
  isactive: boolean;
};

function emptyDraft(occasion: string, style_id: string): EditorDraft {
  return { occasion, style_id, title: "", prompt: "", isactive: true };
}

export default function AdminFunnelPage() {
  const [occasion, setOccasion] = useState<string>("christmas");
  const [rows, setRows] = useState<TemplateDbRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [q, setQ] = useState<string>("");

  const [openEditor, setOpenEditor] = useState(false);
  const [draft, setDraft] = useState<EditorDraft | null>(null);

  const [openDelete, setOpenDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TemplateDbRow | null>(null);

  const occasionLabel = useMemo(() => {
    const hit = OCCASIONS.find((o) => o.key === occasion);
    return hit?.label ?? occasion;
  }, [occasion]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      const a = safeString(r.title).toLowerCase();
      const b = safeString(r.style_id).toLowerCase();
      const c = safeString(r.prompt).toLowerCase();
      return a.includes(s) || b.includes(s) || c.includes(s);
    });
  }, [rows, q]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => !!r.isactive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [rows]);

  const fetchOccasion = async (occ: string) => {
    setLoading(true);
    setErrorMsg(null);

    const normalized = normalizeOccasion(occ);

    const { data, error } = await supabase
      .from("templates")
      .select("id,title,prompt,occasion,style_id,isactive,created_at")
      .eq("occasion", normalized)
      .order("style_id", { ascending: true });

    if (error) {
      console.error("[AdminFunnel] fetch error:", error);
      setRows([]);
      setErrorMsg(error.message || "Failed to load.");
      setLoading(false);
      return;
    }

    setRows((data ?? []) as TemplateDbRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void fetchOccasion(occasion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occasion]);

  const openCreate = () => {
    const sid = nextStyleId(rows);
    setDraft(emptyDraft(occasion, sid));
    setErrorMsg(null);
    setOpenEditor(true);
  };

  const openEdit = (r: TemplateDbRow) => {
    setDraft({
      id: r.id,
      occasion: normalizeOccasion(safeString(r.occasion) || occasion),
      style_id: safeString(r.style_id) || "01",
      title: safeString(r.title),
      prompt: safeString(r.prompt),
      isactive: !!r.isactive,
    });
    setErrorMsg(null);
    setOpenEditor(true);
  };

  const validateDraft = (d: EditorDraft) => {
    if (!safeString(d.occasion)) return "Occasion is required.";
    if (!safeString(d.style_id)) return "style_id is required (ex: 01).";
    if (!safeString(d.title)) return "Title is required.";
    if (!safeString(d.prompt)) return "Prompt is required.";
    return null;
  };

  const saveDraft = async () => {
    if (!draft) return;

    const err = validateDraft(draft);
    if (err) {
      setErrorMsg(err);
      return;
    }

    setBusy(true);
    setErrorMsg(null);

    const payload = {
      occasion: normalizeOccasion(draft.occasion),
      style_id: safeString(draft.style_id),
      title: safeString(draft.title),
      prompt: safeString(draft.prompt),
      isactive: !!draft.isactive,
    };

    try {
      if (draft.id) {
        const { error } = await supabase.from("templates").update(payload).eq("id", draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("templates").insert(payload);
        if (error) throw error;
      }

      setOpenEditor(false);
      setDraft(null);
      await fetchOccasion(occasion);
    } catch (e: any) {
      console.error("[AdminFunnel] save error:", e);
      setErrorMsg(e?.message || "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (r: TemplateDbRow, next: boolean) => {
    setErrorMsg(null);

    const { error } = await supabase.from("templates").update({ isactive: next }).eq("id", r.id);

    if (error) {
      console.error("[AdminFunnel] toggle error:", error);
      setErrorMsg(error.message || "Failed to update.");
      return;
    }

    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, isactive: next } : x)));
  };

  const requestDelete = (r: TemplateDbRow) => {
    setDeleteTarget(r);
    setErrorMsg(null);
    setOpenDelete(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setBusy(true);
    setErrorMsg(null);

    const { error } = await supabase.from("templates").delete().eq("id", deleteTarget.id);

    if (error) {
      console.error("[AdminFunnel] delete error:", error);
      setErrorMsg(error.message || "Failed to delete.");
      setBusy(false);
      return;
    }

    setOpenDelete(false);
    setDeleteTarget(null);
    await fetchOccasion(occasion);
    setBusy(false);
  };

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs text-slate-500">Admin · Funnel</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Occasions & Styles</h1>
          <p className="mt-1 text-sm text-slate-600">
            Select an occasion, then manage the styles (title + prompt) used by the funnel.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-[260px]">
            <Select
              value={occasion}
              onValueChange={(v) => {
                setQ("");
                setOccasion(v);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select occasion" />
              </SelectTrigger>
              <SelectContent>
                {OCCASIONS.map((o) => (
                  <SelectItem key={o.key} value={o.key}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" className="h-10" onClick={() => fetchOccasion(occasion)} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>

          <Button className="h-10" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New style
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Selected occasion</CardTitle>
            <CardDescription>What the funnel filters by.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{occasionLabel}</div>
              <Badge className="rounded-full">{occasion}</Badge>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-2">
              <Card className="border-slate-200 shadow-none">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-500">Total</div>
                  <div className="mt-1 text-xl font-semibold">{stats.total}</div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-none">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-500">Active</div>
                  <div className="mt-1 text-xl font-semibold">{stats.active}</div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-none">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-500">Inactive</div>
                  <div className="mt-1 text-xl font-semibold">{stats.inactive}</div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600">Quick search</div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search title, style_id, prompt…"
                  className="pl-9"
                />
              </div>
              <div className="text-[11px] text-slate-500">
                Tip: keep <b>style_id</b> as <b>01…06</b> for clean ordering.
              </div>
            </div>

            {errorMsg ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {errorMsg}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Styles for {occasionLabel}</CardTitle>
            <CardDescription>These are pulled by FunnelStyleSelect from the templates table.</CardDescription>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="h-4 w-40 rounded bg-slate-100" />
                    <div className="mt-2 h-3 w-5/6 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <div className="text-sm font-semibold">No styles yet</div>
                <div className="mt-1 text-xs text-slate-600">
                  Click <b>New style</b> to add the first one for <b>{occasion}</b>.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((r) => {
                  const active = !!r.isactive;

                  return (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="rounded-full" variant="secondary">
                              style_id: {safeString(r.style_id) || "—"}
                            </Badge>
                            <StatusPill active={active} />
                          </div>

                          <div className="mt-2 text-sm font-semibold text-slate-900">
                            {safeString(r.title) || "Untitled"}
                          </div>

                          <div className="mt-1 line-clamp-2 text-xs text-slate-600">
                            {safeString(r.prompt) || "No prompt yet."}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1">
                            <span className="text-xs text-slate-500">Active</span>
                            <Switch checked={active} onCheckedChange={(v) => toggleActive(r, v)} />
                          </div>

                          <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>

                          <Button variant="destructive" size="sm" onClick={() => requestDelete(r)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* EDITOR */}
      <Dialog open={openEditor} onOpenChange={(v) => !busy && setOpenEditor(v)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit style" : "Create style"}</DialogTitle>
            <DialogDescription>
              Saved in <b>templates</b> and used by the funnel for <b>{occasion}</b>.
            </DialogDescription>
          </DialogHeader>

          {draft ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-600">Occasion</div>
                  <Select
                    value={draft.occasion}
                    onValueChange={(v) => setDraft((p) => (p ? { ...p, occasion: v } : p))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Occasion" />
                    </SelectTrigger>
                    <SelectContent>
                      {OCCASIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-[11px] text-slate-500">Must match your funnel occasion keys.</div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-600">style_id</div>
                  <Input
                    value={draft.style_id}
                    onChange={(e) => setDraft((p) => (p ? { ...p, style_id: e.target.value } : p))}
                    placeholder="01"
                    className="h-10"
                  />
                  <div className="text-[11px] text-slate-500">Use 01…06 to keep ordering clean.</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-600">Title</div>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft((p) => (p ? { ...p, title: e.target.value } : p))}
                  placeholder="Golden Memory"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-600">Prompt</div>
                <Textarea
                  value={draft.prompt}
                  onChange={(e) => setDraft((p) => (p ? { ...p, prompt: e.target.value } : p))}
                  placeholder="Write the Replicate prompt here…"
                  className="min-h-[180px]"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Active</div>
                  <div className="text-[11px] text-slate-500">If off, it won’t show in FunnelStyleSelect.</div>
                </div>
                <Switch
                  checked={draft.isactive}
                  onCheckedChange={(v) => setDraft((p) => (p ? { ...p, isactive: v } : p))}
                />
              </div>

              {errorMsg ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {errorMsg}
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (busy) return;
                setOpenEditor(false);
                setDraft(null);
                setErrorMsg(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={saveDraft} disabled={busy || !draft}>
              <Save className="mr-2 h-4 w-4" />
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE */}
      <Dialog open={openDelete} onOpenChange={(v) => !busy && setOpenDelete(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete style?</DialogTitle>
            <DialogDescription>This will permanently delete the template row.</DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <div className="font-semibold">{safeString(deleteTarget?.title) || "Untitled"}</div>
            <div className="text-xs text-slate-600">style_id: {safeString(deleteTarget?.style_id) || "—"}</div>
          </div>

          {errorMsg ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {errorMsg}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}