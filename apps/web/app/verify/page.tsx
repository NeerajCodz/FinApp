import { redirect } from 'next/navigation';
import { EmailVerificationForm } from '@/components/auth/OtpForm';

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { email, next } = await searchParams;
  if (!email) redirect('/sign-in');
  return (
    <EmailVerificationForm
      email={email}
      next={next === 'onboarding' ? 'onboarding' : 'dashboard'}
    />
  );
}
