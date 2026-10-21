import { api } from '@convex/_generated/api';
import { convexClient } from '@/lib/mcp/oauth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim() !== 'application/json') {
    return Response.json({ error: 'invalid_client_metadata' }, { status: 400 });
  }
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: 'invalid_client_metadata' }, { status: 400 });
  const decoder = new TextDecoder();
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.length > 16_384) {
        await reader.cancel();
        return Response.json({ error: 'invalid_client_metadata' }, { status: 413 });
      }
    }
    text += decoder.decode();
  } catch {
    return Response.json({ error: 'invalid_client_metadata' }, { status: 400 });
  }
  if (text.length > 16_384)
    return Response.json({ error: 'invalid_client_metadata' }, { status: 413 });
  let metadata: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return Response.json({ error: 'invalid_client_metadata' }, { status: 400 });
    }
    metadata = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'invalid_client_metadata' }, { status: 400 });
  }
  const clientName = typeof metadata.client_name === 'string' ? metadata.client_name : 'MCP client';
  if (
    (metadata.client_name !== undefined && typeof metadata.client_name !== 'string') ||
    !Array.isArray(metadata.redirect_uris) ||
    metadata.redirect_uris.some((uri) => typeof uri !== 'string') ||
    (metadata.token_endpoint_auth_method !== undefined &&
      metadata.token_endpoint_auth_method !== 'none') ||
    (metadata.grant_types !== undefined &&
      (!Array.isArray(metadata.grant_types) ||
        !metadata.grant_types.includes('authorization_code') ||
        metadata.grant_types.some((grant) => grant !== 'authorization_code'))) ||
    (metadata.response_types !== undefined &&
      (!Array.isArray(metadata.response_types) ||
        !metadata.response_types.includes('code') ||
        metadata.response_types.some((response) => response !== 'code')))
  ) {
    return Response.json({ error: 'invalid_client_metadata' }, { status: 400 });
  }
  try {
    const client = await convexClient().mutation(api.mcpOAuth.registerClient, {
      clientName,
      redirectUris: metadata.redirect_uris,
    });
    return Response.json(client, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'invalid_client_metadata' }, { status: 400 });
  }
}
