import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { parseSubs } from "./modules/parse.js";
import { convertsV2Ray } from "./modules/convert/converter.js";
import { pack } from "./modules/pack.js";

const DISALLOW_ROBOTS = process.env["DISALLOW_ROBOTS"] === "true" || process.env["DISALLOW_ROBOTS"] === "1";

export const app = new Hono();

// /robots.txt
app.get("/robots.txt", (c) => {
  if (DISALLOW_ROBOTS) {
    return c.text("User-agent: *\nDisallow: /");
  }
  return c.notFound();
});

// /provider — subscription to proxy-provider
app.get("/provider", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.text("Missing url parameter", 400);
  const resp = await fetch(url, { headers: { "User-Agent": "v2rayn" } });
  if (!resp.ok) {
    return c.text(await resp.text(), resp.status as never);
  }
  const text = await resp.text();
  const result = await parseSubs(text);
  return c.body(result, 200, { "Content-Type": "text/yaml;charset=utf-8" });
});

// /proxy — proxy pass to avoid CORS on rule/provider URLs
app.get("/proxy", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.text("Missing url parameter", 400);
  const resp = await fetch(url);
  const body = await resp.arrayBuffer();
  const headers: Record<string, string> = {};
  resp.headers.forEach((v, k) => { headers[k] = v; });
  return c.body(body, resp.status as never, headers);
});

// /sub — subscription converter
app.get("/sub", async (c) => {
  const query = c.req.query();

  const interval = query["interval"] ?? "1800";
  const short = query["short"] ?? null;
  const notproxyrule = query["npr"] ?? null;

  const rawUrl = query["url"];
  if (!rawUrl) return c.text("Missing url parameter", 400);

  // Split by | or newline
  const allUrls = rawUrl.split(/[|\n]/).map((s) => s.trim()).filter(Boolean);
  const urlList: string[] = [];
  const standaloneLinks: string[] = [];
  for (const u of allUrls) {
    if ((u.startsWith("http://") || u.startsWith("https://")) && !u.startsWith("https://t.me/")) {
      urlList.push(u);
    } else {
      standaloneLinks.push(u);
    }
  }
  const urlParam = urlList.length > 0 ? urlList : null;
  let urlstandalone = standaloneLinks.length > 0 ? standaloneLinks.join("\n") : null;

  // standby
  const rawStandby = query["urlstandby"] ?? null;
  let urlstandby: string[] | null = null;
  let urlstandbyStandaloneStr: string | null = null;
  if (rawStandby) {
    const allStandby = rawStandby.split(/[|\n]/).map((s) => s.trim()).filter(Boolean);
    const sbList: string[] = [];
    const sbStandalone: string[] = [];
    for (const u of allStandby) {
      if ((u.startsWith("http://") || u.startsWith("https://")) && !u.startsWith("https://t.me/")) {
        sbList.push(u);
      } else {
        sbStandalone.push(u);
      }
    }
    urlstandby = sbList.length > 0 ? sbList : null;
    urlstandbyStandaloneStr = sbStandalone.length > 0 ? sbStandalone.join("\n") : null;
  }

  // Convert standalone V2Ray links
  let urlstandaloneProxies = null;
  if (urlstandalone) {
    urlstandaloneProxies = await convertsV2Ray(urlstandalone);
  }
  let urlstandbystandaloneProxies = null;
  if (urlstandbyStandaloneStr) {
    urlstandbystandaloneProxies = await convertsV2Ray(urlstandbyStandaloneStr);
  }

  // Build response headers
  const headers: Record<string, string> = { "Content-Type": "text/yaml;charset=utf-8" };

  // If single subscription, pass through subscription-userinfo
  if (urlParam && urlParam.length === 1) {
    try {
      const userAgent = c.req.header("User-Agent") ?? "clash";
      let headUrl = urlParam[0];
      let headResp = await fetch(headUrl, { method: "HEAD", headers: { "User-Agent": userAgent } });
      // Follow redirects manually for HEAD
      while (headResp.status >= 300 && headResp.status < 400) {
        headUrl = headResp.headers.get("Location") ?? headUrl;
        headResp = await fetch(headUrl, { method: "HEAD", headers: { "User-Agent": userAgent } });
      }
      const subInfo = headResp.headers.get("subscription-userinfo");
      if (subInfo) headers["subscription-userinfo"] = subInfo;
      const contentDisp = headResp.headers.get("Content-Disposition");
      if (contentDisp) headers["Content-Disposition"] = contentDisp.replace("attachment", "inline");
    } catch {
      // ignore header fetch failures
    }
  }

  // Fetch subscription content
  const content: string[] = [];
  const resolvedUrls: string[] = [];
  if (urlParam) {
    const baseUrl = new URL(c.req.url);
    const base = `${baseUrl.protocol}//${baseUrl.host}/`;
    for (const u of urlParam) {
      const text = await fetch(u, { headers: { "User-Agent": "v2rayn" } }).then((r) => r.text());
      content.push(await parseSubs(text));
      resolvedUrls.push(`${base}provider?${new URLSearchParams({ url: u }).toString()}`);
    }
  }

  let resolvedStandby: string[] | null = null;
  if (urlstandby) {
    const baseUrl = new URL(c.req.url);
    const base = `${baseUrl.protocol}//${baseUrl.host}/`;
    resolvedStandby = urlstandby.map((u) => `${base}provider?${new URLSearchParams({ url: u }).toString()}`);
  }

  const reqUrl = new URL(c.req.url);
  const domain = reqUrl.hostname.replace(/:\d+$/, "");
  const baseUrl = `${reqUrl.protocol}//${reqUrl.host}/`;

  const result = await pack({
    url: resolvedUrls.length > 0 ? resolvedUrls : null,
    urlstandalone: urlstandaloneProxies,
    urlstandby: resolvedStandby,
    urlstandbystandalone: urlstandbystandaloneProxies,
    content,
    interval,
    domain,
    short,
    notproxyrule,
    base_url: baseUrl,
  });

  return c.body(result, 200, headers);
});

