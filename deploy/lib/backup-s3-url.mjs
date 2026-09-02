/**
 * Normalize S3-compatible (R2) settings for restic copy:
 *   s3:${MOZAS_BACKUP_S3_ENDPOINT}/${MOZAS_BACKUP_S3_BUCKET}
 * Never logs secret values.
 */

/**
 * @param {string} endpoint
 * @param {string} bucket
 * @returns {{ endpoint: string, bucket: string, repository: string }}
 */
export function normalizeBackupS3(endpoint, bucket) {
  const rawEndpoint = String(endpoint || "").trim();
  const rawBucket = String(bucket || "").trim();
  if (!rawEndpoint || !rawBucket) {
    throw new Error("endpoint and bucket are required");
  }
  if (rawEndpoint.includes("://") && !/^https:\/\//i.test(rawEndpoint)) {
    throw new Error("endpoint must use https");
  }

  let hostAndPath = rawEndpoint.replace(/^https:\/\//i, "").replace(/\/+$/, "");
  const parts = hostAndPath.split("/").filter(Boolean);
  if (parts.length === 0) {
    throw new Error("endpoint host is empty");
  }
  const host = parts[0];
  const pathParts = parts.slice(1);
  if (pathParts.length && pathParts[pathParts.length - 1] === rawBucket) {
    pathParts.pop();
  }
  if (pathParts.length) {
    throw new Error("endpoint path must be empty or end with the bucket name");
  }

  const normalizedEndpoint = rawEndpoint.startsWith("https://") || rawEndpoint.startsWith("HTTPS://")
    ? `https://${host}`
    : host;
  return {
    endpoint: normalizedEndpoint,
    bucket: rawBucket,
    repository: `s3:${normalizedEndpoint}/${rawBucket}`,
  };
}
