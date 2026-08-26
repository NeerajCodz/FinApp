export type MobilePlatform = 'android' | 'ios' | 'web';

export function resolveConvexUrl(
  configuredUrl: string | undefined,
  platform: MobilePlatform,
): string {
  if (configuredUrl?.startsWith('http')) return configuredUrl;
  return platform === 'android' ? 'http://10.0.2.2:3212' : 'http://127.0.0.1:3212';
}
