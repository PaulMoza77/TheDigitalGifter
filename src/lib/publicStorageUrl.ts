/**
 * The project storage host returns 402 once the storage quota is exceeded.
 * The same objects are served from the public project domain.
 * Keep preview URLs on that domain so generator style cards can load.
 */
const BLOCKED_STORAGE_ORIGIN = "https://kjlsocejpmnzhhduyumy.supabase.co";
const PUBLIC_STORAGE_ORIGIN = "https://supabase.thedigitalgifter.com";

export function reachablePublicStorageUrl(value: unknown): string {
  const url = String(value ?? "").trim();
  const prefix = `${BLOCKED_STORAGE_ORIGIN}/storage/v1/object/`;
  if (!url.startsWith(prefix)) return url;
  return `${PUBLIC_STORAGE_ORIGIN}${url.slice(BLOCKED_STORAGE_ORIGIN.length)}`;
}
