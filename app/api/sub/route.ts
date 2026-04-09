import { parseSubs } from "@/lib/parse";
import { parseProxyLinks } from "@/lib/convert";
import { pack } from "@/lib/pack";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());

  const interval = query["interval"] ?? "1800";
  const short = query["short"] ?? null;
  const notproxyrule = query["npr"] ?? null;

  const rawUrl = query["url"];
  if (!rawUrl) return new Response("Missing url parameter", { status: 400 });

  // Split by | or newline
  const allUrls = rawUrl
    .split(/[|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const urlList: string[] = [];
  const standaloneLinks: string[] = [];
  for (const u of allUrls) {
    if (
      (u.startsWith("http://") || u.startsWith("https://")) &&
      !u.startsWith("https://t.me/")
    ) {
      urlList.push(u);
    } else {
      standaloneLinks.push(u);
    }
  }
  const urlParam = urlList.length > 0 ? urlList : null;
  const urlstandalone =
    standaloneLinks.length > 0 ? standaloneLinks.join("\n") : null;

  // standby
  const rawStandby = query["urlstandby"] ?? null;
  let urlstandby: string[] | null = null;
  let urlstandbyStandaloneStr: string | null = null;
  if (rawStandby) {
    const allStandby = rawStandby
      .split(/[|\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const sbList: string[] = [];
    const sbStandalone: string[] = [];
    for (const u of allStandby) {
      if (
        (u.startsWith("http://") || u.startsWith("https://")) &&
        !u.startsWith("https://t.me/")
      ) {
        sbList.push(u);
      } else {
        sbStandalone.push(u);
      }
    }
    urlstandby = sbList.length > 0 ? sbList : null;
    urlstandbyStandaloneStr =
      sbStandalone.length > 0 ? sbStandalone.join("\n") : null;
  }

  // Convert standalone V2Ray links
  let urlstandaloneProxies = null;
  if (urlstandalone) {
    urlstandaloneProxies = parseProxyLinks(urlstandalone);
  }
  let urlstandbystandaloneProxies = null;
  if (urlstandbyStandaloneStr) {
    urlstandbystandaloneProxies = parseProxyLinks(urlstandbyStandaloneStr);
  }

  // Build response headers
  const headers: Record<string, string> = {
    "Content-Type": "text/yaml;charset=utf-8",
  };

  // If single subscription, pass through subscription-userinfo
  if (urlParam && urlParam.length === 1) {
    try {
      const userAgent = request.headers.get("User-Agent") ?? "clash";
      let headUrl = urlParam[0];
      let headResp = await fetch(headUrl, {
        method: "HEAD",
        headers: { "User-Agent": userAgent },
      });
      while (headResp.status >= 300 && headResp.status < 400) {
        headUrl = headResp.headers.get("Location") ?? headUrl;
        headResp = await fetch(headUrl, {
          method: "HEAD",
          headers: { "User-Agent": userAgent },
        });
      }
      const subInfo = headResp.headers.get("subscription-userinfo");
      if (subInfo) headers["subscription-userinfo"] = subInfo;
      const contentDisp = headResp.headers.get("Content-Disposition");
      if (contentDisp)
        headers["Content-Disposition"] = contentDisp.replace(
          "attachment",
          "inline"
        );
    } catch {
      // ignore header fetch failures
    }
  }

  // Fetch subscription content
  const content: string[] = [];
  const resolvedUrls: string[] = [];
  if (urlParam) {
    const base = `${url.protocol}//${url.host}/`;
    for (const u of urlParam) {
      const text = await fetch(u, {
        headers: { "User-Agent": "v2rayn" },
      }).then((r) => r.text());
      content.push(parseSubs(text));
      resolvedUrls.push(
        `${base}provider?${new URLSearchParams({ url: u }).toString()}`
      );
    }
  }

  let resolvedStandby: string[] | null = null;
  if (urlstandby) {
    const base = `${url.protocol}//${url.host}/`;
    resolvedStandby = urlstandby.map(
      (u) => `${base}provider?${new URLSearchParams({ url: u }).toString()}`
    );
  }

  const domain = url.hostname.replace(/:\d+$/, "");
  const baseUrl = `${url.protocol}//${url.host}/`;

  const result = pack({
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

  return new Response(result, { headers });
}
