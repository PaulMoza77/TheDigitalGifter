import type { Plugin } from "vite";
import previewHandler from "./api/pet-v2/preview";
import funnelHandler from "./api/pet-v2-funnel-event";
import funnelV3Handler from "./api/pet-v3-funnel-event";

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

function vercelLike(
  req: { method?: string; headers: Record<string, unknown>; body?: unknown },
  res: {
    statusCode: number;
    setHeader: (key: string, value: string) => void;
    end: (chunk?: string) => void;
  },
) {
  return {
    req: req as never,
    res: {
      setHeader: (key: string, value: string) => res.setHeader(key, value),
      status(code: number) {
        res.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(payload));
        return this;
      },
      end() {
        res.end();
        return this;
      },
    } as never,
  };
}

/** Local same-origin handlers so /pet-v2 works in Vite without touching V1 ingest. */
export function petV2DevPlugin(): Plugin {
  return {
    name: "pet-v2-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] || "";
        if (
          url !== "/api/pet-v2/funnel-event" &&
          url !== "/api/pet-v2/preview" &&
          url !== "/api/pet-v3/funnel-event"
        ) {
          return next();
        }
        const raw = req.method === "POST" ? await readRawBody(req as never) : "";
        let body: unknown = {};
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "malformed_json" }));
            return;
          }
        }
        const fakeReq = { method: req.method, headers: req.headers as Record<string, unknown>, body };
        const { req: vReq, res: vRes } = vercelLike(fakeReq, res);
        if (url === "/api/pet-v2/funnel-event") {
          await funnelHandler(vReq, vRes);
          return;
        }
        if (url === "/api/pet-v3/funnel-event") {
          await funnelV3Handler(vReq, vRes);
          return;
        }
        await previewHandler(vReq, vRes);
      });
    },
  };
}
