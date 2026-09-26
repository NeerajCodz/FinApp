import { redirect } from 'next/navigation';
import { TwoFactorVerificationForm } from '@/components/auth/OtpForm';

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ challengeId?: string }>;
}) {
  const { challengeId } = await searchParams;
  if (!challengeId) redirect('/sign-in');
  return <TwoFactorVerificationForm challengeId={challengeId} />;
}
