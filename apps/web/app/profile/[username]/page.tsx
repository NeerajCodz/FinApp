import { ConvexHttpClient } from 'convex/browser';
import { notFound } from 'next/navigation';
import { api } from '@convex/_generated/api';
import PersonPageClient from './PersonPageClient';

const validUsername = /^[a-z0-9_]{3,32}$/;

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: routeUsername } = await params;
  const handle = routeUsername.replace(/^@+/, '').trim().toLowerCase();
  if (!validUsername.test(handle)) notFound();

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!convexUrl) {
    return <PersonPageClient handle={handle} profile={null} profileUnavailable />;
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.query(api.users.queries.publicProfile, { username: handle });
    const profile = result?.username === handle ? { ...result, username: handle } : null;
    return <PersonPageClient handle={handle} profile={profile} profileUnavailable={false} />;
  } catch {
    return <PersonPageClient handle={handle} profile={null} profileUnavailable />;
  }
}
