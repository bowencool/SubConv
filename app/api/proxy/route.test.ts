import { describe, expect, test } from "bun:test";
import { GET } from "./route";

describe("proxy route passthrough", () => {
  test("drops stale content-encoding/content-length after auto-decompression", async () => {
    const upstream = new Response("full plain body", {
      headers: {
        "content-encoding": "br",
        "content-length": "16",
        "etag": 'W/"10-abc"',
      },
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(upstream)) as typeof fetch;
    try {
      const req = new Request(
        "http://localhost/api/proxy?url=https://example.com/file.list",
      );
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(res.headers.has("content-encoding")).toBe(false);
      expect(res.headers.has("content-length")).toBe(false);
      expect(res.headers.get("etag")).toBe('W/"10-abc"');
      expect(await res.text()).toBe("full plain body");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("passes through encoding-free upstream untouched", async () => {
    const upstream = new Response("raw data", { status: 200 });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(upstream)) as typeof fetch;
    try {
      const req = new Request(
        "http://localhost/api/proxy?url=https://example.com/file.list",
      );
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("raw data");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
