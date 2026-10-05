import { NextResponse, type NextRequest } from 'next/server';

const validUsername = /^[a-z0-9_]{3,32}$/i;

function normalizeUsername(value: string) {
  const username = value.replace(/^@+/, '').trim().toLowerCase();
  return validUsername.test(username) ? username : null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const legacyProfile = /^\/(?:user|people)\/([^/]+)\/?$/.exec(pathname);

  if (legacyProfile) {
    const username = normalizeUsername(legacyProfile[1]!);
    if (!username) return NextResponse.next();
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.pathname = `/@${username}`;
    return NextResponse.redirect(canonicalUrl, 308);
  }

  const publicProfile = /^\/@([^/]+)\/?$/.exec(pathname);
  if (publicProfile) {
    const username = normalizeUsername(publicProfile[1]!);
    if (!username) return NextResponse.next();
    const profileUrl = request.nextUrl.clone();
    profileUrl.pathname = `/profile/${username}`;
    return NextResponse.rewrite(profileUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/@:username', '/user/:path*', '/people/:path*'],
};
