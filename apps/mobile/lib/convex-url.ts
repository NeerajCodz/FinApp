export type MobilePlatform = 'android' | 'ios' | 'web';

export function resolveConvexUrl(
  configuredUrl: string | undefined,
  _platform: MobilePlatform,
): string {
  const value = configuredUrl?.trim();
  if (!value) {
    throw new Error('EXPO_PUBLIC_CONVEX_URL must be set to the Convex deployment URL.');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('EXPO_PUBLIC_CONVEX_URL must be a valid HTTP(S) URL.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('EXPO_PUBLIC_CONVEX_URL must use HTTP or HTTPS.');
  }

  return value;
}
