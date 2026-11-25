import { SignedInRedirect } from '@/components/auth/SignedInRedirect';
import { SignInForm } from '@/components/auth/SignInForm';

export default function SignInPage() {
  return (
    <>
      <SignedInRedirect />
      <SignInForm />
    </>
  );
}
