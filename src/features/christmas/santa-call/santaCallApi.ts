const CALL_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-santa-call`;

async function anonHeaders(): Promise<Record<string, string>> {
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
  return {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  };
}

async function post(body: Record<string, unknown>) {
  const res = await fetch(CALL_URL, {
    method: "POST",
    headers: await anonHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function resolveSantaCall(accessToken: string) {
  const { res, data } = await post({ action: "resolve", access_token: accessToken });
  return { ok: res.ok, status: res.status, data };
}

export async function startSantaCall(accessToken: string, clientFingerprint: string) {
  const { res, data } = await post({
    action: "start",
    access_token: accessToken,
    client_fingerprint: clientFingerprint,
  });
  return { ok: res.ok, status: res.status, data };
}

export async function heartbeatSantaCall(input: {
  accessToken: string;
  sessionId: string;
  secondsElapsed: number;
  uiStatus?: string;
}) {
  const { res, data } = await post({
    action: "heartbeat",
    access_token: input.accessToken,
    session_id: input.sessionId,
    seconds_elapsed: input.secondsElapsed,
    ui_status: input.uiStatus,
  });
  return { ok: res.ok, data };
}

export async function endSantaCall(input: {
  accessToken: string;
  sessionId: string;
  secondsElapsed: number;
  reason: string;
  keepRemaining?: boolean;
  provider?: string;
  errorCode?: string;
  resumeSummary?: string;
  resumeLanguage?: string;
}) {
  const { res, data } = await post({
    action: "end",
    access_token: input.accessToken,
    session_id: input.sessionId,
    seconds_elapsed: input.secondsElapsed,
    reason: input.reason,
    keep_remaining: input.keepRemaining === true,
    provider: input.provider || "openai_realtime",
    error_code: input.errorCode,
    resume_summary: input.resumeSummary,
    resume_language: input.resumeLanguage,
  });
  return { ok: res.ok, data };
}

export async function createSantaCallExtensionCheckout(input: {
  accessToken: string;
  successUrl?: string;
}) {
  const { res, data } = await post({
    action: "create_extension_checkout",
    access_token: input.accessToken,
    success_url: input.successUrl,
  });
  return { ok: res.ok, status: res.status, data };
}

export async function pollSantaCallExtension(accessToken: string) {
  const { res, data } = await post({ action: "poll_extension", access_token: accessToken });
  return { ok: res.ok, data };
}

/** Parent iPhone QA: Stripe TEST checkout gated by page access token (not QA automation secret). */
export async function createSantaCallParentTestCheckout(input: {
  pageAccess: string;
  childFirstName: string;
  language: "en" | "ro";
  market: "ro" | "us";
  email: string;
  age?: string;
  christmasWish?: string;
  hobbies?: string;
  successUrl?: string;
  cancelUrl?: string;
}) {
  const res = await fetch(CALL_URL, {
    method: "POST",
    headers: {
      ...(await anonHeaders()),
      "X-Santa-QA-Page-Access": input.pageAccess,
    },
    body: JSON.stringify({
      action: "create_parent_test_checkout",
      page_access: input.pageAccess,
      child_first_name: input.childFirstName,
      language: input.language,
      market: input.market,
      email: input.email,
      age: input.age,
      christmas_wish: input.christmasWish,
      hobbies: input.hobbies,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function getOrCreateCallFingerprint(): string {
  const key = "tdg_santa_call_fp";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem(key, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}
