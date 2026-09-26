export const webAuthnLockChangedEvent = 'finapp-webauthn-lock-changed';

const lockKey = (userId: string) => `finapp.web.webauthn-lock.v1.${userId}`;
const decoder = new TextDecoder();

function randomChallenge(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function requireWebAuthn(): void {
  if (
    !window.isSecureContext ||
    typeof PublicKeyCredential === 'undefined' ||
    !navigator.credentials
  )
    throw new Error('A secure browser with WebAuthn support is required for a passkey lock.');
}

export async function isWebAuthnLockAvailable(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !window.isSecureContext ||
    typeof PublicKeyCredential === 'undefined'
  )
    return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function hasWebAuthnLock(userId: string): boolean {
  return window.localStorage.getItem(lockKey(userId)) !== null;
}

export async function enableWebAuthnLock(userId: string): Promise<void> {
  requireWebAuthn();
  const challenge = randomChallenge();
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Finapp', id: window.location.hostname },
      user: {
        id: randomChallenge(),
        name: 'Finapp on this device',
        displayName: 'Finapp local lock',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'discouraged',
        userVerification: 'required',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  });
  if (!(credential instanceof PublicKeyCredential)) throw new Error('PASSKEY_CREATION_FAILED');
  const clientData = JSON.parse(decoder.decode(credential.response.clientDataJSON)) as {
    type?: string;
    challenge?: string;
    origin?: string;
  };
  if (
    clientData.type !== 'webauthn.create' ||
    clientData.challenge !== toBase64Url(challenge) ||
    clientData.origin !== window.location.origin
  )
    throw new Error('PASSKEY_REGISTRATION_INVALID');
  window.localStorage.setItem(lockKey(userId), toBase64Url(credential.rawId));
  window.dispatchEvent(new Event(webAuthnLockChangedEvent));
}

export async function unlockWithWebAuthn(userId: string): Promise<void> {
  requireWebAuthn();
  const storedId = window.localStorage.getItem(lockKey(userId));
  if (!storedId) throw new Error('PASSKEY_LOCK_NOT_CONFIGURED');
  const challenge = randomChallenge();
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [{ type: 'public-key', id: fromBase64Url(storedId) }],
      userVerification: 'required',
      timeout: 60_000,
    },
  });
  if (!(credential instanceof PublicKeyCredential) || toBase64Url(credential.rawId) !== storedId)
    throw new Error('PASSKEY_UNLOCK_FAILED');
  const clientData = JSON.parse(decoder.decode(credential.response.clientDataJSON)) as {
    type?: string;
    challenge?: string;
    origin?: string;
  };
  if (
    clientData.type !== 'webauthn.get' ||
    clientData.challenge !== toBase64Url(challenge) ||
    clientData.origin !== window.location.origin
  )
    throw new Error('PASSKEY_ASSERTION_INVALID');
}

export function disableWebAuthnLock(userId: string): void {
  window.localStorage.removeItem(lockKey(userId));
  window.dispatchEvent(new Event(webAuthnLockChangedEvent));
}
