/**
 * Webhook signing, secret derivation, SSRF screening and retry policy (pure, Web Crypto only).
 *
 * Signature header: `FinApp-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256>` where the HMAC
 * covers `<t>.<raw body>` with the endpoint's secret. During a secret rotation the header carries
 * one `v1=` per valid secret.
 */
import { base64url } from './tokens';

const encoder = new TextEncoder();

async function hmac(key: string | Uint8Array<ArrayBuffer>, message: string): Promise<Uint8Array> {
  const raw = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message)));
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function signWebhookPayload(
  secret: string,
  timestampSeconds: number,
  body: string,
): Promise<string> {
  return hex(await hmac(secret, `${timestampSeconds}.${body}`));
}

export async function signatureHeader(
  secrets: readonly string[],
  timestampSeconds: number,
  body: string,
): Promise<string> {
  const signatures = await Promise.all(
    secrets.map((secret) => signWebhookPayload(secret, timestampSeconds, body)),
  );
  return [`t=${timestampSeconds}`, ...signatures.map((value) => `v1=${value}`)].join(',');
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1)
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

/**
 * Reference verifier (mirrors the docs' samples): checks the timestamp tolerance and that any
 * `v1` signature matches.
 */
export async function verifyWebhookSignature(
  secret: string,
  header: string,
  body: string,
  nowSeconds: number,
  toleranceSeconds = 300,
): Promise<boolean> {
  const parts = header.split(',').map((part) => part.trim().split('=', 2) as [string, string]);
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds)
    return false;
  const expected = await signWebhookPayload(secret, timestamp, body);
  return parts.some(([key, value]) => key === 'v1' && constantTimeEqual(value ?? '', expected));
}

function decodeKey(raw: string | undefined): Uint8Array<ArrayBuffer> {
  const value = raw?.trim();
  if (!value) throw new Error('WEBHOOKS_NOT_CONFIGURED');
  const normal = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normal + '='.repeat((4 - (normal.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  if (out.length < 32) throw new Error('WEBHOOKS_NOT_CONFIGURED');
  return out;
}

/**
 * Endpoint secrets are derived, not stored: `whsec_` + HMAC(WEBHOOK_SECRET_KEY, id.salt).
 * Rotating replaces the salt. The master key never leaves the server.
 */
export async function deriveWebhookSecret(
  masterKey: string | undefined,
  endpointId: string,
  salt: string,
): Promise<string> {
  return `whsec_${base64url(await hmac(decodeKey(masterKey), `${endpointId}.${salt}`))}`;
}

export function isWebhookKeyConfigured(masterKey: string | undefined): boolean {
  try {
    decodeKey(masterKey);
    return true;
  } catch {
    return false;
  }
}

export function randomSalt(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(24)));
}

// ---------- SSRF screening ----------

function ipv4Blocked(host: string): boolean {
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part > 255))
    return false;
  const [a, b] = octets as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function ipv6Blocked(host: string): boolean {
  const value = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!value.includes(':')) return false;
  if (value === '::' || value === '::1') return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  if (mapped) return ipv4Blocked(mapped[1]!);
  if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(value)) return true;
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(value) || value.startsWith('64:ff9b:');
}

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa', '.corp'];

/**
 * Rejects webhook targets that could reach private infrastructure: non-HTTPS URLs, embedded
 * credentials, localhost names, IP literals in private, loopback, link-local, CGNAT, multicast or
 * reserved ranges, and single-label hostnames. Deliveries also refuse redirects.
 */
export function checkWebhookUrl(
  raw: string,
): { ok: true; url: string } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'INVALID_URL' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'HTTPS_REQUIRED' };
  if (url.username || url.password) return { ok: false, reason: 'CREDENTIALS_NOT_ALLOWED' };
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return { ok: false, reason: 'INVALID_URL' };
  if (
    host === 'localhost' ||
    BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix)) ||
    ipv4Blocked(host) ||
    ipv6Blocked(host)
  )
    return { ok: false, reason: 'PRIVATE_ADDRESS' };
  if (!host.includes('.') && !host.includes(':')) return { ok: false, reason: 'PRIVATE_ADDRESS' };
  if (url.port && !['443', '8443'].includes(url.port) && Number(url.port) < 1024)
    return { ok: false, reason: 'PORT_NOT_ALLOWED' };
  url.hash = '';
  return { ok: true, url: url.toString() };
}

// ---------- Retry policy ----------

/** Delay before attempt `n + 1` after `n` failed attempts; `null` = give up. */
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 6 * 3_600_000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
/** Endpoints are disabled after this many deliveries in a row ultimately fail. */
export const DISABLE_AFTER_CONSECUTIVE_FAILURES = 10;

export function retryDelay(failedAttempts: number, jitter = Math.random()): number | null {
  const base = RETRY_DELAYS_MS[failedAttempts - 1];
  if (base === undefined) return null;
  return Math.round(base * (0.9 + 0.2 * jitter));
}

/** 2xx is success; 410 Gone means "stop sending"; everything else is retried. */
export function classifyResponse(status: number): 'success' | 'gone' | 'retry' {
  if (status >= 200 && status < 300) return 'success';
  if (status === 410) return 'gone';
  return 'retry';
}
