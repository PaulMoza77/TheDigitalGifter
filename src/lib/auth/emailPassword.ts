import type { SupabaseClient } from "@supabase/supabase-js";

export type EmailAuthResult =
  | { ok: true; needsConfirmation?: boolean }
  | { ok: false; error: string };

function cleanEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function signInWithEmailPassword(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<EmailAuthResult> {
  const { error } = await client.auth.signInWithPassword({
    email: cleanEmail(email),
    password,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function createAccountWithEmailPassword(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<EmailAuthResult> {
  const { data, error } = await client.auth.signUp({
    email: cleanEmail(email),
    password,
  });
  if (error) return { ok: false, error: error.message };
  if (!data.session) {
    return { ok: true, needsConfirmation: true };
  }
  return { ok: true, needsConfirmation: false };
}
