import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacySettlementPage({ params, searchParams }: PageProps) {
  const [{ userId }, query] = await Promise.all([params, searchParams]);
  const destination = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (key === 'member' || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) destination.append(key, item);
  }

  destination.set('member', userId);
  redirect(`/settle/new?${destination.toString()}`);
}
