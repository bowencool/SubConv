import { parseSubs } from "@/lib/parse";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return new Response("Missing url parameter", { status: 400 });

  const upstreamUrl = url.replace(/(\\|\/)$/, "");
  const resp = await fetch(upstreamUrl, { headers: { "User-Agent": "v2rayn" } });
  if (!resp.ok) {
    return new Response(await resp.text(), { status: resp.status });
  }
  const responseText = await resp.text();
  const result = parseSubs(responseText);
  const responseBody = result.endsWith("\n") ? result : `${result}\n`;
  const body = new TextEncoder().encode(responseBody);

  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="provider.yaml"',
      "Content-Length": String(body.byteLength),
      "Content-Type": "application/yaml; charset=utf-8",
    },
  });
}
