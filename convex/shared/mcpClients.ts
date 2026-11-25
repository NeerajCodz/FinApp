/**
 * OAuth client rules for the MCP authorization server. Pure helpers shared by Convex functions
 * and the web OAuth routes.
 *
 * Three ways a client can exist:
 * - `dcr`: registered at /oauth/register (RFC 7591); public or with a secret / JWKS.
 * - `static`: created by a signed-in user on the MCP dashboard ("use your own client
 *   credentials" in ChatGPT); always confidential.
 * - `cimd`: the client_id is an HTTPS URL to a Client ID Metadata Document that we fetch and
 *   validate (ChatGPT's `https://chatgpt.com/oauth/.../client.json`).
 */

export const TOKEN_ENDPOINT_AUTH_METHODS = [
  'none',
  'client_secret_basic',
  'client_secret_post',
  'private_key_jwt',
] as const;
export type TokenEndpointAuthMethod = (typeof TOKEN_ENDPOINT_AUTH_METHODS)[number];
export type ClientRegistration = 'dcr' | 'static' | 'cimd';

/** Methods a metadata-document client can use (it has no shared secret with us). */
const CIMD_METHODS: readonly TokenEndpointAuthMethod[] = ['none', 'private_key_jwt'];
export const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
/** How long a fetched metadata document is trusted before it's fetched again. */
export const CIMD_CACHE_MS = 60 * 60_000;
export const CIMD_MAX_BYTES = 16_384;
export const MAX_REDIRECT_URIS = 12;
/** Refresh tokens live this long and rotate on every use. */
export const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60_000;

export function isTokenEndpointAuthMethod(value: unknown): value is TokenEndpointAuthMethod {
  return (
    typeof value === 'string' && (TOKEN_ENDPOINT_AUTH_METHODS as readonly string[]).includes(value)
  );
}

export function isConfidentialSecretMethod(method: TokenEndpointAuthMethod | undefined): boolean {
  return method === 'client_secret_basic' || method === 'client_secret_post';
}

/** Client ids we mint (DCR and dashboard clients): 64 hex characters. */
export function isIssuedClientId(value: string): boolean {
  return /^[a-f\d]{64}$/.test(value);
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true; // IPv4 literal
  if (host.includes(':')) return true; // IPv6 literal
  return !host.includes('.');
}

/** A Client ID Metadata Document URL: HTTPS, a real hostname, a path, no fragment or userinfo. */
export function isCimdClientId(value: string): boolean {
  if (!value || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.hash &&
      url.pathname !== '/' &&
      url.port === '' &&
      !isPrivateHost(url.hostname) &&
      url.toString() === value
    );
  } catch {
    return false;
  }
}

export function isValidClientId(value: string): boolean {
  return isIssuedClientId(value) || isCimdClientId(value);
}

export function validRedirectUri(value: string): boolean {
  if (!value || value.length > 2048) return false;
  try {
    const uri = new URL(value);
    return (
      !uri.username &&
      !uri.password &&
      (uri.protocol === 'https:' ||
        (uri.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname))) &&
      !uri.hash
    );
  } catch {
    return false;
  }
}

