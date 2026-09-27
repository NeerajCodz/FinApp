function requireHttpUrl(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required and must point to the Convex deployment.`);
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) URL.`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${name} must use HTTP or HTTPS.`);
  }

  return value;
}

module.exports = ({ config }) => {
  const extra = {
    ...config.extra,
    convexUrl: requireHttpUrl('EXPO_PUBLIC_CONVEX_URL'),
  };
  const siteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL?.trim();

  if (siteUrl) {
    extra.convexSiteUrl = requireHttpUrl('EXPO_PUBLIC_CONVEX_SITE_URL');
  } else {
    delete extra.convexSiteUrl;
  }
  delete extra.metroUrl;

  return { ...config, extra };
};
