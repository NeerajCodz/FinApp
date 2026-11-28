/**
 * Encryption at rest for free text that admin features store (ticket messages and subjects,
 * report descriptions, staff notes, ban reasons, AI ticket summaries), plus salted hashes for
 * identifiers (failed sign-in usernames, device ids).
 *
 * Key: the Convex env var `ADMIN_DATA_KEY` (32 random bytes, base64 or base64url). When it is
 * unset, a key is derived from `AI_KEYS_SECRET` with HKDF (`info = finapp-admin-data-v1`), so a
 * deployment that already has the BYOK vault configured works without a new secret. With
 * neither set, encryption throws `ADMIN_DATA_KEY_NOT_CONFIGURED`: nothing is ever stored in
 * plaintext. Local dev: `bunx convex env set ADMIN_DATA_KEY "$(openssl rand -base64 32)"`.
 *
 * Stored form: `a1:<iv>:<ciphertext>` (base64url, AES-256-GCM). `context` is bound as
 * additional data so a ciphertext can't be moved onto another record kind or owner.
 */

const PREFIX = 'a1';
const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64(value: string): Uint8Array<ArrayBuffer> {
  const normal = value.trim().replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normal + '='.repeat((4 - (normal.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

function decodeKey(raw: string | undefined): Uint8Array<ArrayBuffer> | null {
  if (!raw?.trim()) return null;
  try {
    const bytes = fromB64(raw);
    return bytes.length === 32 ? bytes : null;
  } catch {
    return null;
  }
}

/** Raw 32-byte key material, or null when neither secret is configured. */
async function keyMaterial(): Promise<Uint8Array<ArrayBuffer> | null> {
  const direct = decodeKey(process.env.ADMIN_DATA_KEY);
  if (direct) return direct;
  const vault = decodeKey(process.env.AI_KEYS_SECRET);
  if (!vault) return null;
  const base = await crypto.subtle.importKey('raw', vault, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('finapp-admin'),
      info: encoder.encode('finapp-admin-data-v1'),
    },
    base,
    256,
  );
  return new Uint8Array(bits);
}

export async function isAdminCryptoConfigured(): Promise<boolean> {
  return (await keyMaterial()) !== null;
}

async function aesKey(): Promise<CryptoKey> {
  const material = await keyMaterial();
  if (!material) throw new Error('ADMIN_DATA_KEY_NOT_CONFIGURED');
  return crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export function isEncrypted(value: string): boolean {
  return /^a1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(value);
}

export async function encryptText(plaintext: string, context: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(context) },
    await aesKey(),
    encoder.encode(plaintext),
  );
  return `${PREFIX}:${b64url(iv)}:${b64url(new Uint8Array(ciphertext))}`;
}

export async function decryptText(stored: string, context: string): Promise<string> {
  const [version, iv, ciphertext] = stored.split(':');
  if (version !== PREFIX || !iv || !ciphertext) throw new Error('ADMIN_DATA_CORRUPT');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(iv), additionalData: encoder.encode(context) },
    await aesKey(),
    fromB64(ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

/** Decrypts, or returns a placeholder when the key changed or the value is damaged. */
export async function decryptOrPlaceholder(stored: string, context: string): Promise<string> {
  try {
    return await decryptText(stored, context);
  } catch {
    return '[unreadable: encryption key changed]';
  }
}

/**
 * Salted, keyed hash (HMAC-SHA-256) for identifiers such as IPs, device ids or the username
 * typed into a failed sign-in. The salt is `ADMIN_HASH_SALT` or, without it, the data key.
 * Returns the first 32 hex characters; never reversible.
 */
export async function hashIdentifier(value: string): Promise<string> {
  const salt = process.env.ADMIN_HASH_SALT?.trim();
  const material = salt ? encoder.encode(salt) : await keyMaterial();
  if (!material) throw new Error('ADMIN_DATA_KEY_NOT_CONFIGURED');
  const key = await crypto.subtle.importKey(
    'raw',
    material,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`finapp-id:${value.trim().toLowerCase()}`),
  );
  return Array.from(new Uint8Array(signature).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

/** Context strings: one per record kind, bound to the owning user where there is one. */
export const cryptoContext = {
  ticket: (userId: string) => `support-ticket:${userId}`,
  report: (reporterId: string) => `report:${reporterId}`,
  note: (userId: string) => `admin-note:${userId}`,
  restriction: (userId: string) => `restriction:${userId}`,
} as const;
