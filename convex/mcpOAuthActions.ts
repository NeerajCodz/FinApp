import { v } from 'convex/values';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { action, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import {
  CIMD_CACHE_MS,
  CIMD_MAX_BYTES,
  isCimdClientId,
  isValidClientId,
  parseCimdDocument,
} from './shared/mcpClients';

type ResolvedClient = { clientId: string; clientName: string; redirectUris: string[] };

/** Fetches a Client ID Metadata Document: HTTPS only, no redirects, small, quick. */
async function fetchMetadataDocument(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('CLIENT_METADATA_UNAVAILABLE');
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > CIMD_MAX_BYTES)
      throw new Error('INVALID_CLIENT_METADATA');
    const text = await response.text();
    if (text.length > CIMD_MAX_BYTES) throw new Error('INVALID_CLIENT_METADATA');
    return JSON.parse(text) as unknown;
  } catch (cause) {
    if (cause instanceof Error && /^[A-Z_]+$/.test(cause.message)) throw cause;
    throw new Error('CLIENT_METADATA_UNAVAILABLE');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves a client for /oauth/authorize. Issued ids are looked up; HTTPS ids are Client ID
 * Metadata Documents, fetched and validated here (never trusted from the caller) and cached.
 */
export const resolveClient = action({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }): Promise<ResolvedClient | null> => {
    if (!isValidClientId(clientId)) return null;
    const stored = await ctx.runQuery(internal.mcpOAuth.storedClient, { clientId });
    if (!isCimdClientId(clientId)) return stored;
    if (
      stored &&
      stored.registration === 'cimd' &&
      (stored.metadataFetchedAt ?? 0) > Date.now() - CIMD_CACHE_MS
    )
      return stored;
    const parsed = parseCimdDocument(clientId, await fetchMetadataDocument(clientId));
    await ctx.runMutation(internal.mcpOAuth.upsertMetadataClient, { clientId, ...parsed });
    return { clientId, clientName: parsed.clientName, redirectUris: parsed.redirectUris };
  },
});

function issuer(): string {
  const value = process.env.MCP_ISSUER_URL?.trim();
  if (!value) throw new Error('MCP_ISSUER_URL is required');
  return new URL(value).origin;
}

/** Verifies a `private_key_jwt` client assertion against the client's registered JWKS. */
async function verifyAssertion(ctx: ActionCtx, clientId: string, assertion: string) {
  const client = await ctx.runQuery(internal.mcpOAuth.storedClient, { clientId });
  if (!client || client.tokenEndpointAuthMethod !== 'private_key_jwt' || !client.jwksUri)
    throw new Error('INVALID_CLIENT');
  const origin = issuer();
  const jwks = createRemoteJWKSet(new URL(client.jwksUri), { timeoutDuration: 5_000 });
  const { payload } = await jwtVerify(assertion, jwks, {
    issuer: clientId,
    subject: clientId,
    audience: [`${origin}/oauth/token`, origin],
    maxTokenAge: '10m',
    clockTolerance: 30,
  }).catch(() => {
    throw new Error('INVALID_CLIENT');
  });
  if (typeof payload.jti !== 'string' || typeof payload.exp !== 'number')
    throw new Error('INVALID_CLIENT');
  return { assertionJti: payload.jti, assertionExpiresAt: payload.exp * 1000 };
}

/** Authorization-code exchange for `private_key_jwt` clients (e.g. ChatGPT via CIMD). */
export const exchangeWithClientAssertion = action({
  args: {
    code: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    codeVerifier: v.string(),
    clientAssertion: v.string(),
  },
  handler: async (
    ctx,
    { clientAssertion, ...args },
  ): Promise<{ userId: string; scopes: string[]; grantId: string; refreshToken: string }> => {
    if (!isValidClientId(args.clientId)) throw new Error('INVALID_CLIENT');
    const verified = await verifyAssertion(ctx, args.clientId, clientAssertion);
    return ctx.runMutation(internal.mcpOAuth.exchangeAuthorizationCodeWithAssertion, {
      ...args,
      ...verified,
    });
  },
});

/** Refresh-token grant for `private_key_jwt` clients. */
export const refreshWithClientAssertion = action({
  args: { refreshToken: v.string(), clientId: v.string(), clientAssertion: v.string() },
  handler: async (
    ctx,
    { clientAssertion, ...args },
  ): Promise<{ userId: string; scopes: string[]; grantId: string; refreshToken: string }> => {
    if (!isValidClientId(args.clientId)) throw new Error('INVALID_CLIENT');
    const verified = await verifyAssertion(ctx, args.clientId, clientAssertion);
    return ctx.runMutation(internal.mcpOAuth.refreshAccessGrantWithAssertion, {
      ...args,
      ...verified,
    });
  },
});
