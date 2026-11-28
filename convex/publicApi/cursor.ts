/**
 * Opaque pagination cursors. A cursor wraps either a Convex pagination cursor or an offset into
 * a bounded list, and is bound to the filters it was issued for: reusing it with different
 * filters is an error instead of a silently wrong page.
 */
import { base64url } from './tokens';

type CursorPayload = { v: 1; f: string; c?: string; o?: number };

/** Stable FNV-1a hash of the filters (not a security boundary; cursors carry no secrets). */
export function filterFingerprint(filters: Record<string, unknown>): string {
  const canonical = JSON.stringify(
    Object.keys(filters)
      .sort()
      .filter((key) => filters[key] !== undefined && key !== 'cursor' && key !== 'limit')
      .map((key) => [key, String(filters[key])]),
  );
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function encode(payload: CursorPayload): string {
  return base64url(new TextEncoder().encode(JSON.stringify(payload)));
}

function decode(cursor: string): CursorPayload | null {
  if (!/^[A-Za-z0-9_-]{1,4096}$/.test(cursor)) return null;
  try {
    const normal = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normal + '='.repeat((4 - (normal.length % 4)) % 4));
    const text = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
    const value = JSON.parse(text) as Partial<CursorPayload>;
    if (value.v !== 1 || typeof value.f !== 'string') return null;
    if (value.c !== undefined && typeof value.c !== 'string') return null;
    if (value.o !== undefined && (!Number.isInteger(value.o) || value.o < 0)) return null;
    if ((value.c === undefined) === (value.o === undefined)) return null;
    return value as CursorPayload;
  } catch {
    return null;
  }
}

export class CursorError extends Error {
  constructor() {
    super('INVALID_CURSOR');
  }
}

export function encodeConvexCursor(convexCursor: string, fingerprint: string): string {
  return encode({ v: 1, f: fingerprint, c: convexCursor });
}

export function encodeOffsetCursor(offset: number, fingerprint: string): string {
  return encode({ v: 1, f: fingerprint, o: offset });
}

/** The Convex cursor inside, or `null` for the first page. Throws on a foreign cursor. */
export function decodeConvexCursor(cursor: string | undefined, fingerprint: string) {
  if (!cursor) return null;
  const payload = decode(cursor);
  if (!payload || payload.f !== fingerprint || payload.c === undefined) throw new CursorError();
  return payload.c;
}

export function decodeOffsetCursor(cursor: string | undefined, fingerprint: string): number {
  if (!cursor) return 0;
  const payload = decode(cursor);
  if (!payload || payload.f !== fingerprint || payload.o === undefined) throw new CursorError();
  return payload.o;
}

/** One page of an in-memory list (for bounded domain lists such as accounts). */
export function pageOfList<T>(items: readonly T[], offset: number, limit: number, fp: string) {
  const data = items.slice(offset, offset + limit);
  const next = offset + limit;
  const hasMore = next < items.length;
  return { data, hasMore, nextCursor: hasMore ? encodeOffsetCursor(next, fp) : null };
}
