/** Client API for Christmas generation result share. Service-mediated; no mock data. */

const SHARE_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/christmas-result-share`;

export type OwnerShareState = {
  ok: true;
  share_enabled: boolean;
  generation_id: string | null;
  share_token?: string | null;
  share_path?: string | null;
};

export type SharedResult = {
  ok: true;
  generation_id: string;
  product_key: string | null;
  asset_kind: string | null;
  style_key: string | null;
  resultUrl: string | null;
};

async function headers(): Promise<Record<string, string>> {
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
  return {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  };
}

async function resultShare<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(SHARE_URL, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `result_share_${res.status}`);
  }
  return data;
}

export async function getSharedResult(generationId: string, token: string): Promise<SharedResult> {
  return resultShare<SharedResult>({
    action: "getSharedResult",
    generation_id: generationId,
    token,
  });
}

export async function getOwnerResultShare(publicToken: string): Promise<OwnerShareState> {
  return resultShare<OwnerShareState>({
    action: "getOwnerShare",
    public_token: publicToken,
  });
}

export async function enableResultShare(publicToken: string): Promise<OwnerShareState> {
  return resultShare<OwnerShareState>({
    action: "enableShare",
    public_token: publicToken,
  });
}

export async function revokeResultShare(publicToken: string): Promise<OwnerShareState> {
  return resultShare<OwnerShareState>({
    action: "revokeShare",
    public_token: publicToken,
  });
}
