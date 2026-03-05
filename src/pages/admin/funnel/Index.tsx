// src/pages/admin/funnel/Index.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, RefreshCw } from "lucide-react";

type FunnelStyle = {
  id: string;
  title: string | null;
  occasion: string | null;
  style_id: string | null;
  isactive: boolean | null;
};

export default function AdminFunnelPage() {
  const [rows, setRows] = useState<FunnelStyle[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("funnel_styles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as FunnelStyle[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <Card className="rounded-2xl border-slate-800 bg-slate-950/60">
        <CardHeader>
          <CardTitle className="text-slate-50">Funnel Styles</CardTitle>
          <CardDescription className="text-slate-400">
            Manage image generation styles used in the funnel.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">
              {rows.length} styles
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-xl border-slate-800 bg-slate-900 text-slate-100"
                onClick={() => load()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>

              <Button className="rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                New Style
              </Button>
            </div>
          </div>

          <Separator className="bg-slate-800" />

          {/* Styles list */}
          <div className="grid gap-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-100">
                    {row.title || "Untitled style"}
                  </div>

                  <div className="text-sm text-slate-400">
                    {row.occasion || "general"} • {row.style_id}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      row.isactive
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-slate-700 text-slate-300"
                    }
                  >
                    {row.isactive ? "active" : "inactive"}
                  </Badge>

                  <Button
                    variant="outline"
                    className="rounded-xl border-slate-800 bg-slate-900 text-slate-100"
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}

            {!loading && rows.length === 0 && (
              <div className="text-center text-slate-400 py-10">
                No funnel styles yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}