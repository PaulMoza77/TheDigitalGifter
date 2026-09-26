import { getServiceClient } from "../christmas/supabaseClient";
import { CONCEPT_FAMILIES, type ConceptFamily, type ResearchCandidate } from "./types";
import { dedupeKey, isNearDuplicate, normalizeConceptText } from "./dedupe";
import { bumpUsage, logEvent, utcToday } from "./settings";
import { refreshConceptPerformance } from "./performance";

function openaiKey(): string {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

export function researchConfigured(): boolean {
  return openaiKey().length > 0;
}

async function openaiJson(body: Record<string, unknown>) {
  const key = openaiKey();
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(json?.error?.message || `openai_${res.status}`));
  }
  return json;
}

function parseCandidates(raw: string, limit: number): ResearchCandidate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const rows = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { candidates?: unknown }).candidates) ? (parsed as { candidates: unknown[] }).candidates : [];
  const out: ResearchCandidate[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const family = String(record.concept_family || record.conceptFamily || "").trim();
    if (!(CONCEPT_FAMILIES as readonly string[]).includes(family)) continue;
    const concept = String(record.concept || "").trim();
    const hook = String(record.hook || "").trim();
    const conceptDescription = String(record.concept_description || record.conceptDescription || concept).trim();
    const platformsRaw = record.target_platforms || record.targetPlatforms;
    const targetPlatforms = Array.isArray(platformsRaw)
      ? platformsRaw.map((p) => String(p).trim()).filter(Boolean)
      : ["instagram", "tiktok", "youtube"];
    if (!concept || !hook) continue;
    out.push({
      conceptFamily: family as ConceptFamily,
      concept,
      hook,
      conceptDescription,
      targetPlatforms,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function runDailyResearch(input: {
  candidateLimit: number;
  performanceHints: string;
}): Promise<{ inserted: number; duplicates: number }> {
  const service = getServiceClient();
  const today = utcToday();
  const { data: existingToday } = await service
    .from("content_concepts")
    .select("id")
    .eq("usage_date", today)
    .limit(1);
  if ((existingToday || []).length > 0) {
    return { inserted: 0, duplicates: 0 };
  }

  await refreshConceptPerformance();

  const { data: priorRows } = await service
    .from("content_concepts")
    .select("concept,hook,concept_family,publication_count,performance_summary")
    .order("created_at", { ascending: false })
    .limit(200);
  const priorConcepts = (priorRows || []).map((row) => String(row.concept || ""));
  const performanceLines = (priorRows || [])
    .filter((row) => Number(row.publication_count || 0) > 0)
    .slice(0, 40)
    .map((row) => {
      const summary = (row.performance_summary || {}) as Record<string, unknown>;
      return `${row.concept_family}: ${row.concept} publications=${row.publication_count} platforms=${JSON.stringify(summary.platforms || {})}`;
    });

  const response = await openaiJson({
    model: "gpt-4o-mini",
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You research VISUAL short-form Christmas/winter concepts for The Digital Gifter. Focus on repeatable visual hooks (choose 1-4, cozy rooms, trains, wolves, luxury chalets, nostalgia). Return JSON { candidates: [...] } only.",
      },
      {
        role: "user",
        content: [
          `Generate exactly ${input.candidateLimit} distinct visual concepts.`,
          `Allowed concept_family values: ${CONCEPT_FAMILIES.join(", ")}.`,
          "Each candidate needs: concept_family, concept, hook, concept_description, target_platforms (subset of instagram,tiktok,youtube,facebook).",
          "Avoid generic trending news. Prefer comment-driving visual hooks and TDG Christmas aesthetic.",
          input.performanceHints || performanceLines.join("\n") || "No prior TDG performance yet — explore evenly.",
        ].join("\n"),
      },
    ],
  });
  const content = String(response?.choices?.[0]?.message?.content || "");
  const parsed = parseCandidates(content, input.candidateLimit);
  let inserted = 0;
  let duplicates = 0;
  for (const candidate of parsed) {
    if (isNearDuplicate(priorConcepts, candidate.concept) || isNearDuplicate(priorConcepts, candidate.hook)) {
      duplicates += 1;
      continue;
    }
    const key = dedupeKey({
      conceptFamily: candidate.conceptFamily,
      concept: candidate.concept,
      hook: candidate.hook,
    });
    const { error } = await service.from("content_concepts").insert({
      usage_date: today,
      concept_family: candidate.conceptFamily,
      concept: candidate.concept,
      hook: candidate.hook,
      dedupe_key: key,
      concept_description: candidate.conceptDescription,
      target_platforms: candidate.targetPlatforms,
      pipeline_status: "candidate",
      classification: "test",
    });
    if (error) {
      if (String(error.message || "").includes("duplicate")) duplicates += 1;
      continue;
    }
    priorConcepts.push(candidate.concept);
    inserted += 1;
  }
  await bumpUsage({ research_candidates: inserted, research_completed: true });
  await logEvent("research_completed", { inserted, duplicates, requested: input.candidateLimit });
  return { inserted, duplicates };
}

export function classifyConcept(input: {
  conceptFamily: string;
  concept: string;
  priorFamilyPublications: number;
  isVariationOfWinner: boolean;
}): "repeat" | "test" | "skip" {
  if (input.priorFamilyPublications > 0 && input.isVariationOfWinner) return "repeat";
  if (input.priorFamilyPublications >= 2) return "repeat";
  return "test";
}

export async function selectDailyConcepts(productionLimit: number): Promise<{ selected: number; skipped: number }> {
  const service = getServiceClient();
  const today = utcToday();
  const usage = await bumpUsage({});
  if (Number(usage.production_concepts || 0) >= productionLimit) {
    return { selected: 0, skipped: 0 };
  }
  const remaining = productionLimit - Number(usage.production_concepts || 0);
  const { data: candidates } = await service
    .from("content_concepts")
    .select("*")
    .eq("usage_date", today)
    .eq("pipeline_status", "candidate")
    .order("created_at", { ascending: true });
  if (!candidates?.length) return { selected: 0, skipped: 0 };

  const { data: familyStats } = await service
    .from("content_concepts")
    .select("concept_family,publication_count")
    .eq("concept_status", "active");
  const familyPubs = new Map<string, number>();
  for (const row of familyStats || []) {
    const family = String(row.concept_family || "");
    familyPubs.set(family, (familyPubs.get(family) || 0) + Number(row.publication_count || 0));
  }

  const ranked = [...candidates].sort((a, b) => {
    const fa = familyPubs.get(String(a.concept_family)) || 0;
    const fb = familyPubs.get(String(b.concept_family)) || 0;
    return fb - fa;
  });

  let selected = 0;
  let skipped = 0;
  let repeatTarget = Math.ceil(remaining / 2);
  let testTarget = remaining - repeatTarget;

  for (const row of ranked) {
    if (selected >= remaining) {
      await service.from("content_concepts").update({ pipeline_status: "skipped", classification: "skip" }).eq("id", row.id);
      skipped += 1;
      continue;
    }
    const family = String(row.concept_family || "");
    const pubs = familyPubs.get(family) || 0;
    const classification = classifyConcept({
      conceptFamily: family,
      concept: String(row.concept || ""),
      priorFamilyPublications: pubs,
      isVariationOfWinner: normalizeConceptText(String(row.concept || "")).split(" ").length <= 8,
    });
    if (classification === "skip") {
      await service.from("content_concepts").update({ pipeline_status: "skipped", classification: "skip" }).eq("id", row.id);
      skipped += 1;
      continue;
    }
    if (classification === "repeat" && repeatTarget <= 0) continue;
    if (classification === "test" && testTarget <= 0 && repeatTarget <= 0) continue;
    if (classification === "repeat") repeatTarget -= 1;
    else testTarget -= 1;
    await service
      .from("content_concepts")
      .update({
        pipeline_status: "selected",
        classification,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    selected += 1;
  }

  if (selected > 0) {
    await bumpUsage({ production_concepts: selected });
    await logEvent("concepts_selected", { selected, skipped });
  }
  return { selected, skipped };
}
