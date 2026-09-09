import {
  CHRISTMAS_SEO_SELECT,
  normalizeSeoPageRow,
} from "../../../src/features/christmas/seo/row";
import type { ChristmasSeoLocale, ChristmasSeoPageRow } from "../../../src/features/christmas/seo/types";
import { getServiceClient } from "./supabaseClient";

export async function fetchChristmasSeoPageByPath(
  canonicalPath: string,
  locale: ChristmasSeoLocale,
): Promise<ChristmasSeoPageRow | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("seo_pages")
    .select(CHRISTMAS_SEO_SELECT)
    .eq("canonical_path", canonicalPath)
    .eq("locale", locale)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeSeoPageRow(data as Record<string, unknown>);
}

export async function listActiveChristmasSeoPages(): Promise<ChristmasSeoPageRow[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("seo_pages")
    .select(`${CHRISTMAS_SEO_SELECT}, updated_at, created_at`)
    .eq("is_active", true)
    .in("cluster", ["gifts-for", "messages-for", "messages-intent"])
    .order("canonical_path", { ascending: true })
    .order("locale", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => normalizeSeoPageRow(row));
}

export type ChristmasSeoSitemapRow = ChristmasSeoPageRow & {
  updated_at?: string | null;
  created_at?: string | null;
};

export async function listChristmasSeoSitemapRows(): Promise<ChristmasSeoSitemapRow[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("seo_pages")
    .select(`${CHRISTMAS_SEO_SELECT}, updated_at, created_at`)
    .eq("is_active", true)
    .in("cluster", ["gifts-for", "messages-for", "messages-intent"])
    .order("canonical_path", { ascending: true })
    .order("locale", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...normalizeSeoPageRow(row),
    updated_at: (row.updated_at as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
  }));
}
