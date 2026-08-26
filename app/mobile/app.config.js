module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL,
    metroUrl: process.env.EXPO_PUBLIC_METRO_URL,
  },
});
