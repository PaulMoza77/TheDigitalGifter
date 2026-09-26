import { jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, requiredEnv } from "../_shared/supabase.ts";
import {
  REQUEST_UNAVAILABLE_MESSAGE,
  TEMPLATE_UNAVAILABLE_MESSAGE,
  describesExplicitContent,
  describesIntimateContact,
  isProhibitedIdentity,
  isTemplateAllowed,
} from "../_shared/contentPolicy.ts";
import { uploadBytesToHiggsfield, pollHiggsfieldImage, submitHiggsfieldImage } from "../_shared/higgsfieldClient.ts";
import {
  GENERATION_UNAVAILABLE_MESSAGE,
  GENERATOR_SOURCE_BUCKET,
  HIGGSFIELD_IMAGE_MODEL,
  HIGGSFIELD_IMAGE_RESOLUTION,
  HIGGSFIELD_PROVIDER,
  MAX_GENERATOR_SOURCE_IMAGES,
  aspectRatioForStoredGeneration,
  authoritativeCreditCost,
  buildGeneratorPrompt,
  higgsfieldImageRequest,
  legacyGeneratorSourceUrl,
  providerAction,
  readHiggsfieldAuthorization,
  sniffStoredImage,
  templateImageUrl,
} from "../_shared/higgsfieldImage.ts";

type ServiceClient = ReturnType<typeof getServiceClient>;

type GenerationRow = {
  id: string;
  user_id?: string | null;
  email?: string | null;
  template_id?: string | null;
  title?: string | null;
  prompt?: string | null;
  status?: string | null;
  source_image_url?: string | null;
  final_image_url?: string | null;
  result_image_url?: string | null;
  style_id?: string | null;
  style_slug?: string | null;
  metadata?: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function ledgerBalance(rows: Array<{ direction?: string | null; credits?: number | string | null }> | null) {
  return (rows ?? []).reduce((sum, row) => {
    const value = Number(row.credits ?? 0);
    if (!Number.isFinite(value)) return sum;
    if (row.direction === "in") return sum + value;
    if (row.direction === "out") return sum - value;
    return sum;
  }, 0);
}

async function markFailed(service: ServiceClient, generationId: string, message: string) {
  await service.from("generations").update({ status: "failed", error: message }).eq("id", generationId);
}

async function readGeneration(service: ServiceClient, generationId: string): Promise<GenerationRow | null> {
  const { data, error } = await service.from("generations").select("*").eq("id", generationId).maybeSingle();
  if (error) throw error;
  return (data as GenerationRow | null) ?? null;
}

function sourcePaths(generation: GenerationRow): string[] {
  const metadata = asRecord(generation.metadata);
  const raw = metadata.source_storage_paths;
  const values = Array.isArray(raw) ? raw : [];
  const owner = String(generation.user_id || "").trim();
  const paths: string[] = [];
  for (const value of values) {
    const path = String(value ?? "").trim().replace(/^\/+/, "");
    if (!path || path.includes("..")) continue;
    if (!owner || !path.startsWith(`${owner}/`)) continue;
    if (!paths.includes(path)) paths.push(path);
    if (paths.length >= MAX_GENERATOR_SOURCE_IMAGES) break;
  }
  return paths;
}

async function downloadStorageFile(service: ServiceClient, bucket: string, path: string): Promise<Uint8Array> {
  const { data, error } = await service.storage.from(bucket).download(path);
  if (error || !data) throw new Error(GENERATION_UNAVAILABLE_MESSAGE);
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength < 32 || bytes.byteLength > 10 * 1024 * 1024) {
    throw new Error(GENERATION_UNAVAILABLE_MESSAGE);
  }
  return bytes;
}

async function downloadRemoteImage(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(GENERATION_UNAVAILABLE_MESSAGE);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 32 || bytes.byteLength > 15 * 1024 * 1024) {
    throw new Error(GENERATION_UNAVAILABLE_MESSAGE);
  }
  const sniffed = sniffStoredImage(bytes);
  return { bytes, contentType: sniffed.contentType };
}

