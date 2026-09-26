const VISUAL_STANDARD_SUFFIX =
  " Vertical 9:16 photorealistic frame. Clear focal subject, strong first-frame composition, natural lighting, realistic materials and geometry, emotionally readable Christmas or winter mood when relevant. Suitable for subtle image-to-video animation. No logos, no watermarks, no readable text overlays, no malformed architecture, no impossible anatomy or hands, no plastic CGI look, no excessive HDR.";

const MOTION_STANDARD_SUFFIX =
  " Slow cinematic camera movement only. Natural environmental motion such as snowfall, fireplace flicker, or gentle light shimmer. Stable architecture and subject identity. No morphing, no object transformation, no hyperlapse, no wild camera spins.";

export function buildImagePrompt(scenePrompt: string): string {
  const core = String(scenePrompt || "").trim();
  return `${core}${VISUAL_STANDARD_SUFFIX}`.trim();
}

export function buildMotionPrompt(motionPrompt: string): string {
  const core = String(motionPrompt || "").trim();
  return `${core}${MOTION_STANDARD_SUFFIX}`.trim();
}

export function reelTitleFromConcept(input: { concept: string; hook: string }): string {
  const concept = String(input.concept || "").trim();
  const hook = String(input.hook || "").trim();
  if (hook.length <= 80) return hook || concept;
  return concept.slice(0, 80);
}
