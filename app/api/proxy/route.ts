export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return new Response("Missing url parameter", { status: 400 });

  const resp = await fetch(url);
  const headers = new Headers();
  resp.headers.forEach((v, k) => {
    headers.set(k, v);
  });
  return new Response(resp.body, { status: resp.status, headers });
}