// Serve built frontend — only in production.
// In dev mode (Vite), static assets are handled by Vite itself; registering
// serveStatic here would bypass the Vite pipeline and serve the stale
// production build instead of the live dev bundle.
if (process.env["NODE_ENV"] !== "development") {
  app.use("/*", serveStatic({ root: "./dist/client" }));
  app.get("/", serveStatic({ path: "./dist/client/index.html" }));
}

// Node.js entrypoint
if (process.argv[1] && (process.argv[1].endsWith("index.js") || process.argv[1].endsWith("index.ts"))) {
  // parse --generate-config
  const genIdx = process.argv.indexOf("--generate-config") !== -1
    ? process.argv.indexOf("--generate-config")
    : process.argv.indexOf("-G");
  if (genIdx !== -1) {
    const template = process.argv[genIdx + 1];
    const { writeFileSync } = await import("fs");
    const yamlLib = await import("js-yaml");
    const { templateDefault, templateZju } = await import("./config_template.js");
    if (template === "default") {
      writeFileSync("config.yaml", yamlLib.dump(templateDefault, { noCompatMode: true, sortKeys: false }));
      console.log("Generated default config.yaml");
    } else if (template === "zju") {
      writeFileSync("config.yaml", yamlLib.dump(templateZju, { noCompatMode: true, sortKeys: false }));
      console.log("Generated zju config.yaml");
    } else {
      console.error("Unknown template. Use 'default' or 'zju'");
      process.exit(1);
    }
    process.exit(0);
  }

  const portArg = process.argv.indexOf("--port") !== -1
    ? process.argv.indexOf("--port")
    : process.argv.indexOf("-P");
  const hostArg = process.argv.indexOf("--host") !== -1
    ? process.argv.indexOf("--host")
    : process.argv.indexOf("-H");
  const port = portArg !== -1 ? parseInt(process.argv[portArg + 1]) : parseInt(process.env["PORT"] ?? "8080");
  const host = hostArg !== -1 ? process.argv[hostArg + 1] : (process.env["HOST"] ?? "0.0.0.0");

  const { serve } = await import("@hono/node-server");
  console.log("host:", host);
  console.log("port:", port);
  if (DISALLOW_ROBOTS) console.log("robots: Disallow");
  else console.log("robots: Allow");
  serve({ fetch: app.fetch, hostname: host, port });
}

export default app;
