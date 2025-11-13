import { Id } from "../../convex/_generated/dataModel";

type GenerateUploadUrl = () => Promise<string>;

export async function uploadFileToStorage(
  generateUploadUrl: GenerateUploadUrl,
  file: File
): Promise<Id<"_storage">> {
  const uploadUrl = await generateUploadUrl();

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => null);
    throw new Error(
      message ? `Failed to upload file: ${message}` : "Failed to upload file"
    );
  }

  const body = (await response.json()) as { storageId?: Id<"_storage"> };
  if (!body.storageId) {
    throw new Error("Upload response missing storageId");
  }

  return body.storageId;
}
