import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { requireClipFactoryAdmin } from "./_lib/clip-factory/admin";
import {
  createManualPublisherPublication,
  deletePublisherRule,
  mutatePublication,
  previewPublisherRule,
  publisherBootstrap,
  savePublisherRule,
  setRuleActive,
  tickPublisherWorker,
} from "./_lib/publisher/service";

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

export default async function handler(req: NodeApiRequest, res: NodeApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    await requireClipFactoryAdmin(req.headers.authorization);
    const body = (req.body || {}) as Record<string, unknown>;
    const action = asString(body.action);
    if (action === "bootstrap") return res.status(200).json(await publisherBootstrap());
    if (action === "preview_rule") return res.status(200).json(await previewPublisherRule(body));
    if (action === "save_rule") return res.status(200).json(await savePublisherRule(body, asString(body.id) || undefined));
    if (action === "pause_rule") return res.status(200).json(await setRuleActive(asString(body.id), false));
    if (action === "resume_rule") return res.status(200).json(await setRuleActive(asString(body.id), true));
    if (action === "delete_rule") return res.status(200).json(await deletePublisherRule(asString(body.id)));
    if (action === "create_manual") return res.status(200).json(await createManualPublisherPublication(body));
    if (
      [
        "approve",
        "cancel",
        "lock",
        "return_to_pool",
        "replace_content",
        "reschedule",
        "exclude_asset",
      ].includes(action)
    ) {
      return res.status(200).json(await mutatePublication(action, body));
    }
    if (action === "tick") return res.status(200).json(await tickPublisherWorker("admin-tick"));
    return res.status(400).json({ error: "unknown_action", message: "Unknown Publisher action." });
  } catch (error) {
    const status = Number((error as { status?: number }).status || 500);
    const message = error instanceof Error ? error.message : "publisher_failed";
    return res.status(status >= 400 && status < 600 ? status : 500).json({ error: "publisher_failed", message });
  }
}