export function validJwksUri(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' && !url.username && !url.password && !isPrivateHost(url.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Picks the token endpoint auth method for a metadata-document client: the intersection of what
 * the document lists and what we support, preferring the document's singular (legacy) choice,
 * then `private_key_jwt`, then `none`.
 */
export function selectCimdAuthMethod(document: {
  token_endpoint_auth_methods_supported?: unknown;
  token_endpoint_auth_method?: unknown;
}): TokenEndpointAuthMethod | null {
  const listed = Array.isArray(document.token_endpoint_auth_methods_supported)
    ? document.token_endpoint_auth_methods_supported.filter(isTokenEndpointAuthMethod)
    : [];
  const preferred = isTokenEndpointAuthMethod(document.token_endpoint_auth_method)
    ? document.token_endpoint_auth_method
    : undefined;
  const offered = listed.length ? listed : preferred ? [preferred] : ['none' as const];
  const usable = offered.filter((method) => CIMD_METHODS.includes(method));
  if (preferred && usable.includes(preferred)) return preferred;
  if (usable.includes('private_key_jwt')) return 'private_key_jwt';
  if (usable.includes('none')) return 'none';
  return null;
}

export type CimdClient = {
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  jwksUri?: string;
};

/** Validates a fetched Client ID Metadata Document for `clientId`; throws a short code. */
export function parseCimdDocument(clientId: string, document: unknown): CimdClient {
  if (!document || typeof document !== 'object' || Array.isArray(document))
    throw new Error('INVALID_CLIENT_METADATA');
  const doc = document as Record<string, unknown>;
  if (doc.client_id !== clientId) throw new Error('CLIENT_ID_MISMATCH');
  const redirects = doc.redirect_uris;
  if (
    !Array.isArray(redirects) ||
    redirects.length < 1 ||
    redirects.length > MAX_REDIRECT_URIS ||
    redirects.some((uri) => typeof uri !== 'string' || !validRedirectUri(uri))
  )
    throw new Error('INVALID_REDIRECT_URI');
  if (doc.client_secret !== undefined || doc.client_secret_expires_at !== undefined)
    throw new Error('INVALID_CLIENT_METADATA');
  const method = selectCimdAuthMethod(doc);
  if (!method) throw new Error('UNSUPPORTED_AUTH_METHOD');
  let jwksUri: string | undefined;
  if (method === 'private_key_jwt') {
    // ChatGPT publishes its keys at /oauth/jwks.json on the document's origin.
    jwksUri = validJwksUri(doc.jwks_uri)
      ? doc.jwks_uri
      : new URL('/oauth/jwks.json', new URL(clientId).origin).toString();
  }
  const name =
    typeof doc.client_name === 'string' && doc.client_name.trim()
      ? doc.client_name.trim().slice(0, 128)
      : new URL(clientId).hostname;
  return {
    clientName: name,
    redirectUris: [...new Set(redirects as string[])],
    tokenEndpointAuthMethod: method,
    ...(jwksUri ? { jwksUri } : {}),
  };
}

/** Reads client credentials from a token request (Basic header, form secret or JWT assertion). */
export function readClientCredentials(
  authorization: string | null,
  form: URLSearchParams,
):
  | {
      clientId: string | null;
      clientSecret?: string;
      clientAssertion?: string;
      via: 'basic' | 'post' | 'assertion' | 'none';
    }
  | { error: 'invalid_client' | 'invalid_request' } {
  const formClientId = form.get('client_id');
  const assertionType = form.get('client_assertion_type');
  const assertion = form.get('client_assertion');
  const formSecret = form.get('client_secret');
  const methods = [
    Boolean(authorization?.match(/^Basic /i)),
    Boolean(formSecret),
    Boolean(assertion),
  ];
  if (methods.filter(Boolean).length > 1) return { error: 'invalid_request' };
  if (authorization && /^Basic /i.test(authorization)) {
    let decoded: string;
    try {
      decoded = atob(authorization.slice(6).trim());
    } catch {
      return { error: 'invalid_client' };
    }
    const index = decoded.indexOf(':');
    if (index < 0) return { error: 'invalid_client' };
    const decode = (value: string) => {
      try {
        return decodeURIComponent(value.replace(/\+/g, ' '));
      } catch {
        return value;
      }
    };
    const clientId = decode(decoded.slice(0, index));
    const clientSecret = decode(decoded.slice(index + 1));
    if (!clientId || (formClientId && formClientId !== clientId))
      return { error: 'invalid_client' };
    return { clientId, clientSecret, via: 'basic' };
  }
  if (assertion) {
    if (assertionType !== CLIENT_ASSERTION_TYPE) return { error: 'invalid_request' };
    return { clientId: formClientId, clientAssertion: assertion, via: 'assertion' };
  }
  if (formSecret) return { clientId: formClientId, clientSecret: formSecret, via: 'post' };
  return { clientId: formClientId, via: 'none' };
}
