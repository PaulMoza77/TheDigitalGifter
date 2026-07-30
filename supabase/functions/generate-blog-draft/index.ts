import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { assertAdmin, getAuthUser, readJson } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await getAuthUser(req);
    await assertAdmin(user?.email);
    const body = await readJson<{
      topic?: string;
      current_title?: string;
      target_brand?: string;
      target_audience?: string;
    }>(req);

    if (!Deno.env.get("OPENAI_API_KEY") && !Deno.env.get("ANTHROPIC_API_KEY")) {
      return jsonResponse({ error: "OPENAI_API_KEY or ANTHROPIC_API_KEY required" }, 503);
    }

    const instructions = `Write a blog draft JSON for ${body.target_brand || "TheDigitalGifter"}.
Audience: ${body.target_audience || "people creating personalized AI greeting cards"}
Topic: ${body.topic || body.current_title || "AI greeting cards"}
Current title: ${body.current_title || ""}
Return JSON keys: title, slug, meta_title, meta_description, excerpt, content, image_prompt, cta_label, cta_url, internal_links (array of {anchor_text,url,placement_note}), faq (array of {question,answer}).`;

    let parsed: Record<string, unknown> = {};
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
            { role: "system", content: "You are an SEO content writer. Return JSON only." },
            { role: "user", content: instructions },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "OpenAI failed");
      parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
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
          max_tokens: 2500,
          messages: [{ role: "user", content: instructions + "\nJSON only." }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Anthropic failed");
      const text = data.content?.[0]?.text || "{}";
      parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    }

    return jsonResponse(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("Admin") || message.includes("Forbidden") ? 403 : 500;
    return jsonResponse({ error: message }, status);
  }
});
