import type { Plugin } from "vite";
import memoriesFunnelHandler from "./api/memories-funnel";
import memoriesEventHandler from "./api/memories-funnel-event";

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

function nodeLike(
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

/** Local same-origin handlers for Memories funnel + analytics. */
export function memoriesDevPlugin(): Plugin {
  return {
    name: "memories-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] || "";
        const isEvent =
          url === "/api/memories-funnel-event" || url === "/api/memories/funnel-event";
        const isFunnel = url === "/api/memories-funnel" || url === "/api/memories/funnel";
        if (!isEvent && !isFunnel) return next();

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
        const { req: vReq, res: vRes } = nodeLike(fakeReq, res);
        if (isEvent) {
          await memoriesEventHandler(vReq, vRes);
          return;
        }
        await memoriesFunnelHandler(vReq, vRes);
      });
    },
  };
}
