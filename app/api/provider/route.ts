import { parseSubs } from "@/lib/parse";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return new Response("Missing url parameter", { status: 400 });

  const resp = await fetch(url, { headers: { "User-Agent": "v2rayn" } });
  if (!resp.ok) {
    return new Response(await resp.text(), { status: resp.status });
  }
  const text = await resp.text();
  const result = await parseSubs(text);
  return new Response(result, {
    headers: { "Content-Type": "text/yaml;charset=utf-8" },
  });
}
