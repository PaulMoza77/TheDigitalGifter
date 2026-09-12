import { supabase } from "@/lib/supabase";
import { normalizeCanonicalPath } from "./factory";
import { CHRISTMAS_SEO_SELECT, normalizeSeoPageRow } from "./row";
import type { ChristmasSeoLocale, ChristmasSeoPageRow } from "./types";

export { CHRISTMAS_SEO_SELECT, normalizeSeoPageRow } from "./row";

export async function fetchChristmasSeoPage(
  canonicalPath: string,
  locale: ChristmasSeoLocale,
): Promise<ChristmasSeoPageRow | null> {
  const path = normalizeCanonicalPath(canonicalPath);
  const { data, error } = await supabase
    .from("seo_pages")
    .select(CHRISTMAS_SEO_SELECT)
    .eq("canonical_path", path)
    .eq("locale", locale)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeSeoPageRow(data as Record<string, unknown>);
}
