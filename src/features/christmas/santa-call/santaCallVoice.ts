/** Keep in sync with supabase/functions/_shared/christmas/santaCallProviders.ts */

export const SANTA_CALL_OPENAI_VOICE_DEFAULT = "ash" as const;

const ALLOWED = new Set([
  "ash",
  "cedar",
  "marin",
  "echo",
  "verse",
  "ballad",
  "coral",
  "sage",
  "shimmer",
]);

export function resolveSantaCallOpenAiVoice(envValue?: string | null): string {
  const raw = String(envValue || "")
    .trim()
    .toLowerCase();
  if (raw && ALLOWED.has(raw)) return raw;
  return SANTA_CALL_OPENAI_VOICE_DEFAULT;
}
