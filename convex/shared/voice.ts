/**
 * Voice messages in group chats and DMs: recorded on the device, uploaded to Convex storage,
 * then attached with their duration. Shared limits for the server and the clients.
 */
export const VOICE_MAX_BYTES = 10 * 1024 * 1024;
export const VOICE_MAX_DURATION_MS = 5 * 60 * 1000;
export const VOICE_MIN_DURATION_MS = 500;

/** Audio containers the clients record in (web MediaRecorder and expo-audio). */
export const VOICE_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/wav',
  'audio/3gpp',
] as const;

/** The normalised audio type for stored metadata, or null when it is not an allowed voice clip. */
export function validateVoiceMetadata(metadata: {
  contentType?: string | null;
  size: number;
}): string | null {
  const type = (metadata.contentType ?? '').split(';')[0]!.trim().toLowerCase();
  if (!(VOICE_MIME_TYPES as readonly string[]).includes(type)) return null;
  if (!(metadata.size > 0) || metadata.size > VOICE_MAX_BYTES) return null;
  return type;
}

export function validVoiceDuration(durationMs: number): boolean {
  return (
    Number.isFinite(durationMs) &&
    durationMs >= VOICE_MIN_DURATION_MS &&
    durationMs <= VOICE_MAX_DURATION_MS
  );
}
