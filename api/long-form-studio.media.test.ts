import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import handler, { sendLocalFile } from "./long-form-studio";
import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";

const dir = join(process.cwd(), "output/long-form");
const filePath = join(dir, "media-range-test.bin");
const payload = Buffer.from("0123456789ABCDEF");

function mockRes() {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const rec = stream as PassThrough & {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
    setHeader: (key: string, value: string | number) => void;
    status: (code: number) => typeof rec;
    json: (body: unknown) => typeof rec;
    send: (body?: unknown) => typeof rec;
    finished: Promise<void>;
    collected: () => Buffer;
  };
  rec.statusCode = 0;
  rec.headers = {};
  rec.body = null;
  rec.setHeader = (key, value) => {
    rec.headers[String(key).toLowerCase()] = String(value);
  };
  rec.status = (code) => {
    rec.statusCode = code;
    return rec;
  };
  rec.json = (body) => {
    rec.body = body;
    rec.end(JSON.stringify(body));
    return rec;
  };
  rec.send = (body) => {
    rec.body = body;
    rec.end(body == null ? undefined : String(body));
    return rec;
  };
  rec.finished = new Promise((resolve) => stream.on("finish", () => resolve()));
  rec.collected = () => Buffer.concat(chunks);
  return rec;
}

function mockReq(partial: Partial<NodeApiRequest> & { method: string; query?: Record<string, string> }): NodeApiRequest {
  return {
    headers: {},
    query: {},
    ...partial,
  } as NodeApiRequest;
}

describe("long-form signed media HTTP", () => {
  beforeAll(async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, payload);
  });

  afterAll(async () => {
    await rm(filePath, { force: true });
  });

  it("GET without action=media is 405 and does not serve the file", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "GET", query: {}, url: "/api/long-form-studio" }), res as unknown as NodeApiResponse);
    await res.finished;
    expect(res.statusCode).toBe(405);
    expect(JSON.stringify(res.body)).toContain("Method not allowed");
  });

  it("HEAD/GET/Range serve the local file without buffering it as a blob", async () => {
    const head = mockRes();
    sendLocalFile(
      mockReq({ method: "HEAD", query: { download: "1", filename: "cozy.mp4" } }),
      head as unknown as NodeApiResponse,
      filePath,
      "video/mp4",
    );
    await head.finished;
    expect(head.statusCode).toBe(200);
    expect(head.headers["accept-ranges"]).toBe("bytes");
    expect(head.headers["content-length"]).toBe(String(payload.length));
    expect(head.headers["content-disposition"]).toContain("cozy.mp4");
    expect(head.collected().length).toBe(0);

    const get = mockRes();
    sendLocalFile(mockReq({ method: "GET", query: {} }), get as unknown as NodeApiResponse, filePath, "video/mp4");
    await get.finished;
    expect(get.statusCode).toBe(200);
    expect(get.collected().equals(payload)).toBe(true);

    const range = mockRes();
    sendLocalFile(
      mockReq({ method: "GET", headers: { range: "bytes=0-3" }, query: { action: "media", kind: "video", id: "p1", exp: "1", sig: "abc" } }),
      range as unknown as NodeApiResponse,
      filePath,
      "video/mp4",
    );
    await range.finished;
    expect(range.statusCode).toBe(206);
    expect(range.headers["content-range"]).toBe(`bytes 0-3/${payload.length}`);
    expect(range.collected().toString()).toBe("0123");
  });
});
