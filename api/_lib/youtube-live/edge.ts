import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

export async function invokeYouTubeLiveEdge<T>(
  action: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    throw Object.assign(new Error("YouTube OAuth backend is not configured."), { status: 503 });
  }
  const response = await fetch(`${supabaseUrl}/functions/v1/social-publisher`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...body }),
  });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw Object.assign(new Error(json.error || `YouTube backend HTTP ${response.status}`), {
      status: response.status,
      payload: json,
    });
  }
  return json;
}

export async function resumableUploadLocalMp4(input: {
  accessToken: string;
  filePath: string;
  title: string;
  description: string;
  privacyStatus: string;
  madeForKids: boolean;
  tags?: string[];
}): Promise<{ videoId: string; watchUrl: string }> {
  if (!existsSync(input.filePath)) {
    throw new Error("The long-form file is not on this server.");
  }
  const size = (await stat(input.filePath)).size;
  const start = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(size),
      },
      body: JSON.stringify({
        snippet: {
          title: input.title.slice(0, 100),
          description: input.description.slice(0, 5000),
          categoryId: "24",
          tags: input.tags || ["christmas", "ambience"],
        },
        status: {
          privacyStatus: input.privacyStatus,
          selfDeclaredMadeForKids: input.madeForKids === true,
        },
      }),
    },
  );
  const uploadUri = start.headers.get("location") || "";
  if (!start.ok || !uploadUri) {
    const text = await start.text();
    throw new Error(`YouTube upload init failed (${start.status}): ${text.slice(0, 300)}`);
  }
  const nodeStream = createReadStream(input.filePath);
  const upload = await fetch(uploadUri, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
    },
    body: Readable.toWeb(nodeStream) as unknown as BodyInit,
    duplex: "half",
  } as RequestInit);
  const json = (await upload.json()) as { id?: string; error?: { message?: string } };
  const videoId = String(json.id || "").trim();
  if (!upload.ok || !videoId) {
    throw new Error(json.error?.message || `YouTube upload failed (${upload.status})`);
  }
  return { videoId, watchUrl: `https://www.youtube.com/watch?v=${videoId}` };
}
