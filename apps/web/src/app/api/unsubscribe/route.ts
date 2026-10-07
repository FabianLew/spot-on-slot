// One-click unsubscribe (RFC 8058): mail clients POST to the `List-Unsubscribe` URL of alert e-mails, which points
// here; the token is forwarded to the backend, which switches the e-mails off.
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new Response(null, { status: 400 });
  const response = await fetch(`${API_URL}/api/v1/public/notifications/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });
  return new Response(null, { status: response.ok ? 200 : response.status === 404 ? 404 : 502 });
}
