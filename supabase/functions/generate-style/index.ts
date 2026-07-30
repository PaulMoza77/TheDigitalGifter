import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { assertAdmin, getAuthUser, readJson } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await getAuthUser(req);
    if (!user) return jsonResponse({ error: "Authentication required" }, 401);
    await assertAdmin(user.email);

    const body = await readJson<{
      occasion?: string;
      notes?: string;
      existing_style_ids?: string[];
    }>(req);

    const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "OPENAI_API_KEY or ANTHROPIC_API_KEY required" }, 503);
    }

    const occasion = String(body.occasion || "general");
    const notes = String(body.notes || "");
    const existing = Array.isArray(body.existing_style_ids) ? body.existing_style_ids : [];

    const system =
      "You invent unique AI photo-card styles for TheDigitalGifter. Return strict JSON with keys title, prompt, style_id.";
    const userPrompt = `Occasion: ${occasion}\nNotes: ${notes}\nAvoid style_ids: ${existing.join(", ") || "(none)"}`;

    let title = "";
    let prompt = "";
    let style_id = "";

    if (Deno.env.get("OPENAI_API_KEY")) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "OpenAI failed");
      const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
      title = String(parsed.title || "");
      prompt = String(parsed.prompt || "");
      style_id = String(parsed.style_id || "");
    } else {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: Deno.env.get("ANTHROPIC_MODEL") || "claude-3-5-haiku-latest",
          max_tokens: 800,
          messages: [
            {
              role: "user",
              content: `${system}\n\n${userPrompt}\nRespond with JSON only.`,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Anthropic failed");
      const text = data.content?.[0]?.text || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      title = String(parsed.title || "");
      prompt = String(parsed.prompt || "");
      style_id = String(parsed.style_id || "");
    }

    if (!title || !prompt) return jsonResponse({ error: "Model returned incomplete style" }, 502);
    if (!style_id) {
      style_id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }

    return jsonResponse({ title, prompt, style_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("Admin") || message.includes("Forbidden") ? 403 : 500;
    return jsonResponse({ error: message }, status);
  }
});
