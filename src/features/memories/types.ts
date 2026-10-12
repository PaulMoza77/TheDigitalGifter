import type { MemoriesPlanKey } from "./config";

export type MemoriesStep = "landing" | "create" | "plans" | "success";

export type MemoriesUploadItem = {
  uploadId: string;
  publicToken: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  previewDataUrl?: string;
  status: "local" | "uploading" | "uploaded" | "failed";
  progress?: number;
  error?: string;
};

export type MemoriesDraft = {
  step: MemoriesStep;
  email: string;
  fullName: string;
  marketingOptIn: boolean;
  processingConsent: boolean;
  authorityAck: boolean;
  selectedPlanKey: MemoriesPlanKey | null;
  uploads: MemoriesUploadItem[];
  orderId: string | null;
  publicToken: string | null;
  commercialMode: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

export function emptyMemoriesDraft(): MemoriesDraft {
  return {
    step: "landing",
    email: "",
    fullName: "",
    marketingOptIn: false,
    processingConsent: false,
    authorityAck: false,
    selectedPlanKey: null,
    uploads: [],
    orderId: null,
    publicToken: null,
    commercialMode: null,
    lastError: null,
    updatedAt: null,
  };
}
