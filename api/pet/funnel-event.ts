import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FunnelIngestError } from "../../src/features/pet/funnelEventContract";
import {
  ingestFromUnknown,
  logFunnelWriteFailure,
  originAllowed,
  parseJsonBody,
  resolveIsTest,
  resolveWriteEnvironment,
  writeValidatedFunnelEvent,
} from "../_lib/writePetFunnelEvent";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const environment = resolveWriteEnvironment();
  const origin = String(req.headers.origin || "");
  const host = String(req.headers.host || "");
  if (origin && !originAllowed(origin, host)) {
    void logFunnelWriteFailure({ eventName: "unknown", category: "origin_denied", environment });
    return res.status(403).json({ error: "Forbidden" });
  }

  let eventName = "unknown";
  try {
    const { json, bytes } = await parseJsonBody(req);
    const clientTest = Boolean((json as { is_test_request?: boolean } | null)?.is_test_request);
    const validated = ingestFromUnknown(json, bytes);
    eventName = validated.eventName;
    const isTest = resolveIsTest(environment, clientTest);
    const result = await writeValidatedFunnelEvent(validated, { isTest, environment });
    return res.status(202).json({ ok: true, duplicate: result.duplicate });
  } catch (error) {
    if (error instanceof FunnelIngestError) {
      void logFunnelWriteFailure({
        eventName,
        category: error.reason,
        environment,
      });
      return res.status(error.status).json({ error: error.reason });
    }
    const category = error instanceof Error && error.message.startsWith("rpc_") ? "rpc_error" : "write_failed";
    void logFunnelWriteFailure({ eventName, category, environment });
    return res.status(500).json({ error: "write_failed" });
  }
}
