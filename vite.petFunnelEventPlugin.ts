import type { Plugin } from "vite";
import { FunnelIngestError } from "./src/features/pet/funnelEventContract";
import {
  ingestFromUnknown,
  logFunnelWriteFailure,
  parseJsonBody,
  resolveIsTest,
  resolveWriteEnvironment,
  writeValidatedFunnelEvent,
} from "./api/_lib/writePetFunnelEvent";

function readRawBody(req: { on: (event: string, cb: (chunk?: Buffer) => void) => void }): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Local same-origin ingest so Vite dev does not POST analytics to supabase.co. */
export function petFunnelEventDevPlugin(): Plugin {
  return {
    name: "pet-funnel-event-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] || "";
        if (url !== "/api/pet/funnel-event") return next();
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        const environment = resolveWriteEnvironment();
        let eventName = "unknown";
        try {
          const raw = await readRawBody(req as never);
          const { json, bytes } = await parseJsonBody({ body: raw });
          const clientTest = Boolean((json as { is_test_request?: boolean } | null)?.is_test_request);
          const validated = ingestFromUnknown(json, bytes);
          eventName = validated.eventName;
          const isTest = resolveIsTest(environment, clientTest);
          const result = await writeValidatedFunnelEvent(validated, { isTest, environment });
          res.statusCode = 202;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, duplicate: result.duplicate }));
        } catch (error) {
          if (error instanceof FunnelIngestError) {
            void logFunnelWriteFailure({ eventName, category: error.reason, environment });
            res.statusCode = error.status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: error.reason }));
            return;
          }
          void logFunnelWriteFailure({ eventName, category: "write_failed", environment });
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "write_failed" }));
        }
      });
    },
  };
}
