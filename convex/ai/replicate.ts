// convex/ai/replicate.ts
import { Id } from "../_generated/dataModel";
import { ActionCtx } from "../_generated/server";

const REPLICATE_API_BASE = "https://api.replicate.com/v1";
// Using google/nano-banana for image-to-image transformation and multi-image fusion
const DEFAULT_MODEL = "google/nano-banana";
// Optional: Set REPLICATE_MODEL_VERSION_ID in environment to bypass version lookup
// This is useful if the API doesn't return versions or you want to use a specific version
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max (5s intervals)
const POLL_INTERVAL_MS = 5000;

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val || !val.trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return val.trim();
}

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[];
  error?: string;
  urls?: {
    get?: string;
    cancel?: string;
  };
}

interface GenerateImageOptions {
  inputImageUrls: string[]; // Array of image URLs for multi-image support
  promptTemplate: string;
  aspectRatio?: string;
  outputFormat?: string;
}

/**
 * Gets a public URL from Convex storage ID
 */
async function getStorageUrl(
  ctx: ActionCtx,
  storageId: Id<"_storage">
): Promise<string> {
  const url = await ctx.storage.getUrl(storageId);
  if (!url) {
    throw new Error(`Failed to get URL for storage ID: ${storageId}`);
  }
  return url;
}

/**
 * Verifies API token by making a simple API call
 */
