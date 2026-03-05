// src/pages/admin/email/Offers.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { Plus, RefreshCw, Search, Pencil, Trash2, Copy } from "lucide-react";

type EmailOfferRow = {
  id: string;
  title: string | null;
  discount_percent: number | null;
  coupon_code: string | null;
  expires_at: string | null;
  created_at: string | null;
};

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function toInputDateTime(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function toISOFromInput(v: string) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function AdminEmailOffersPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EmailOfferRow[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<EmailOfferRow | null>(null);

  const [form, setForm] = useState({
    title: "",
    discount_percent: 70,
    coupon_code: "",
    expires_at: "",
  });

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    if (!nq) return rows;
    return rows.filter((r) => {
      const hay = `${r.title ?? ""} ${r.coupon_code ?? ""} ${r.discount_percent ?? ""}`.toLowerCase();
      return hay.includes(nq);
    });
  }, [rows, q]);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("email_offers")
      .select("id,title,discount_percent,coupon_code,expires_at,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as EmailOfferRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({
      title: "70% OFF — Welcome Offer",
      discount_percent: 70,
      coupon_code: "TDG70",
      expires_at: "",
    });
    setOpen(true);
  }

  function openEdit(row: EmailOfferRow) {
    setEditing(row);
    setForm({
      title: row.title ?? "",
      discount_percent: row.discount_percent ?? 0,
      coupon_code: row.coupon_code ?? "",
      expires_at: toInputDateTime(row.expires_at),
    });
    setOpen(true);
  }

  async function save() {
    const title = form.title.trim();
    const discount_percent = Number(form.discount_percent);
    const coupon_code = form.coupon_code.trim().toUpperCase();
    const expires_at = toISOFromInput(form.expires_at);

    if (!title) return toast.error("Title is required");
    if (!coupon_code) return toast.error("Coupon code is required");
    if (!Number.isFinite(discount_percent) || discount_percent <= 0 || discount_percent > 100) {
      return toast.error("Discount % must be between 1 and 100");
    }

    setSaving(true);

    if (editing) {
      const { error } = await supabase
        .from("email_offers")
        .update({
          title,
          discount_percent,
          coupon_code,
          expires_at,
        })
        .eq("id", editing.id);

      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }

      toast.success("Offer updated");
    } else {
      const { error } = await supabase.from("email_offers").insert({
        title,
        discount_percent,
        coupon_code,
        expires_at,
      });

      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }

      toast.success("Offer created");
    }

    setSaving(false);
    setOpen(false);
    await load();
  }

  async function del(row: EmailOfferRow) {
    if (!confirm("Delete this offer?")) return;
    const { error } = await supabase.from("email_offers").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    await load();
  }

  async function copyCode(row: EmailOfferRow) {
    try {
      await navigator.clipboard.writeText(row.coupon_code ?? "");
      toast.success("Copied code");
    } catch {
      toast.error("Failed to copy");
    }
  }

  const now = Date.now();

  return (
    <div className="p-6 space-y-6">
      <Card className="rounded-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Offers</CardTitle>
          <CardDescription>Create coupon-based offers to attach to campaigns & templates.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 rounded-xl"
                placeholder="Search offers..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => load()} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>

              <Button className="rounded-xl" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                New Offer
              </Button>
            </div>
          </div>

          <Separator />

          <div className="grid gap-3">
            {filtered.map((r) => {
              const exp = r.expires_at ? new Date(r.expires_at).getTime() : null;
              const expired = exp !== null && exp < now;

              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold truncate">{r.title || "Untitled"}</div>

                      <Badge variant="secondary" className="rounded-xl">
                        {r.discount_percent ?? 0}% OFF
                      </Badge>

                      <Badge className={cn("rounded-xl", expired && "bg-red-600")}>
                        {r.coupon_code || "—"}
                      </Badge>

                      {r.expires_at && (
                        <Badge variant="outline" className="rounded-xl">
                          {expired ? "Expired" : "Expires"} • {new Date(r.expires_at).toLocaleString()}
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm text-slate-600 truncate">{r.id}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => copyCode(r)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Code
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
              );
            })}

            {!loading && filtered.length === 0 && (
              <div className="text-sm text-slate-600 py-8 text-center">No offers found.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Offer" : "Create Offer"}</DialogTitle>
            <DialogDescription>Use coupon_code as {"{{coupon}}"} in templates.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                className="rounded-xl"
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="70% OFF — Welcome Offer"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Discount %</Label>
                <Input
                  className="rounded-xl"
                  type="number"
                  value={form.discount_percent}
                  onChange={(e) => setForm((s) => ({ ...s, discount_percent: Number(e.target.value) }))}
                  min={1}
                  max={100}
                />
              </div>

              <div className="space-y-2">
                <Label>Coupon code</Label>
                <Input
                  className="rounded-xl"
                  value={form.coupon_code}
                  onChange={(e) => setForm((s) => ({ ...s, coupon_code: e.target.value }))}
                  placeholder="TDG70"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Expires at (optional)</Label>
              <Input
                className="rounded-xl"
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm((s) => ({ ...s, expires_at: e.target.value }))}
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