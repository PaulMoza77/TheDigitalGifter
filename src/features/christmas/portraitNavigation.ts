import { CHRISTMAS_PORTRAIT_STEPS, type ChristmasPortraitDraft, type ChristmasPortraitStep } from "./portraitTypes";

/** URLs describe the current step; private upload/payment data stays in the session. */
export function reachablePortraitStep(requested: string | null, draft: ChristmasPortraitDraft, hasCheckout: boolean, hasResult = false): ChristmasPortraitStep {
  if (!requested || !CHRISTMAS_PORTRAIT_STEPS.includes(requested as ChristmasPortraitStep)) return "intro";
  const step = requested as ChristmasPortraitStep;
  if (step === "intro" || step === "upload" || step === "error") return step;
  if (step === "generating" || step === "result") {
    if (!draft.publicToken) return "intro";
    return step === "result" && !hasResult ? "generating" : step;
  }
  if (!draft.sourcePath && !draft.localPreviewUrl) return "upload";
  if (step === "subject") return "photo";
  if (step === "photo" || step === "style") return step;
  if (!draft.styleKey || !draft.blurredPreviewUrl) return "style";
  if (step === "checkout" && !hasCheckout) return "offer";
  return step;
}

export function previousPortraitStep(draft: ChristmasPortraitDraft, hub: boolean): ChristmasPortraitStep {
  switch (draft.step) {
    case "checkout": return "offer";
    case "offer": return "preview";
    case "preview": return "style";
    case "style": return hub ? "photo" : "upload";
    case "photo": return "upload";
    case "subject": return "upload";
    default: return "intro";
  }
}
