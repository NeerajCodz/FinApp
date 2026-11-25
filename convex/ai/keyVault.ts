/**
 * Encrypts BYOK API keys at rest with AES-256-GCM. The 32-byte secret is the Convex env var
 * `AI_KEYS_SECRET` (base64); it never leaves the server. Stored form: `v1:<iv>:<ciphertext>`
 * (base64url). Keys are decrypted only inside actions, for the duration of one request.
 */

const PREFIX = 'v1';

function b64url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64(value: string): Uint8Array<ArrayBuffer> {
  const normal = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normal + '='.repeat((4 - (normal.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

export function isVaultConfigured(): boolean {
  try {
    return fromB64(process.env.AI_KEYS_SECRET?.trim() ?? '').length === 32;
  } catch {
    return false;
  }
}

async function vaultKey(): Promise<CryptoKey> {
  const raw = process.env.AI_KEYS_SECRET?.trim();
  if (!raw) throw new Error('AI_KEYS_NOT_CONFIGURED');
  const bytes = fromB64(raw);
  if (bytes.length !== 32) throw new Error('AI_KEYS_NOT_CONFIGURED');
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** `userId` is bound as additional data, so a ciphertext can't be replayed onto another user. */
export async function encryptSecret(plaintext: string, userId: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(userId) },
    await vaultKey(),
    new TextEncoder().encode(plaintext),
  );
  return `${PREFIX}:${b64url(iv)}:${b64url(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(stored: string, userId: string): Promise<string> {
  const [version, iv, ciphertext] = stored.split(':');
  if (version !== PREFIX || !iv || !ciphertext) throw new Error('AI_KEY_CORRUPT');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(iv), additionalData: new TextEncoder().encode(userId) },
    await vaultKey(),
    fromB64(ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}
