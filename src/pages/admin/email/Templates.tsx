// src/pages/admin/email/Templates.tsx
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { Plus, RefreshCw, Search, Pencil, Trash2, Copy } from "lucide-react";

type EmailTemplateRow = {
  id: string;
  name: string | null;
  type: string | null;
  subject: string | null;
  html: string | null;
  created_at: string | null;
};

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function slugify(v: string) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function AdminEmailTemplatesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EmailTemplateRow[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<EmailTemplateRow | null>(null);

  const [form, setForm] = useState({
    name: "",
    type: "welcome",
    subject: "",
    html: "",
  });

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    if (!nq) return rows;
    return rows.filter((r) => {
      const hay = `${r.name ?? ""} ${r.type ?? ""} ${r.subject ?? ""}`.toLowerCase();
      return hay.includes(nq);
    });
  }, [rows, q]);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("email_templates")
      .select("id,name,type,subject,html,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as EmailTemplateRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      type: "welcome",
      subject: "",
      html: [
        "<div style=\"font-family:ui-sans-serif,system-ui;max-width:640px;margin:0 auto;padding:24px\">",
        "  <h1 style=\"font-size:22px;margin:0 0 12px\">Hi {{name}}</h1>",
        "  <p style=\"line-height:1.6;margin:0 0 16px\">Welcome to TheDigitalGifter.</p>",
        "  <p style=\"margin:0 0 16px\"><a href=\"{{link}}\" style=\"display:inline-block;padding:10px 14px;border-radius:10px;background:#111827;color:white;text-decoration:none\">Open</a></p>",
        "  <p style=\"color:#6b7280;font-size:12px;margin:24px 0 0\">If you didn’t request this, ignore this email.</p>",
        "</div>",
      ].join("\n"),
    });
    setOpen(true);
  }

  function openEdit(row: EmailTemplateRow) {
    setEditing(row);
    setForm({
      name: row.name ?? "",
      type: row.type ?? "welcome",
      subject: row.subject ?? "",
      html: row.html ?? "",
    });
    setOpen(true);
  }

  async function save() {
    const name = form.name.trim();
    const type = slugify(form.type);
    const subject = form.subject.trim();
    const html = form.html;

    if (!type) return toast.error("Type is required");
    if (!subject) return toast.error("Subject is required");
    if (!html) return toast.error("HTML is required");

    setSaving(true);

    if (editing) {
      const { error } = await supabase
        .from("email_templates")
        .update({
          name: name || null,
          type,
          subject,
          html,
        })
        .eq("id", editing.id);

      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }

      toast.success("Template updated");
    } else {
      const { error } = await supabase.from("email_templates").insert({
        name: name || null,
        type,
        subject,
        html,
      });

      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }

      toast.success("Template created");
    }

    setSaving(false);
    setOpen(false);
    await load();
  }

  async function del(row: EmailTemplateRow) {
    if (!confirm("Delete this template?")) return;

    const { error } = await supabase.from("email_templates").delete().eq("id", row.id);
    if (error) return toast.error(error.message);

    toast.success("Deleted");
    await load();
  }

  async function copyId(row: EmailTemplateRow) {
    try {
      await navigator.clipboard.writeText(row.id);
      toast.success("Copied ID");
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Card className="rounded-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Email Templates</CardTitle>
          <CardDescription>Create and manage transactional + marketing templates.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 rounded-xl"
                placeholder="Search templates..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => load()}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>

              <Button className="rounded-xl" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </div>
          </div>

          <Separator />

          <div className="grid gap-3">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold truncate">
                      {r.subject || <span className="text-slate-400">(no subject)</span>}
                    </div>
                    <Badge variant="secondary" className="rounded-xl">
                      {r.type || "—"}
                    </Badge>
                  </div>

                  <div className="text-sm text-slate-600 truncate">
                    {r.name || "Unnamed"} • {r.id}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => copyId(r)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy ID
                  </Button>

                  <Button variant="outline" className="rounded-xl" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>

                  <Button variant="destructive" className="rounded-xl" onClick={() => del(r)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}

            {!loading && filtered.length === 0 && (
              <div className="text-sm text-slate-600 py-8 text-center">No templates found.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "Create Template"}</DialogTitle>
            <DialogDescription>
              Use placeholders like <code>{"{{name}}"}</code>, <code>{"{{link}}"}</code>,{" "}
              <code>{"{{coupon}}"}</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  className="rounded-xl"
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Welcome Email"
                />
              </div>

              <div className="space-y-2">
                <Label>Type (key)</Label>
                <Input
                  className="rounded-xl"
                  value={form.type}
                  onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
                  placeholder="welcome | discount_70 | generation_ready"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                className="rounded-xl"
                value={form.subject}
                onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))}
                placeholder="🎁 Welcome to TheDigitalGifter"
              />
            </div>

            <div className="space-y-2">
              <Label>HTML</Label>
              <Textarea
                className="rounded-xl min-h-[320px] font-mono text-xs"
                value={form.html}
                onChange={(e) => setForm((s) => ({ ...s, html: e.target.value }))}
                placeholder="<div>...</div>"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-xl" onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}