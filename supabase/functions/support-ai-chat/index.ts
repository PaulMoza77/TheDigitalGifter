import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { readJson } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<{
      ticketId?: string;
      message?: string;
      pageUrl?: string;
      subject?: string;
      recentMessages?: Array<{ role: string; content: string }>;
    }>(req);

    const message = String(body.message || "").trim();
    if (!message) return jsonResponse({ error: "message required" }, 400);

    const recent = Array.isArray(body.recentMessages) ? body.recentMessages.slice(-12) : [];
    const system =
      "You are TheDigitalGifter support. Be concise and helpful. If the user asks for a human, set needsAgent true.";

    if (!Deno.env.get("OPENAI_API_KEY") && !Deno.env.get("ANTHROPIC_API_KEY")) {
      // Graceful fallback without provider
      return jsonResponse({
        reply:
          "Thanks for reaching out! Our AI assistant is temporarily unavailable. A team member will reply soon.",
        needsAgent: true,
      });
    }

    let reply = "";
    let needsAgent = false;

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
            { role: "system", content: system + " Return JSON {reply, needsAgent}." },
            ...recent.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
            {
              role: "user",
              content: `Subject: ${body.subject || ""}\nPage: ${body.pageUrl || ""}\nMessage: ${message}`,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "OpenAI failed");
      const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
      reply = String(parsed.reply || "");
      needsAgent = Boolean(parsed.needsAgent);
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
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: `${system}\nRecent: ${JSON.stringify(recent)}\nMessage: ${message}\nJSON {reply,needsAgent}`,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Anthropic failed");
      const text = data.content?.[0]?.text || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      reply = String(parsed.reply || "");
      needsAgent = Boolean(parsed.needsAgent);
    }

    return jsonResponse({ reply, message: reply, needsAgent });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
