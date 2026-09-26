import { SignInForm } from '@/components/auth/SignInForm';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <SignInForm initialIdentifier={email ?? ''} />;
}
