/**
 * Credential helpers shared by personal access tokens, OAuth app tokens and webhook secrets.
 * Only SHA-256 digests of tokens are stored; plaintext is shown once and never logged.
 */

export const TOKEN_PREFIXES = {
  pat: 'fa_pat_',
  access: 'fa_oat_',
  refresh: 'fa_ort_',
  clientSecret: 'fa_cs_',
} as const;
export type TokenKind = keyof typeof TOKEN_PREFIXES;

/** OAuth app client ids: `fa_app_` + 24 hex characters. */
export const APP_CLIENT_ID_PREFIX = 'fa_app_';
export function isAppClientId(value: string): boolean {
  return /^fa_app_[a-f0-9]{24}$/.test(value);
}

const BODY = /^[A-Za-z0-9_-]{43}$/;

export function base64url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function randomToken(kind: TokenKind): string {
  return `${TOKEN_PREFIXES[kind]}${base64url(crypto.getRandomValues(new Uint8Array(32)))}`;
}

/** Which kind of token this looks like (format only; it says nothing about validity). */
export function tokenKind(token: string): TokenKind | null {
  for (const [kind, prefix] of Object.entries(TOKEN_PREFIXES) as [TokenKind, string][]) {
    if (token.startsWith(prefix) && BODY.test(token.slice(prefix.length))) return kind;
  }
  return null;
}

/** The part of a token safe to display, e.g. `fa_pat_Ab3x`. */
export function tokenPrefix(token: string): string {
  const kind = tokenKind(token);
  const prefix = kind ? TOKEN_PREFIXES[kind] : '';
  return token.slice(0, prefix.length + 4);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const hashToken = sha256Hex;

/** Constant-time comparison of two strings (digests); length is not secret. */
export function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1)
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

/**
 * A salted hash of the caller's IP, so "last used from" can show a stable fingerprint without
 * storing the address. Without a salt configured nothing is recorded.
 */
export async function hashIp(ip: string | null, salt: string | undefined): Promise<string | null> {
  const value = ip?.trim();
  if (!value || !salt) return null;
  return (await sha256Hex(`${salt}\n${value}`)).slice(0, 32);
}

export const EXPIRY_PRESETS = { never: null, '7d': 7, '30d': 30, '90d': 90 } as const;
export const MAX_CUSTOM_EXPIRY_DAYS = 366;
const DAY = 86_400_000;

/** Expiry timestamp for a preset or a custom date; `undefined` = never expires. */
export function resolveExpiry(
  input: { preset: keyof typeof EXPIRY_PRESETS } | { customAt: number },
  now: number,
): number | undefined {
  if ('customAt' in input) {
    if (!Number.isFinite(input.customAt) || input.customAt <= now + 60 * 60_000)
      throw new Error('INVALID_EXPIRY');
    if (input.customAt > now + MAX_CUSTOM_EXPIRY_DAYS * DAY) throw new Error('INVALID_EXPIRY');
    return Math.floor(input.customAt);
  }
  if (!Object.hasOwn(EXPIRY_PRESETS, input.preset)) throw new Error('INVALID_EXPIRY');
  const days = EXPIRY_PRESETS[input.preset];
  return days === null ? undefined : now + days * DAY;
}
