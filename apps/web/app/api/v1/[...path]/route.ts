/**
 * Thin proxy so the public API is also reachable on the app domain (`/api/v1/*`). The API
 * itself runs as Convex HTTP actions; this forwards the request unchanged (headers, body,
 * status) and never reads or logs credentials.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORWARDED_REQUEST_HEADERS = [
  'authorization',
  'content-type',
  'idempotency-key',
  'accept',
  'user-agent',
];

function upstreamOrigin(): string | null {
  const explicit = process.env.FINAPP_API_UPSTREAM_URL?.trim() || process.env.CONVEX_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (cloud?.includes('.convex.cloud')) return cloud.replace('.convex.cloud', '.convex.site');
  return null;
}

async function forward(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const origin = upstreamOrigin();
  if (!origin)
    return Response.json(
      { error: { code: 'unavailable', message: 'The API upstream is not configured.' } },
      { status: 503 },
    );
  const { path } = await params;
  const incoming = new URL(request.url);
  const target = new URL(
    `/api/v1/${path.map((segment) => encodeURIComponent(segment)).join('/')}${incoming.search}`,
    origin,
  );
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
    cache: 'no-store',
  });
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
export const OPTIONS = forward;
