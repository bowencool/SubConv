const DISALLOW_ROBOTS =
  process.env.DISALLOW_ROBOTS === "true" ||
  process.env.DISALLOW_ROBOTS === "1";

export async function GET() {
  if (DISALLOW_ROBOTS) {
    return new Response("User-agent: *\nDisallow: /", {
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response(null, { status: 404 });
}
