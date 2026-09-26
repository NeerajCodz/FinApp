export const webAuthnLockChangedEvent = 'finapp-webauthn-lock-changed';

const lockKey = (userId: string) => `finapp.web.webauthn-lock.v1.${userId}`;
const passcodeKey = (userId: string) => `finapp.web.passcode-lock.v1.${userId}`;
const throttleKey = (userId: string) => `finapp.web.passcode-throttle.v1.${userId}`;
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

type PasscodeRecord = { salt: string; digest: string };
type ThrottleRecord = { attempts: number; retryAt: number };
export type PasscodeLockStatus = {
  configured: boolean;
  attemptsRemaining: number;
  retryAt: number;
};

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

function readPasscode(userId: string): PasscodeRecord | null {
  const stored = window.localStorage.getItem(passcodeKey(userId));
  if (stored === null) return null;
  const value: unknown = JSON.parse(stored);
  if (
    !value ||
    typeof value !== 'object' ||
    !('salt' in value) ||
    typeof value.salt !== 'string' ||
    !('digest' in value) ||
    typeof value.digest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.digest)
  )
    throw new Error('PASSCODE_LOCK_STORAGE_INVALID');
  return { salt: value.salt, digest: value.digest };
}

function readThrottle(userId: string): ThrottleRecord {
  const stored = window.localStorage.getItem(throttleKey(userId));
  if (stored === null) return { attempts: 0, retryAt: 0 };
  const value: unknown = JSON.parse(stored);
  if (
    !value ||
    typeof value !== 'object' ||
    !('attempts' in value) ||
    typeof value.attempts !== 'number' ||
    !Number.isInteger(value.attempts) ||
    value.attempts < 0 ||
    value.attempts >= MAX_ATTEMPTS ||
    !('retryAt' in value) ||
    typeof value.retryAt !== 'number' ||
    !Number.isFinite(value.retryAt) ||
    value.retryAt < 0
  )
    throw new Error('PASSCODE_THROTTLE_STORAGE_INVALID');
  return { attempts: value.attempts, retryAt: value.retryAt };
}

async function digestPasscode(salt: string, code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${salt}:${code}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function assertNotLockedOut(userId: string): void {
  const throttle = readThrottle(userId);
  if (throttle.retryAt > Date.now()) throw new Error('PASSCODE_LOCKED_OUT');
  if (throttle.retryAt !== 0)
    window.localStorage.removeItem(throttleKey(userId));
}

async function recordFailedAttempt(userId: string): Promise<ThrottleRecord> {
  const previous = readThrottle(userId);
  if (previous.retryAt > Date.now()) return previous;
  const attempts = previous.attempts + 1;
  const next =
    attempts >= MAX_ATTEMPTS
      ? { attempts: 0, retryAt: Date.now() + LOCKOUT_MS }
      : { attempts, retryAt: 0 };
  window.localStorage.setItem(throttleKey(userId), JSON.stringify(next));
  return next;
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

export function hasPasscodeLock(userId: string): boolean {
  return window.localStorage.getItem(passcodeKey(userId)) !== null;
}

export function hasBrowserLock(userId: string): boolean {
  return hasWebAuthnLock(userId) || hasPasscodeLock(userId);
}

export function getPasscodeLockStatus(userId: string): PasscodeLockStatus {
  const throttle = readThrottle(userId);
  const isLockedOut = throttle.retryAt > Date.now();
  return {
    configured: readPasscode(userId) !== null,
    attemptsRemaining: isLockedOut ? 0 : MAX_ATTEMPTS - throttle.attempts,
    retryAt: isLockedOut ? throttle.retryAt : 0,
  };
}

export async function setPasscodeLock(userId: string, code: string): Promise<void> {
  if (!/^\d{6}$/.test(code)) throw new Error('Use a six-digit passcode.');
  const salt = toBase64Url(randomChallenge());
  const passcode = { salt, digest: await digestPasscode(salt, code) };
  window.localStorage.setItem(passcodeKey(userId), JSON.stringify(passcode));
  window.localStorage.removeItem(throttleKey(userId));
  window.dispatchEvent(new Event(webAuthnLockChangedEvent));
}

export async function verifyPasscodeLock(userId: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  assertNotLockedOut(userId);
  const passcode = readPasscode(userId);
  if (!passcode) throw new Error('PASSCODE_LOCK_NOT_CONFIGURED');
  const candidate = await digestPasscode(passcode.salt, code);
  if (!constantTimeEqual(candidate, passcode.digest)) {
    const next = await recordFailedAttempt(userId);
    window.dispatchEvent(new Event(webAuthnLockChangedEvent));
    if (next.retryAt > Date.now()) throw new Error('PASSCODE_LOCKED_OUT');
    return false;
  }
  window.localStorage.removeItem(throttleKey(userId));
  return true;
}

function requireWebAuthn(): void {
  if (
    !window.isSecureContext ||
    typeof PublicKeyCredential === 'undefined' ||
    !navigator.credentials
  )
    throw new Error('A secure browser with WebAuthn support is required for a passkey lock.');
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
  window.localStorage.removeItem(throttleKey(userId));
  window.dispatchEvent(new Event(webAuthnLockChangedEvent));
}

export async function unlockWithWebAuthn(userId: string): Promise<void> {
  assertNotLockedOut(userId);
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
  if (!(credential instanceof PublicKeyCredential) || toBase64Url(credential.rawId) !== storedId) {
    await recordFailedAttempt(userId);
    throw new Error('PASSKEY_UNLOCK_FAILED');
  }
  const clientData = JSON.parse(decoder.decode(credential.response.clientDataJSON)) as {
    type?: string;
    challenge?: string;
    origin?: string;
  };
  if (
    clientData.type !== 'webauthn.get' ||
    clientData.challenge !== toBase64Url(challenge) ||
    clientData.origin !== window.location.origin
  ) {
    await recordFailedAttempt(userId);
    throw new Error('PASSKEY_ASSERTION_INVALID');
  }
  window.localStorage.removeItem(throttleKey(userId));
}

export function disableWebAuthnLock(userId: string): void {
  window.localStorage.removeItem(lockKey(userId));
  window.localStorage.removeItem(passcodeKey(userId));
  window.localStorage.removeItem(throttleKey(userId));
  window.dispatchEvent(new Event(webAuthnLockChangedEvent));
}
