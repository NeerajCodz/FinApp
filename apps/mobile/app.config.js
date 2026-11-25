const { execSync } = require('node:child_process');
const path = require('node:path');
/** version.json at the repo root is the source of truth for every version. */
const manifest = require(path.join(__dirname, '..', '..', 'version.json'));

function gitSha() {
  const fromEnv = process.env.EAS_BUILD_GIT_COMMIT_HASH || process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

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
  extra.productVersion = manifest.version;
  extra.releaseChannel = manifest.channel;
  extra.gitSha = gitSha();

  return {
    ...config,
    version: manifest.components.mobile,
    android: { ...config.android, versionCode: manifest.build.android },
    ios: { ...config.ios, buildNumber: String(manifest.build.ios) },
    extra,
  };
};
