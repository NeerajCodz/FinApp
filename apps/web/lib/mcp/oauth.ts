import { ConvexHttpClient } from 'convex/browser';
import { exportJWK, importPKCS8, importSPKI, jwtVerify, SignJWT } from 'jose';
import type { JWTPayload } from 'jose';
import { MCP_CONVEX_AUDIENCE } from '@convex/shared/mcpAuth';

export type McpPrincipal = { userId: string; grantId: string; scopes: string[] };
const signingAlgorithm = 'RS256' as const;
const allowedScopes = [
  'finapp:read',
  'finapp:write:finance',
  'finapp:write:social',
  'finapp:write:groups',
  'finapp:write:personal',
];

function parseScopes(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value.split(/\s+/).filter((scope) => allowedScopes.includes(scope));
}

export function mcpIssuer(): string {
  const issuer = process.env.MCP_ISSUER_URL?.trim();
  if (!issuer) throw new Error('MCP_ISSUER_URL is required');
  const parsed = new URL(issuer);
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new Error('MCP_ISSUER_URL must use HTTPS outside localhost');
  }
  return parsed.origin;
}

export function mcpConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is required');
  return url;
}

export function convexClient(): ConvexHttpClient {
  return new ConvexHttpClient(mcpConvexUrl());
}

export async function mcpBackendClient(principal: McpPrincipal): Promise<ConvexHttpClient> {
  const client = convexClient();
  const context = await signingContext();
  const backendToken = await signMcpToken(
    context,
    principal.userId,
    { grantId: principal.grantId },
    MCP_CONVEX_AUDIENCE,
    '1m',
  );
  client.setAuth(backendToken);
  return client;
}

export async function prepareMcpAccessTokenSigner() {
  const resource = mcpResourceUrl();
  const context = await signingContext();
  return (userId: string, grantId: string, scopes: string[]) =>
    signMcpToken(context, userId, { scope: scopes.join(' '), grantId }, resource, '1h');
}

async function signingContext() {
  const privateKeyPem = process.env.MCP_SIGNING_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const keyId = process.env.MCP_SIGNING_KEY_ID?.trim();
  if (!privateKeyPem || !keyId) {
    throw new Error('MCP_SIGNING_PRIVATE_KEY and MCP_SIGNING_KEY_ID are required');
  }
  const privateKey = await importPKCS8(privateKeyPem, signingAlgorithm);
  const algorithm = privateKey.algorithm as RsaHashedKeyAlgorithm;
  if (algorithm.modulusLength < 2048)
    throw new Error('MCP signing keys must be at least 2048 bits');
  return { privateKey, keyId, issuer: mcpIssuer() };
}

function signMcpToken(
  context: Awaited<ReturnType<typeof signingContext>>,
  userId: string,
  claims: JWTPayload,
  audience: string,
  lifetime: string,
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: signingAlgorithm, kid: context.keyId, typ: 'JWT' })
    .setIssuer(context.issuer)
    .setSubject(userId)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(lifetime)
    .sign(context.privateKey);
}

export async function mcpJwks(): Promise<{ keys: Record<string, unknown>[] }> {
  const publicKeyPem = process.env.MCP_SIGNING_PUBLIC_KEY?.replace(/\\n/g, '\n');
  const keyId = process.env.MCP_SIGNING_KEY_ID?.trim();
  if (!publicKeyPem || !keyId) {
    throw new Error('MCP_SIGNING_PUBLIC_KEY and MCP_SIGNING_KEY_ID are required');
  }
  const publicKey = await importSPKI(publicKeyPem, signingAlgorithm);
  const exported = await exportJWK(publicKey);
  return { keys: [{ ...exported, kid: keyId, use: 'sig', alg: signingAlgorithm }] };
}

export async function verifyMcpAccessToken(token: string): Promise<McpPrincipal | null> {
  const publicKeyPem = process.env.MCP_SIGNING_PUBLIC_KEY?.replace(/\\n/g, '\n');
  if (!publicKeyPem) throw new Error('MCP_SIGNING_PUBLIC_KEY is required');
  const publicKey = await importSPKI(publicKeyPem, signingAlgorithm);
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: mcpIssuer(),
    audience: mcpResourceUrl(),
    algorithms: [signingAlgorithm],
  });
  if (typeof payload.sub !== 'string' || typeof payload.grantId !== 'string') return null;
  return { userId: payload.sub, grantId: payload.grantId, scopes: parseScopes(payload.scope) };
}

export function mcpResourceUrl(): string {
  const configured = process.env.MCP_RESOURCE_URL?.trim();
  const resource = configured ? new URL(configured) : new URL('/mcp', mcpIssuer());
  if (resource.protocol !== 'https:' && resource.hostname !== 'localhost') {
    throw new Error('MCP_RESOURCE_URL must use HTTPS outside localhost');
  }
  if (resource.pathname !== '/mcp' || resource.search || resource.hash) {
    throw new Error('MCP_RESOURCE_URL must identify the /mcp endpoint without query or fragment.');
  }
  return resource.toString().replace(/\/$/, '');
}
