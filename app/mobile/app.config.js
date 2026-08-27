module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    convexUrl:
      process.env.EXPO_PUBLIC_CONVEX_URL ?? 'https://secret-kiwi-640.convex.cloud',
    convexSiteUrl:
      process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? 'https://secret-kiwi-640.convex.site',
    metroUrl: process.env.EXPO_PUBLIC_METRO_URL ?? 'http://10.0.2.2:2609',
  },
});