async function verifyApiToken(apiToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${REPLICATE_API_BASE}/account`, {
      headers: {
        Authorization: `Token ${apiToken}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Gets the latest version ID for a model from Replicate API
 * Tries multiple approaches to get the version ID
 */
export async function getModelVersionId(
  apiToken: string,
  owner: string,
  modelName: string
): Promise<string> {
  const modelPath = `${owner}/${modelName}`;

  // Check if version ID is provided via environment variable (useful for debugging)
  const envVersionId = process.env.REPLICATE_MODEL_VERSION_ID;
  if (envVersionId && envVersionId.trim()) {
    console.log("[Replicate] Using version ID from environment variable", {
      versionId: envVersionId,
    });
    return envVersionId.trim();
  }

  // First, verify API token is valid
  const tokenValid = await verifyApiToken(apiToken);
  if (!tokenValid) {
    throw new Error(
      `Invalid Replicate API token. Please check your REPLICATE_API_TOKEN environment variable. ` +
        `Token starts with: ${apiToken.substring(0, 10)}...`
    );
  }

  console.log("[Replicate] API token verified, fetching model version", {
    modelPath,
  });

  // Approach 1: Try to get model details first (might include latest version)
  try {
    const modelResponse = await fetch(
      `${REPLICATE_API_BASE}/models/${modelPath}`,
      {
        headers: {
          Authorization: `Token ${apiToken}`,
        },
      }
    );

    if (modelResponse.ok) {
      const modelData = (await modelResponse.json()) as {
        latest_version?: { id?: string };
        default_version?: { id?: string };
        [key: string]: unknown;
      };

      console.log("[Replicate] Model details response", {
        hasLatestVersion: !!modelData.latest_version,
        hasDefaultVersion: !!modelData.default_version,
        modelDataKeys: Object.keys(modelData),
      });

      if (modelData.latest_version?.id) {
        const versionId = modelData.latest_version.id;
        // Validate version ID format (should be a long hash, not a short prediction ID)
        // Version IDs are typically 64-character hex strings
        if (versionId.length < 20) {
          console.warn(
            "[Replicate] Version ID seems too short, might be incorrect",
            {
              versionId,
              length: versionId.length,
            }
          );
        }
        console.log("[Replicate] Got version from model details", {
          versionId,
          length: versionId.length,
        });
        return versionId;
      }

      if (modelData.default_version?.id) {
        const versionId = modelData.default_version.id;
        // Validate version ID format
        if (versionId.length < 20) {
          console.warn(
            "[Replicate] Version ID seems too short, might be incorrect",
            {
              versionId,
              length: versionId.length,
            }
          );
        }
        console.log("[Replicate] Got version from default_version", {
          versionId,
          length: versionId.length,
        });
        return versionId;
      }

      // Log full response for debugging
      console.warn("[Replicate] Model details response missing version info", {
        modelData: JSON.stringify(modelData).substring(0, 500),
      });
    } else {
      const errorText = await modelResponse.text().catch(() => "");
      console.error("[Replicate] Model details request failed", {
        status: modelResponse.status,
        statusText: modelResponse.statusText,
        error: errorText,
        modelPath,
      });
    }
  } catch (error) {
    console.warn("[Replicate] Failed to fetch model details", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // Approach 2: Try to get versions list
  // Note: Some models (like flux-kontext-pro) don't expose versions endpoint (returns 404)
  // This is expected and not an error - we should have gotten the version from Approach 1
  try {
    const versionsResponse = await fetch(
      `${REPLICATE_API_BASE}/models/${modelPath}/versions`,
      {
        headers: {
          Authorization: `Token ${apiToken}`,
        },
      }
    );

    if (versionsResponse.ok) {
      const versionsData = (await versionsResponse.json()) as {
        results?: Array<{ id: string; created_at?: string }>;
        [key: string]: unknown;
      };

      console.log("[Replicate] Versions response", {
        hasResults: !!versionsData.results,
        resultsCount: versionsData.results?.length || 0,
      });

      if (versionsData.results && versionsData.results.length > 0) {
        // Sort by created_at (newest first) and return the latest
        const sortedVersions = versionsData.results.sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        });

        const latestVersionId = sortedVersions[0].id;
        // Validate version ID format
        if (latestVersionId.length < 20) {
          console.warn(
            "[Replicate] Version ID seems too short, might be incorrect",
            {
              versionId: latestVersionId,
              length: latestVersionId.length,
            }
          );
        }
        console.log("[Replicate] Got version from versions list", {
          versionId: latestVersionId,
          length: latestVersionId.length,
          totalVersions: sortedVersions.length,
        });
        return latestVersionId;
      } else {
        console.warn("[Replicate] Versions list is empty", {
          versionsData: JSON.stringify(versionsData).substring(0, 500),
        });
      }
    } else {
      // 404 is expected for models that don't expose versions endpoint
      if (versionsResponse.status === 404) {
        console.log(
          "[Replicate] Versions endpoint not available (404) - this is normal for some models",
          {
            modelPath,
          }
        );
      } else {
        const errorText = await versionsResponse.text().catch(() => "");
        const errorJson = await versionsResponse.json().catch(() => null);
        console.warn("[Replicate] Versions request failed", {
          status: versionsResponse.status,
          statusText: versionsResponse.statusText,
          error: errorText,
          errorJson,
          modelPath,
        });
      }
    }
  } catch (error) {
    console.warn("[Replicate] Failed to fetch versions list", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // Approach 3: Try using model path directly (some endpoints support this)
  // But first, let's throw a more descriptive error
  throw new Error(
    `Failed to get version ID for model ${modelPath}. ` +
      `Please check your API token (${apiToken.substring(0, 10)}...) and model access. ` +
      `The model might not be accessible or the API endpoint might have changed.`
  );
}

/**
 * Creates a prediction on Replicate API
 * Replicate API requires 'version' parameter (not 'model')
 */
export async function createPrediction(
  apiToken: string,
  modelPath: string,
  input: Record<string, unknown>
): Promise<ReplicatePrediction> {
  // Extract owner and model name from path (e.g., "black-forest-labs/flux-kontext-pro")
  const [owner, modelName] = modelPath.split("/");
  if (!owner || !modelName) {
    throw new Error(`Invalid model path format: ${modelPath}`);
  }

  // Get the latest version ID for this model
  // Replicate API v1 requires 'version' parameter, not 'model'
  const versionId = await getModelVersionId(apiToken, owner, modelName);

  // Create prediction with version ID
  const response = await fetch(`${REPLICATE_API_BASE}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: versionId,
      input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    const errorDetails = await response.json().catch(() => null);

    console.error("[Replicate] Prediction creation failed", {
      status: response.status,
      statusText: response.statusText,
      errorText,
      errorDetails,
      versionId,
      modelPath,
    });

    throw new Error(
      `Replicate API error (${response.status}): ${errorText}. ` +
        `Model: ${modelPath}, Version: ${versionId}`
    );
  }

  const prediction = (await response.json()) as ReplicatePrediction;
  console.log("[Replicate] Prediction created successfully", {
    predictionId: prediction.id,
    status: prediction.status,
  });

  return prediction;
}

/**
 * Polls Replicate API until prediction completes
 */
export async function pollPrediction(
  apiToken: string,
  predictionId: string
): Promise<ReplicatePrediction> {
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const response = await fetch(
      `${REPLICATE_API_BASE}/predictions/${predictionId}`,
      {
        headers: {
          Authorization: `Token ${apiToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Failed to poll prediction (${response.status}): ${errorText}`
      );
    }

    const prediction = (await response.json()) as ReplicatePrediction;

    if (prediction.status === "succeeded") {
      return prediction;
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(prediction.error || `Prediction ${prediction.status}`);
    }

    // Still processing, wait and retry
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    attempts++;
  }

  throw new Error(`Prediction timed out after ${MAX_POLL_ATTEMPTS} attempts`);
}

/**
 * Extracts output image URL from Replicate prediction response
 */
function extractOutputUrl(prediction: ReplicatePrediction): string {
  if (!prediction.output) {
    throw new Error("Prediction succeeded but no output URL found");
  }

  if (typeof prediction.output === "string") {
    return prediction.output;
  }

  if (Array.isArray(prediction.output) && prediction.output.length > 0) {
    const firstOutput = prediction.output[0];
    if (typeof firstOutput === "string") {
      return firstOutput;
    }
  }

  throw new Error("Invalid output format from Replicate");
}

/**
 * Generates an AI-processed image using Replicate API
 *
 * @param ctx - Convex Action context
 * @param options - Generation options including input image URL and prompt
 * @returns URL of the generated image
 */
export async function generateImageWithReplicate(
  ctx: ActionCtx,
  options: GenerateImageOptions
): Promise<string> {
  const apiToken = requireEnv("REPLICATE_API_TOKEN");
  const modelPath = DEFAULT_MODEL;

  try {
    // Create prediction using google/nano-banana model
    // nano-banana schema: prompt, image_input (array), aspect_ratio, output_format
    console.log("[Replicate] Creating prediction with prompt", {
      promptLength: options.promptTemplate.length,
      promptPreview: options.promptTemplate.substring(0, 100) + "...",
      imageCount: options.inputImageUrls.length,
      imageUrls: options.inputImageUrls.map(
        (url) => url.substring(0, 50) + "..."
      ),
    });

    const prediction = await createPrediction(apiToken, modelPath, {
      prompt: options.promptTemplate,
      image_input: options.inputImageUrls, // Array of image URLs
      aspect_ratio: options.aspectRatio || "match_input_image",
      output_format: options.outputFormat || "jpg",
    });

    console.log("[Replicate] Prediction created", {
      predictionId: prediction.id,
      status: prediction.status,
    });

    // Poll until completion
    const completed = await pollPrediction(apiToken, prediction.id);

    console.log("[Replicate] Prediction completed", {
      predictionId: completed.id,
      status: completed.status,
    });

    // Extract output URL
    const outputUrl = extractOutputUrl(completed);
    return outputUrl;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error during Replicate API call";
    console.error("[Replicate] Generation failed", { error: message });
    throw new Error(`AI generation failed: ${message}`);
  }
}

/**
 * Generates an image from Convex storage IDs
 * Convenience wrapper that gets the storage URLs first
 */
export async function generateImageFromStorage(
  ctx: ActionCtx,
  storageIds: Id<"_storage">[],
  promptTemplate: string,
  aspectRatio?: string,
  outputFormat?: string
): Promise<string> {
  const inputImageUrls = await Promise.all(
    storageIds.map((id) => getStorageUrl(ctx, id))
  );
  return generateImageWithReplicate(ctx, {
    inputImageUrls,
    promptTemplate,
    aspectRatio,
    outputFormat,
  });
}