export async function handlePublicGenerator(input: {
  service: ServiceClient;
  generation: GenerationRow;
  userEmail: string;
  admin: boolean;
  serviceRole: boolean;
  paid: boolean;
}): Promise<Response> {
  const { service } = input;
  let generation = input.generation;
  const generationId = String(generation.id);
  const metadata = asRecord(generation.metadata);

  const existingUrl = String(generation.final_image_url || generation.result_image_url || "").trim();
  if (generation.status === "completed" && existingUrl) {
    return jsonResponse({
      imageUrl: existingUrl,
      generation_id: generationId,
      status: "completed",
      contentType: String(metadata.result_content_type || ""),
    });
  }

  const templateId = String(generation.template_id || "").trim();
  if (!templateId) {
    await markFailed(service, generationId, "Choose a style before creating.");
    return jsonResponse({ error: "Choose a style before creating." }, 400);
  }

  const { data: templateRow, error: templateError } = await service
    .from("templates")
    .select("id,title,style_id,slug,prompt,is_active,occasion,credit_cost,creditcost,preview_image_url,preview_url,previewurl,thumbnail_url,thumbnailurl")
    .eq("id", templateId)
    .maybeSingle();
  if (templateError) throw templateError;
  if (!templateRow || templateRow.is_active === false || !isTemplateAllowed(templateRow)) {
    await markFailed(service, generationId, TEMPLATE_UNAVAILABLE_MESSAGE);
    return jsonResponse({ error: TEMPLATE_UNAVAILABLE_MESSAGE }, 403);
  }

  const aspectRatio = aspectRatioForStoredGeneration(metadata.aspect_ratio);
  if (!aspectRatio) {
    await markFailed(service, generationId, "Choose a supported image size.");
    return jsonResponse({ error: "Choose a supported image size." }, 400);
  }

  let creditCost: number;
  try {
    creditCost = authoritativeCreditCost(
      templateRow.credit_cost ?? (templateRow as { creditcost?: unknown }).creditcost,
    );
  } catch {
    await markFailed(service, generationId, GENERATION_UNAVAILABLE_MESSAGE);
    return jsonResponse({ error: GENERATION_UNAVAILABLE_MESSAGE }, 503);
  }

  const paths = sourcePaths(generation);
  const legacySourceUrl = paths.length === 0 ? legacyGeneratorSourceUrl(generation.source_image_url) : null;
  const templateUrl = templateImageUrl(templateRow as Record<string, unknown>);
  if (paths.length === 0 && !legacySourceUrl) {
    await markFailed(service, generationId, "Upload a photo before creating.");
    return jsonResponse({ error: "Upload a photo before creating." }, 400);
  }
  if (!templateUrl) {
    await markFailed(service, generationId, "This style is missing its preview. Please choose another.");
    return jsonResponse({ error: "This style is missing its preview. Please choose another." }, 400);
  }

  const personalizedName = String(metadata.personalized_name || "").trim();
  const userInstructions = String(metadata.user_instructions || "").trim().slice(0, 2000);
  const prompt = buildGeneratorPrompt({
    sourceCount: paths.length || 1,
    templateTitle: templateRow.title,
    occasion: templateRow.occasion,
    templatePrompt: templateRow.prompt,
    userInstructions,
    personalizedName,
  });

  if (
    isProhibitedIdentity({
      id: templateRow.id,
      style_id: templateRow.style_id,
      slug: templateRow.slug,
      title: templateRow.title,
      prompt,
    }) ||
    describesIntimateContact(prompt) ||
    describesExplicitContent(prompt)
  ) {
    await markFailed(service, generationId, REQUEST_UNAVAILABLE_MESSAGE);
    return jsonResponse({ error: REQUEST_UNAVAILABLE_MESSAGE }, 403);
  }

  if (!input.serviceRole && !input.admin && !input.paid) {
    const creditKey = String(input.userEmail || generation.email || "").trim().toLowerCase();
    const { data: ledgerRows } = await service
      .from("credits_ledger")
      .select("direction, credits")
      .eq("user_convex_id", creditKey);
    const balance = ledgerBalance(
      ledgerRows as Array<{ direction?: string | null; credits?: number | string | null }>,
    );
    if (balance < creditCost) {
      await markFailed(service, generationId, "Not enough credits. Purchase credits or complete checkout before generating.");
      return jsonResponse(
        { error: "Not enough credits. Purchase credits or complete checkout before generating." },
        402,
      );
    }
  }

  await service
    .from("generations")
    .update({
      credit_cost: creditCost,
      credits: creditCost,
      prompt,
      error: null,
    })
    .eq("id", generationId);

  const authorization = readHiggsfieldAuthorization({ get: (name) => Deno.env.get(name) });
  if (!authorization) {
    await markFailed(service, generationId, GENERATION_UNAVAILABLE_MESSAGE);
    return jsonResponse({ error: GENERATION_UNAVAILABLE_MESSAGE }, 503);
  }

  const claim = crypto.randomUUID();
  const { data: claimData, error: claimError } = await service.rpc("claim_public_generator_submit", {
    p_id: generationId,
    p_claim: claim,
  });
  if (claimError) {
    return jsonResponse({ error: GENERATION_UNAVAILABLE_MESSAGE }, 503);
  }
  const claimRecord = asRecord(claimData);
  generation = (await readGeneration(service, generationId)) || generation;
  const action = providerAction({
    status: generation.status,
    providerRequestId: asRecord(generation.metadata).provider_request_id as string,
    providerOutputUrl: asRecord(generation.metadata).provider_output_url as string,
    finalImageUrl: generation.final_image_url || generation.result_image_url,
  });
  if (action === "return_completed") {
    return jsonResponse({
      imageUrl: generation.final_image_url || generation.result_image_url,
      generation_id: generationId,
      status: "completed",
    });
  }

  const started = Date.now();
  let requestId = String(asRecord(generation.metadata).provider_request_id || "").trim();
  let outputUrl = String(asRecord(generation.metadata).provider_output_url || "").trim();

  try {
    if (!outputUrl && !requestId) {
      if (claimRecord.claimed !== true) {
        return jsonResponse({ generation_id: generationId, status: "processing" }, 202);
      }
      const hosted: string[] = [];
      for (const path of paths) {
        const bytes = await downloadStorageFile(service, GENERATOR_SOURCE_BUCKET, path);
        const contentType = sniffStoredImage(bytes).contentType;
        hosted.push(await uploadBytesToHiggsfield(authorization, bytes, contentType));
      }
      if (hosted.length === 0 && legacySourceUrl) {
        const legacyImage = await downloadRemoteImage(legacySourceUrl);
        hosted.push(
          await uploadBytesToHiggsfield(authorization, legacyImage.bytes, legacyImage.contentType),
        );
      }
      const templateImage = await downloadRemoteImage(templateUrl);
      hosted.push(
        await uploadBytesToHiggsfield(authorization, templateImage.bytes, templateImage.contentType),
      );
      const request = higgsfieldImageRequest({
        prompt,
        aspectRatio,
        imageReferences: hosted,
      });
      requestId = await submitHiggsfieldImage(authorization, request.path, request.body);
      const nextMetadata = {
        ...asRecord(generation.metadata),
        provider: HIGGSFIELD_PROVIDER,
        model: HIGGSFIELD_IMAGE_MODEL,
        provider_request_id: requestId,
        aspect_ratio: aspectRatio,
        resolution: HIGGSFIELD_IMAGE_RESOLUTION,
        source_reference_count: paths.length || 1,
        template_reference_included: true,
        reference_count: hosted.length,
      };
      await service
        .from("generations")
        .update({ metadata: nextMetadata, status: "processing", error: null })
        .eq("id", generationId);
      generation = { ...generation, metadata: nextMetadata };
    }

    if (!outputUrl && requestId) {
      const polled = await pollHiggsfieldImage(authorization, requestId);
      if (!polled.done) {
        return jsonResponse({ generation_id: generationId, status: "processing" }, 202);
      }
      if (polled.failed || !polled.imageUrl) {
        await markFailed(service, generationId, GENERATION_UNAVAILABLE_MESSAGE);
        return jsonResponse({ error: GENERATION_UNAVAILABLE_MESSAGE }, 502);
      }
      outputUrl = polled.imageUrl;
      const withOutput = {
        ...asRecord(generation.metadata),
        provider: HIGGSFIELD_PROVIDER,
        model: HIGGSFIELD_IMAGE_MODEL,
        provider_request_id: requestId,
        provider_output_url: outputUrl,
        aspect_ratio: aspectRatio,
        resolution: HIGGSFIELD_IMAGE_RESOLUTION,
      };
      await service.from("generations").update({ metadata: withOutput }).eq("id", generationId);
      generation = { ...generation, metadata: withOutput };
    }

    const rendered = await downloadRemoteImage(outputUrl);
    const sniffed = sniffStoredImage(rendered.bytes);
    const objectPath = `generations/${generationId}.${sniffed.extension}`;
    const { error: uploadError } = await service.storage.from("generated-images").upload(objectPath, rendered.bytes, {
      contentType: sniffed.contentType,
      upsert: true,
    });
    if (uploadError) throw new Error(GENERATION_UNAVAILABLE_MESSAGE);

    const publicUrl = `${requiredEnv("SUPABASE_URL")}/storage/v1/object/public/generated-images/${objectPath}`;
    const durationMs = Date.now() - started;
    const finalMetadata = {
      ...asRecord(generation.metadata),
      provider: HIGGSFIELD_PROVIDER,
      model: HIGGSFIELD_IMAGE_MODEL,
      provider_request_id: requestId,
      provider_output_url: outputUrl,
      aspect_ratio: aspectRatio,
      resolution: HIGGSFIELD_IMAGE_RESOLUTION,
      duration_ms: durationMs,
      result_content_type: sniffed.contentType,
      result_extension: sniffed.extension,
      template_reference_included: true,
    };
    const { error: completeError } = await service
      .from("generations")
      .update({
        status: "completed",
        credit_cost: creditCost,
        credits: creditCost,
        final_image_url: publicUrl,
        result_image_url: publicUrl,
        preview_image_url: publicUrl,
        error: null,
        metadata: finalMetadata,
      })
      .eq("id", generationId)
      .neq("status", "completed");
    if (completeError) throw completeError;

    return jsonResponse({
      imageUrl: publicUrl,
      generation_id: generationId,
      status: "completed",
      contentType: sniffed.contentType,
    });
  } catch {
    const latest = await readGeneration(service, generationId);
    if (latest?.status === "completed" && (latest.final_image_url || latest.result_image_url)) {
      return jsonResponse({
        imageUrl: latest.final_image_url || latest.result_image_url,
        generation_id: generationId,
        status: "completed",
      });
    }
    const knownRequestId = String(asRecord(latest?.metadata).provider_request_id || requestId || "").trim();
    if (knownRequestId) {
      const recovered = {
        ...asRecord(latest?.metadata),
        provider: HIGGSFIELD_PROVIDER,
        model: HIGGSFIELD_IMAGE_MODEL,
        provider_request_id: knownRequestId,
        aspect_ratio: aspectRatio,
        resolution: HIGGSFIELD_IMAGE_RESOLUTION,
        ...(outputUrl ? { provider_output_url: outputUrl } : {}),
      };
      await service
        .from("generations")
        .update({ status: "processing", error: null, metadata: recovered })
        .eq("id", generationId);
      return jsonResponse({ generation_id: generationId, status: "processing" }, 202);
    }
    await markFailed(service, generationId, GENERATION_UNAVAILABLE_MESSAGE);
    return jsonResponse({ error: GENERATION_UNAVAILABLE_MESSAGE }, 502);
  }
}
