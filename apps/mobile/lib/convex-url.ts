export type MobilePlatform = 'android' | 'ios' | 'web';

export function resolveConvexUrl(
  configuredUrl: string | undefined,
  _platform: MobilePlatform,
): string {
  return configuredUrl?.startsWith('http') ? configuredUrl : 'https://secret-kiwi-640.convex.cloud';
}
