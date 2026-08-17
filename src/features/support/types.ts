export const SUPPORT_CATEGORIES = [
  { id: "pet_order", label: "Pet order" },
  { id: "generation", label: "Generation issue" },
  { id: "billing", label: "Billing or refund" },
  { id: "account", label: "Account" },
  { id: "other", label: "Other" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["id"];

export const SUPPORT_STATUSES = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "waiting_for_customer", label: "Waiting for customer" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
] as const;

export type SupportStatus = (typeof SUPPORT_STATUSES)[number]["id"];

export const SUPPORT_EMAIL_MAX = 254;
export const SUPPORT_SUBJECT_MIN = 3;
export const SUPPORT_SUBJECT_MAX = 120;
export const SUPPORT_MESSAGE_MIN = 10;
export const SUPPORT_MESSAGE_MAX = 4000;
export const SUPPORT_EXPECTED_RESPONSE = "We typically reply within 1–2 business days.";

export const SUPPORT_PET_CONTEXT_KEY = "tdg.support.petContext";
export const SUPPORT_GUEST_TOKEN_PREFIX = "tdg.support.guest.";

export type SupportPetContext = {
  hasPetOrder: boolean;
};

export type SupportFormValues = {
  email: string;
  category: SupportCategory | "";
  subject: string;
  message: string;
  website: string;
  attachPetOrder: boolean;
};

export type SupportFormErrors = Partial<Record<keyof SupportFormValues, string>>;

export type CreateSupportTicketResult = {
  ok: true;
  reference: string;
  expectedResponse: string;
  guestToken: string | null;
  confirmationStatus: "sent" | "pending" | "failed" | "skipped" | "queued" | null;
};
