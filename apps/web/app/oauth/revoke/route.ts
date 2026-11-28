import { readClientCredentials } from '@convex/shared/mcpClients';
import { developerRevoke, isAppClientId } from '@/lib/developerOAuth';

export const runtime = 'nodejs';

/** RFC 7009 token revocation for public API developer apps. */
export async function POST(request: Request) {
  if (
    request.headers.get('content-type')?.split(';', 1)[0]?.trim() !==
    'application/x-www-form-urlencoded'
  )
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  const text = await request.text();
  if (text.length > 4096) return Response.json({ error: 'invalid_request' }, { status: 413 });
  const form = new URLSearchParams(text);
  const credentials = readClientCredentials(request.headers.get('authorization'), form);
  if ('error' in credentials) return Response.json({ error: credentials.error }, { status: 401 });
  if (!credentials.clientId || !isAppClientId(credentials.clientId))
    return Response.json({ error: 'invalid_client' }, { status: 401 });
  return developerRevoke(form, { ...credentials, clientId: credentials.clientId });
}
